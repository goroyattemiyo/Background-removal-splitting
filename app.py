import os
import io
import uuid
import zipfile
import shutil
import numpy as np
import cv2
from PIL import Image
from flask import Flask, request, jsonify, send_file, render_template

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")

# --- Real-ESRGAN upscaler (lazy init) ---
upsampler = None

def get_upsampler():
    global upsampler
    if upsampler is not None:
        return upsampler
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer
    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=6, num_grow_ch=32, scale=4)
    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weights", "RealESRGAN_x4plus_anime_6B.pth")
    if not os.path.exists(model_path):
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        import urllib.request
        url = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth"
        print("Downloading Real-ESRGAN anime model...")
        urllib.request.urlretrieve(url, model_path)
        print("Download complete.")
    upsampler = RealESRGANer(
        scale=4,
        model_path=model_path,
        model=model,
        tile=0,
        tile_pad=10,
        pre_pad=0,
        half=False
    )
    return upsampler


def ensure_dirs(sid):
    up = os.path.join(UPLOAD_DIR, sid)
    out = os.path.join(OUTPUT_DIR, sid)
    os.makedirs(up, exist_ok=True)
    os.makedirs(out, exist_ok=True)
    return up, out


def split_grid(img, rows, cols):
    w, h = img.size
    cw, ch = w // cols, h // rows
    cells = []
    for r in range(rows):
        for c in range(cols):
            box = (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)
            cells.append(img.crop(box))
    return cells


def ai_upscale(img):
    """Upscale PIL image using Real-ESRGAN anime model."""
    try:
        up = get_upsampler()
        img_rgb = img.convert("RGB")
        cv_img = np.array(img_rgb)[:, :, ::-1]  # RGB to BGR
        output, _ = up.enhance(cv_img, outscale=4)
        output_rgb = output[:, :, ::-1]  # BGR to RGB
        return Image.fromarray(output_rgb, "RGB").convert("RGBA")
    except Exception as e:
        print("AI upscale failed, falling back to LANCZOS:", e)
        w, h = img.size
        return img.resize((w * 4, h * 4), Image.LANCZOS)



# --- ハイブリッド背景除去 ---
from rembg import remove as rembg_remove, new_session

_anime_session = None

def get_anime_session():
    global _anime_session
    if _anime_session is None:
        _anime_session = new_session("isnet-anime")
    return _anime_session

def remove_bg_hybrid(img, bg_r, bg_g, bg_b, tolerance=40, edge_softness=2):
    img = img.convert("RGBA")
    arr = np.array(img)

    # Step 1: AI保護マスク
    session = get_anime_session()
    ai_result = rembg_remove(img, session=session)
    ai_alpha = np.array(ai_result)[:, :, 3]
    protect_mask = ai_alpha > 128

    # Step 2: 近似色を統一（背景のムラを吸収）
    bg_color = np.array([bg_r, bg_g, bg_b], dtype=np.float32)
    rgb_f = arr[:, :, :3].astype(np.float32)
    rgb_dist = np.sqrt(((rgb_f - bg_color) ** 2).sum(axis=2))
    unify_range = tolerance * 1.5
    near_bg = rgb_dist < unify_range
    unify_target = near_bg & (~protect_mask)
    arr[unify_target, 0] = bg_r
    arr[unify_target, 1] = bg_g
    arr[unify_target, 2] = bg_b

    # Step 3: 統一後の色で背景除去
    rgb_f2 = arr[:, :, :3].astype(np.float32)
    rgb_dist2 = np.sqrt(((rgb_f2 - bg_color) ** 2).sum(axis=2))
    outer = tolerance + 25.0
    alpha_color = np.where(
        rgb_dist2 <= tolerance, 0.0,
        np.where(rgb_dist2 >= outer, 255.0,
                 ((rgb_dist2 - tolerance) / (outer - tolerance)) * 255.0)
    ).astype(np.uint8)

    # Step 4: AI保護マスクと合成
    final_alpha = np.where(protect_mask, 255, alpha_color).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    final_alpha = cv2.morphologyEx(final_alpha, cv2.MORPH_CLOSE, kernel, iterations=1)
    final_alpha = cv2.morphologyEx(final_alpha, cv2.MORPH_OPEN, kernel, iterations=1)
    if edge_softness > 0:
        final_alpha = cv2.GaussianBlur(final_alpha, (0, 0), sigmaX=max(edge_softness, 1.0))
    arr[:, :, 3] = final_alpha
    from PIL import Image as PILImage
    return PILImage.fromarray(arr, "RGBA")

