// ============================================
// LINE Stamp Maker - Main Application
// ============================================

// --- State ---
let sourceImg = null;       // HTMLImageElement
let cells = [];             // { canvas, selected, blob }[]
let bgMode = 'none';
let pickedColor = null;     // {r,g,b}

// --- DOM ---
const $ = id => document.getElementById(id);
const dropZone       = $('drop-zone');
const fileInput      = $('file-input');
const previewCanvas  = $('preview-canvas');
const stepSplit      = $('step-split');
const gridCanvas     = $('grid-canvas');
const rowsInput      = $('rows');
const colsInput      = $('cols');
const btnSplit       = $('btn-split');
const stepSelect     = $('step-select');
const cellGrid       = $('cell-grid');
const selectedCount  = $('selected-count');
const countWarning   = $('count-warning');
const mainSelect     = $('main-select');
const tabSelect      = $('tab-select');
const stepBg         = $('step-bg');
const colorPickerArea= $('color-picker-area');
const pickerCanvas   = $('picker-canvas');
const colorSwatch    = $('color-swatch');
const colorLabel     = $('color-label');
const tolInput       = $('tolerance');
const tolVal         = $('tol-val');
const btnRemoveBg    = $('btn-remove-bg');
const bgProgress     = $('bg-progress');
const bgBar          = $('bg-bar');
const bgStatus       = $('bg-status');
const stepDownload   = $('step-download');
const downloadPreview= $('download-preview');
const btnPackage     = $('btn-package');
const pkgProgress    = $('pkg-progress');
const pkgBar         = $('pkg-bar');

// ============================================
// Step 1: Upload
// ============================================
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => { sourceImg = img; showSplitStep(); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ============================================
// Step 2: Grid Split
// ============================================
function showSplitStep() {
  stepSplit.classList.remove('hidden');
  drawGridPreview();
}

function drawGridPreview() {
  const rows = parseInt(rowsInput.value) || 5;
  const cols = parseInt(colsInput.value) || 8;
  const ctx = gridCanvas.getContext('2d');
  gridCanvas.width = sourceImg.width;
  gridCanvas.height = sourceImg.height;
  ctx.drawImage(sourceImg, 0, 0);
  ctx.strokeStyle = 'rgba(0,113,227,0.7)';
  ctx.lineWidth = 2;
  const cw = sourceImg.width / cols;
  const ch = sourceImg.height / rows;
  for (let c = 1; c < cols; c++) { ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, sourceImg.height); ctx.stroke(); }
  for (let r = 1; r < rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(sourceImg.width, r * ch); ctx.stroke(); }
}

rowsInput.addEventListener('input', drawGridPreview);
colsInput.addEventListener('input', drawGridPreview);

btnSplit.addEventListener('click', () => {
  const rows = parseInt(rowsInput.value);
  const cols = parseInt(colsInput.value);
  const doUpscale = document.getElementById('upscale-check').checked;
  const scale = doUpscale ? 2 : 1;

  // If upscale, create scaled source first
  let src = sourceImg;
  if (doUpscale) {
    const upCv = document.createElement('canvas');
    upCv.width = sourceImg.width * 2;
    upCv.height = sourceImg.height * 2;
    const upCtx = upCv.getContext('2d');
    upCtx.imageSmoothingEnabled = true;
    upCtx.imageSmoothingQuality = 'high';
    upCtx.drawImage(sourceImg, 0, 0, upCv.width, upCv.height);
    src = upCv;
  }

  cells = [];
  const cw = src.width / cols;
  const ch = src.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cv = document.createElement('canvas');
      cv.width = Math.round(cw);
      cv.height = Math.round(ch);
      cv.getContext('2d').drawImage(src, Math.round(c * cw), Math.round(r * ch), Math.round(cw), Math.round(ch), 0, 0, cv.width, cv.height);
      cells.push({ canvas: cv, selected: true });
    }
  }
  showSelectStep();
});