def remove_bg_color(img, bg_r, bg_g, bg_b, tolerance=10, edge_softness=2):
    img = img.convert("RGBA")
    arr = np.array(img)
    bg_f = np.array([bg_r, bg_g, bg_b], dtype=np.float32)
    rgb_f = arr[:, :, :3].astype(np.float32)
    rgb_dist = np.sqrt(((rgb_f - bg_f) ** 2).sum(axis=2))
    outer = tolerance + 25.0
    alpha_f = np.clip((rgb_dist - tolerance) / max(outer - tolerance, 1.0), 0, 1) * 255.0
    bg_u8 = np.array([[bg_f.astype(np.uint8)]])
    bg_hsv = cv2.cvtColor(bg_u8, cv2.COLOR_RGB2HSV)[0, 0]
    bg_s = int(bg_hsv[1])
    bg_h = int(bg_hsv[0])
    if bg_s > 50:
        hsv = cv2.cvtColor(arr[:, :, :3].copy(), cv2.COLOR_RGB2HSV)
        h_ch = hsv[:, :, 0].astype(np.int16)
        s_ch = hsv[:, :, 1]
        h_diff = np.minimum(np.abs(h_ch - bg_h), 180 - np.abs(h_ch - bg_h))
        hue_tol = max(tolerance // 4, 8)
        is_hue_match = (h_diff < hue_tol) & (s_ch > 30)
        alpha_f = np.where(is_hue_match, np.minimum(alpha_f, h_diff.astype(np.float32) / hue_tol * 255.0), alpha_f)
    alpha_u8 = np.clip(alpha_f, 0, 255).astype(np.uint8)
    hard = (alpha_u8 < 128).astype(np.uint8) * 255
    kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    hard = cv2.morphologyEx(hard, cv2.MORPH_CLOSE, kern, iterations=1)
    hard = cv2.morphologyEx(hard, cv2.MORPH_OPEN, kern, iterations=1)
    alpha_u8 = np.where(hard == 255, np.minimum(alpha_u8, np.uint8(30)), alpha_u8)
    if edge_softness > 0:
        alpha_u8 = cv2.GaussianBlur(alpha_u8, (0, 0), sigmaX=edge_softness)
    arr[:, :, 3] = alpha_u8
    return Image.fromarray(arr, "RGBA")


def fit_to_line_sticker(img, max_w=370, max_h=320, margin=10):
    img = img.convert("RGBA")
    bbox = img.getbbox()
    if bbox is None:
        return Image.new("RGBA", (2, 2), (0, 0, 0, 0))
    content = img.crop(bbox)
    cw, ch = content.size
    inner_w = max_w - 2 * margin
    inner_h = max_h - 2 * margin
    scale = min(inner_w / cw, inner_h / ch)
    if scale < 1.0:
        new_w = max(int(cw * scale) & ~1, 2)
        new_h = max(int(ch * scale) & ~1, 2)
        content = content.resize((new_w, new_h), Image.LANCZOS)
        cw, ch = new_w, new_h
    canvas_w = min(cw + 2 * margin, max_w)
    canvas_h = min(ch + 2 * margin, max_h)
    if canvas_w % 2 == 1: canvas_w += 1
    if canvas_h % 2 == 1: canvas_h += 1
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    x = (canvas_w - cw) // 2
    y = (canvas_h - ch) // 2
    canvas.paste(content, (x, y), content)
    return canvas


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "no image"}), 400
    sid = uuid.uuid4().hex[:12]
    up_dir, _ = ensure_dirs(sid)
    fp = os.path.join(up_dir, "source.png")
    file.save(fp)
    img = Image.open(fp)
    w, h = img.size
    return jsonify({"session_id": sid, "width": w, "height": h})


@app.route("/process", methods=["POST"])
def process():
    data = request.get_json(force=True)
    sid = data.get("session_id", "")
    rows = int(data.get("rows", 8))
    cols = int(data.get("cols", 6))
    tol = int(data.get("tolerance", 10))
    es = int(data.get("edge_softness", 2))
    line_fmt = data.get("line_format", True)
    use_ai = data.get("use_ai_upscale", True)
    bg_r = int(data.get("bg_r", 255))
    bg_g = int(data.get("bg_g", 0))
    bg_b = int(data.get("bg_b", 255))
    up_dir = os.path.join(UPLOAD_DIR, sid)
    out_dir = os.path.join(OUTPUT_DIR, sid)
    src = os.path.join(up_dir, "source.png")
    if not os.path.exists(src):
        return jsonify({"error": "session not found"}), 404
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    img = Image.open(src).convert("RGBA")
    cells = split_grid(img, rows, cols)
    results = []
    for i, cell in enumerate(cells):
        cell = cell.convert("RGBA")
        do_remove_bg = data.get("remove_bg", False)
        if do_remove_bg:
            if use_ai:
                cell = ai_upscale(cell)
            cell = remove_bg_hybrid(cell, bg_r, bg_g, bg_b, tolerance=tol, edge_softness=es)
        if line_fmt:
            cell = fit_to_line_sticker(cell)
        fname = "sticker_{:03d}.png".format(i + 1)
        cell.save(os.path.join(out_dir, fname), "PNG")
        results.append(fname)
    return jsonify({"results": results, "count": len(results)})


@app.route("/preview/<sid>/<filename>")
def preview(sid, filename):
    path = os.path.join(OUTPUT_DIR, sid, filename)
    if not os.path.exists(path):
        return "Not found", 404
    return send_file(path, mimetype="image/png")


@app.route("/download/<sid>")
def download(sid):
    out_dir = os.path.join(OUTPUT_DIR, sid)
    if not os.path.isdir(out_dir):
        return "Not found", 404
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in sorted(os.listdir(out_dir)):
            zf.write(os.path.join(out_dir, fname), fname)
    buf.seek(0)
    return send_file(buf, mimetype="application/zip",
                     as_attachment=True,
                     download_name="line_stickers_{}.zip".format(sid))


if __name__ == "__main__":
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=False)