// ============================================
// Step 3: Select
// ============================================
function showSelectStep() {
  stepSelect.classList.remove('hidden');
  cellGrid.innerHTML = '';
  mainSelect.innerHTML = '';
  tabSelect.innerHTML = '';
  const allowed = [8, 16, 24, 32, 40];

  cells.forEach((cell, i) => {
    const div = document.createElement('div');
    div.className = 'cell-item selected';
    const img = document.createElement('img');
    img.src = cell.canvas.toDataURL('image/png');
    const num = document.createElement('span');
    num.className = 'cell-num';
    num.textContent = i + 1;
    div.appendChild(img);
    div.appendChild(num);
    div.addEventListener('click', () => {
      cell.selected = !cell.selected;
      div.classList.toggle('selected', cell.selected);
      updateSelectionUI();
    });
    cellGrid.appendChild(div);

    const opt1 = new Option(`${i + 1}`, i);
    const opt2 = new Option(`${i + 1}`, i);
    mainSelect.appendChild(opt1);
    tabSelect.appendChild(opt2);
  });

  updateSelectionUI();
  stepBg.classList.remove('hidden');
  stepDownload.classList.remove('hidden');
}

function updateSelectionUI() {
  const count = cells.filter(c => c.selected).length;
  selectedCount.textContent = count;
  const allowed = [8, 16, 24, 32, 40];
  countWarning.classList.toggle('hidden', allowed.includes(count));
}

// ============================================
// Step 4: Background Removal
// ============================================
document.querySelectorAll('input[name="bg-mode"]').forEach(radio => {
  radio.addEventListener('change', e => {
    bgMode = e.target.value;
    colorPickerArea.classList.toggle('hidden', bgMode !== 'color');
    btnRemoveBg.classList.toggle('hidden', bgMode === 'none');
    if (bgMode === 'color') setupPicker();
  });
});

tolInput.addEventListener('input', () => { tolVal.textContent = tolInput.value; });

function setupPicker() {
  if (!sourceImg) return;
  const ctx = pickerCanvas.getContext('2d');
  pickerCanvas.width = sourceImg.width;
  pickerCanvas.height = sourceImg.height;
  ctx.drawImage(sourceImg, 0, 0);
  pickerCanvas.style.cursor = 'crosshair';
  pickerCanvas.onclick = e => {
    const rect = pickerCanvas.getBoundingClientRect();
    const sx = pickerCanvas.width / rect.width;
    const sy = pickerCanvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * sx);
    const y = Math.floor((e.clientY - rect.top) * sy);
    const px = ctx.getImageData(x, y, 1, 1).data;
    pickedColor = { r: px[0], g: px[1], b: px[2] };
    colorSwatch.style.background = `rgb(${px[0]},${px[1]},${px[2]})`;
    colorLabel.textContent = `RGB(${px[0]}, ${px[1]}, ${px[2]})`;
  };
}

btnRemoveBg.addEventListener('click', async () => {
  btnRemoveBg.disabled = true;
  bgProgress.classList.remove('hidden');
  bgBar.value = 0;
  bgStatus.textContent = '処理中...';

  const selected = cells.filter(c => c.selected);
  for (let i = 0; i < selected.length; i++) {
    const cell = selected[i];
    if (bgMode === 'color' && pickedColor) {
      removeColorBg(cell, pickedColor, parseInt(tolInput.value));
    }
    bgBar.value = Math.round(((i + 1) / selected.length) * 100);
    bgStatus.textContent = `${i + 1} / ${selected.length}`;
  }
  bgStatus.textContent = '完了';
  btnRemoveBg.disabled = false;
  refreshCellPreviews();
  stepSelect.scrollIntoView({ behavior: 'smooth' });
});

function removeColorBg(cell, color, tolerance) {
  const ctx = cell.canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, cell.canvas.width, cell.canvas.height);
  const d = imgData.data;
  const unifyRange = tolerance * 1.5;
  // Pass 1: unify near-bg colors
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.sqrt((d[i] - color.r) ** 2 + (d[i+1] - color.g) ** 2 + (d[i+2] - color.b) ** 2);
    if (dist < unifyRange) { d[i] = color.r; d[i+1] = color.g; d[i+2] = color.b; }
  }
  // Pass 2: remove unified bg (wider fade band)
  const outer = tolerance + 60;
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.sqrt((d[i] - color.r) ** 2 + (d[i+1] - color.g) ** 2 + (d[i+2] - color.b) ** 2);
    if (dist <= tolerance) { d[i+3] = 0; }
    else if (dist < outer) { d[i+3] = Math.round(((dist - tolerance) / (outer - tolerance)) * 255); }
  }
  // Pass 3: defringe - remove color spill from semi-transparent pixels
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i+3];
    if (a > 0 && a < 250) {
      const dist = Math.sqrt((d[i] - color.r) ** 2 + (d[i+1] - color.g) ** 2 + (d[i+2] - color.b) ** 2);
      if (dist < outer) {
        const mix = 1 - (dist / outer);
        d[i]   = Math.round(d[i]   + (d[i]   - color.r) * mix);
        d[i+1] = Math.round(d[i+1] + (d[i+1] - color.g) * mix);
        d[i+2] = Math.round(d[i+2] + (d[i+2] - color.b) * mix);
        d[i]   = Math.max(0, Math.min(255, d[i]));
        d[i+1] = Math.max(0, Math.min(255, d[i+1]));
        d[i+2] = Math.max(0, Math.min(255, d[i+2]));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}



function refreshCellPreviews() {
  const imgs = cellGrid.querySelectorAll('img');
  cells.forEach((cell, i) => { if (imgs[i]) imgs[i].src = cell.canvas.toDataURL('image/png'); });
}

// ============================================
// Step 5: Package & Download
// ============================================
btnPackage.addEventListener('click', async () => {
  btnPackage.disabled = true;
  pkgProgress.classList.remove('hidden');
  pkgBar.value = 0;
  downloadPreview.innerHTML = '';

  const selected = cells.filter(c => c.selected);
  const allowed = [8, 16, 24, 32, 40];
  if (!allowed.includes(selected.length)) {
    alert(`スタンプは ${allowed.join('/')} 個にしてください（現在: ${selected.length}個）`);
    btnPackage.disabled = false;
    return;
  }

  const zip = new JSZip();
  const mainIdx = parseInt(mainSelect.value);
  const tabIdx = parseInt(tabSelect.value);

  // main.png (240x240)
  zip.file('main.png', await resizeToBlob(cells[mainIdx].canvas, 240, 240));
  // tab.png (96x74)
  zip.file('tab.png', await resizeToBlob(cells[tabIdx].canvas, 96, 74));

  // Sticker images: 01.png - NN.png
  for (let i = 0; i < selected.length; i++) {
    const blob = await fitLineSticker(selected[i].canvas);
    const name = String(i + 1).padStart(2, '0') + '.png';
    zip.file(name, blob);

    const prev = document.createElement('img');
    prev.src = URL.createObjectURL(blob);
    downloadPreview.appendChild(prev);

    pkgBar.value = Math.round(((i + 1) / selected.length) * 100);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = 'line_stamps.zip';
  a.click();
  URL.revokeObjectURL(a.href);

  btnPackage.disabled = false;
  pkgBar.value = 100;
});

function resizeToBlob(srcCanvas, targetW, targetH) {
  const cv = document.createElement('canvas');
  cv.width = targetW;
  cv.height = targetH;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, targetW, targetH);
  const ratio = Math.min(targetW / srcCanvas.width, targetH / srcCanvas.height);
  const drawW = Math.round(srcCanvas.width * ratio);
  const drawH = Math.round(srcCanvas.height * ratio);
  const offsetX = Math.round((targetW - drawW) / 2);
  const offsetY = Math.round((targetH - drawH) / 2);
  ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, offsetX, offsetY, drawW, drawH);
  return new Promise(r => cv.toBlob(r, 'image/png'));
}

function fitLineSticker(srcCanvas) {
  const maxW = 370, maxH = 320, minSide = 80;
  let ratio = Math.min(maxW / srcCanvas.width, maxH / srcCanvas.height, 1);
  let w = Math.round(srcCanvas.width * ratio);
  let h = Math.round(srcCanvas.height * ratio);
  // ensure minimum 80px
  if (w < minSide || h < minSide) {
    ratio = Math.max(minSide / srcCanvas.width, minSide / srcCanvas.height);
    w = Math.round(srcCanvas.width * ratio);
    h = Math.round(srcCanvas.height * ratio);
  }
  w = w % 2 === 0 ? w : w + 1;
  h = h % 2 === 0 ? h : h + 1;
  // clamp to max after even adjustment
  if (w > maxW) w = maxW;
  if (h > maxH) h = maxH;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d').drawImage(srcCanvas, 0, 0, w, h);
  return new Promise(r => cv.toBlob(r, 'image/png'));
}
