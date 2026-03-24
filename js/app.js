// ============================================
// LINE Stamp Maker - Main Application
// ============================================

// --- State ---
let appMode = 'sheet';      // 'sheet' | 'individual'
let sourceImg = null;       // HTMLImageElement (sheet mode)
let individualFiles = [];   // File[] (individual mode)
let cells = [];             // { canvas, selected }[]
let bgMode = 'none';
let pickedColor = null;     // {r,g,b}

// Grid line positions (in source image coordinates)
let colLines = [];  // x positions of vertical lines (between cols)
let rowLines = [];  // y positions of horizontal lines (between rows)
let dragging = null; // { type: 'col'|'row', index: number }

// --- DOM ---
const $ = id => document.getElementById(id);
const dropZone       = $('drop-zone');
const fileInput      = $('file-input');
const dropZoneMulti  = $('drop-zone-multi');
const fileInputMulti = $('file-input-multi');
const uploadSheet    = $('upload-sheet');
const uploadIndividual = $('upload-individual');
const individualPreview = $('individual-preview');
const individualCount = $('individual-count');
const indCountNum    = $('ind-count-num');
const indCountWarning = $('ind-count-warning');
const btnUseIndividual = $('btn-use-individual');
const previewCanvas  = $('preview-canvas');
const stepSplit      = $('step-split');
const gridCanvas     = $('grid-canvas');
const rowsInput      = $('rows');
const colsInput      = $('cols');
const btnSplit       = $('btn-split');
const btnResetGrid   = $('btn-reset-grid');
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
// Mode Toggle
// ============================================
document.querySelectorAll('input[name="app-mode"]').forEach(radio => {
  radio.addEventListener('change', e => {
    appMode = e.target.value;
    $('mode-sheet-label').classList.toggle('active', appMode === 'sheet');
    $('mode-individual-label').classList.toggle('active', appMode === 'individual');
    uploadSheet.classList.toggle('hidden', appMode !== 'sheet');
    uploadIndividual.classList.toggle('hidden', appMode !== 'individual');
    resetAll();
  });
});

function resetAll() {
  sourceImg = null;
  individualFiles = [];
  cells = [];
  bgMode = 'none';
  pickedColor = null;
  colLines = [];
  rowLines = [];
  dragging = null;
  stepSplit.classList.add('hidden');
  stepSelect.classList.add('hidden');
  stepBg.classList.add('hidden');
  stepDownload.classList.add('hidden');
  individualPreview.innerHTML = '';
  individualCount.classList.add('hidden');
  btnUseIndividual.classList.add('hidden');
  cellGrid.innerHTML = '';
  downloadPreview.innerHTML = '';
}

// ============================================
// Step 1: Upload - Sheet Mode
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
// Step 1: Upload - Individual Mode
// ============================================
dropZoneMulti.addEventListener('click', () => fileInputMulti.click());
dropZoneMulti.addEventListener('dragover', e => { e.preventDefault(); dropZoneMulti.classList.add('drag-over'); });
dropZoneMulti.addEventListener('dragleave', () => dropZoneMulti.classList.remove('drag-over'));
dropZoneMulti.addEventListener('drop', e => {
  e.preventDefault();
  dropZoneMulti.classList.remove('drag-over');
  addIndividualFiles(e.dataTransfer.files);
});
fileInputMulti.addEventListener('change', e => {
  if (e.target.files.length) addIndividualFiles(e.target.files);
});

function addIndividualFiles(fileList) {
  const imageFiles = [...fileList].filter(f => f.type.startsWith('image/'));
  individualFiles = individualFiles.concat(imageFiles);
  if (individualFiles.length > 40) {
    individualFiles = individualFiles.slice(0, 40);
    alert('最大40枚までです。先頭40枚を使用します。');
  }
  renderIndividualPreview();
}

function renderIndividualPreview() {
  individualPreview.innerHTML = '';
  const allowed = [8, 16, 24, 32, 40];

  individualFiles.forEach((file, i) => {
    const div = document.createElement('div');
    div.className = 'ind-thumb';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    const num = document.createElement('span');
    num.className = 'ind-num';
    num.textContent = i + 1;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'ind-remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      individualFiles.splice(i, 1);
      renderIndividualPreview();
    });
    div.appendChild(img);
    div.appendChild(num);
    div.appendChild(removeBtn);
    individualPreview.appendChild(div);
  });

  const count = individualFiles.length;
  indCountNum.textContent = count;
  individualCount.classList.toggle('hidden', count === 0);
  indCountWarning.classList.toggle('hidden', allowed.includes(count));
  btnUseIndividual.classList.toggle('hidden', count === 0);
}

btnUseIndividual.addEventListener('click', async () => {
  btnUseIndividual.disabled = true;
  btnUseIndividual.textContent = '読み込み中...';
  cells = [];
  for (const file of individualFiles) {
    const canvas = await fileToCanvas(file);
    cells.push({ canvas, selected: true });
  }
  btnUseIndividual.disabled = false;
  btnUseIndividual.textContent = 'この画像でスタンプを作成';
  showSelectStep();
});

function fileToCanvas(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        cv.getContext('2d').drawImage(img, 0, 0);
        resolve(cv);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ============================================
// Step 2: Grid Split (Sheet Mode)
// ============================================
function showSplitStep() {
  stepSplit.classList.remove('hidden');
  initGridLines();
  drawGridPreview();
}

function initGridLines() {
  const rows = parseInt(rowsInput.value) || 5;
  const cols = parseInt(colsInput.value) || 8;
  colLines = [];
  rowLines = [];
  for (let c = 1; c < cols; c++) colLines.push(Math.round(sourceImg.width * c / cols));
  for (let r = 1; r < rows; r++) rowLines.push(Math.round(sourceImg.height * r / rows));
}

function drawGridPreview() {
  if (!sourceImg) return;
  const ctx = gridCanvas.getContext('2d');
  gridCanvas.width = sourceImg.width;
  gridCanvas.height = sourceImg.height;
  ctx.drawImage(sourceImg, 0, 0);

  // Draw vertical lines
  ctx.strokeStyle = 'rgba(0,113,227,0.7)';
  ctx.lineWidth = 2;
  for (const x of colLines) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sourceImg.height); ctx.stroke();
  }
  // Draw horizontal lines
  for (const y of rowLines) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sourceImg.width, y); ctx.stroke();
  }

  // Draw drag handles
  const handleSize = 8;
  ctx.fillStyle = 'rgba(0,113,227,0.9)';
  for (const x of colLines) {
    ctx.beginPath();
    ctx.arc(x, sourceImg.height / 2, handleSize, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const y of rowLines) {
    ctx.beginPath();
    ctx.arc(sourceImg.width / 2, y, handleSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Convert mouse event to source image coordinates
function canvasToImg(e) {
  const rect = gridCanvas.getBoundingClientRect();
  const scaleX = sourceImg.width / rect.width;
  const scaleY = sourceImg.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

// Hit test: find nearest grid line within grab distance
function hitTest(imgX, imgY) {
  const grabDist = Math.max(sourceImg.width, sourceImg.height) * 0.015; // 1.5% of image
  for (let i = 0; i < colLines.length; i++) {
    if (Math.abs(imgX - colLines[i]) < grabDist) return { type: 'col', index: i };
  }
  for (let i = 0; i < rowLines.length; i++) {
    if (Math.abs(imgY - rowLines[i]) < grabDist) return { type: 'row', index: i };
  }
  return null;
}

gridCanvas.addEventListener('mousedown', e => {
  const pos = canvasToImg(e);
  const hit = hitTest(pos.x, pos.y);
  if (hit) {
    dragging = hit;
    e.preventDefault();
  }
});

gridCanvas.addEventListener('mousemove', e => {
  const pos = canvasToImg(e);

  // Update cursor
  const hit = hitTest(pos.x, pos.y);
  if (dragging) {
    gridCanvas.style.cursor = dragging.type === 'col' ? 'col-resize' : 'row-resize';
  } else if (hit) {
    gridCanvas.style.cursor = hit.type === 'col' ? 'col-resize' : 'row-resize';
  } else {
    gridCanvas.style.cursor = 'default';
  }

  if (!dragging) return;

  const minGap = 20; // Minimum gap between lines in source px

  if (dragging.type === 'col') {
    const idx = dragging.index;
    const minX = (idx === 0 ? 0 : colLines[idx - 1]) + minGap;
    const maxX = (idx === colLines.length - 1 ? sourceImg.width : colLines[idx + 1]) - minGap;
    colLines[idx] = Math.round(Math.max(minX, Math.min(maxX, pos.x)));
  } else {
    const idx = dragging.index;
    const minY = (idx === 0 ? 0 : rowLines[idx - 1]) + minGap;
    const maxY = (idx === rowLines.length - 1 ? sourceImg.height : rowLines[idx + 1]) - minGap;
    rowLines[idx] = Math.round(Math.max(minY, Math.min(maxY, pos.y)));
  }

  drawGridPreview();
});

window.addEventListener('mouseup', () => {
  if (dragging) {
    dragging = null;
    gridCanvas.style.cursor = 'default';
  }
});

// Touch support for mobile
gridCanvas.addEventListener('touchstart', e => {
  const touch = e.touches[0];
  const pos = canvasToImg(touch);
  const hit = hitTest(pos.x, pos.y);
  if (hit) {
    dragging = hit;
    e.preventDefault();
  }
}, { passive: false });

gridCanvas.addEventListener('touchmove', e => {
  if (!dragging) return;
  e.preventDefault();
  const touch = e.touches[0];
  const pos = canvasToImg(touch);
  const minGap = 20;

  if (dragging.type === 'col') {
    const idx = dragging.index;
    const minX = (idx === 0 ? 0 : colLines[idx - 1]) + minGap;
    const maxX = (idx === colLines.length - 1 ? sourceImg.width : colLines[idx + 1]) - minGap;
    colLines[idx] = Math.round(Math.max(minX, Math.min(maxX, pos.x)));
  } else {
    const idx = dragging.index;
    const minY = (idx === 0 ? 0 : rowLines[idx - 1]) + minGap;
    const maxY = (idx === rowLines.length - 1 ? sourceImg.height : rowLines[idx + 1]) - minGap;
    rowLines[idx] = Math.round(Math.max(minY, Math.min(maxY, pos.y)));
  }

  drawGridPreview();
}, { passive: false });

gridCanvas.addEventListener('touchend', () => { dragging = null; });

// Re-init grid when rows/cols change
rowsInput.addEventListener('input', () => { initGridLines(); drawGridPreview(); });
colsInput.addEventListener('input', () => { initGridLines(); drawGridPreview(); });

// Reset grid to even spacing
btnResetGrid.addEventListener('click', () => { initGridLines(); drawGridPreview(); });

btnSplit.addEventListener('click', () => {
  const doUpscale = document.getElementById('upscale-check').checked;

  let src = sourceImg;
  let scale = 1;
  if (doUpscale) {
    scale = 2;
    const upCv = document.createElement('canvas');
    upCv.width = sourceImg.width * 2;
    upCv.height = sourceImg.height * 2;
    const upCtx = upCv.getContext('2d');
    upCtx.imageSmoothingEnabled = true;
    upCtx.imageSmoothingQuality = 'high';
    upCtx.drawImage(sourceImg, 0, 0, upCv.width, upCv.height);
    src = upCv;
  }

  // Build boundary arrays from grid lines (in source coords, then scale)
  const xBounds = [0, ...colLines, sourceImg.width].map(v => Math.round(v * scale));
  const yBounds = [0, ...rowLines, sourceImg.height].map(v => Math.round(v * scale));

  cells = [];
  for (let r = 0; r < yBounds.length - 1; r++) {
    for (let c = 0; c < xBounds.length - 1; c++) {
      const sx = xBounds[c];
      const sy = yBounds[r];
      const sw = xBounds[c + 1] - sx;
      const sh = yBounds[r + 1] - sy;
      const cv = document.createElement('canvas');
      cv.width = sw;
      cv.height = sh;
      cv.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
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
  let pickerSource = null;
  if (appMode === 'sheet' && sourceImg) {
    pickerSource = sourceImg;
  } else if (appMode === 'individual' && cells.length > 0) {
    pickerSource = cells[0].canvas;
  }
  if (!pickerSource) return;

  const ctx = pickerCanvas.getContext('2d');
  if (pickerSource instanceof HTMLImageElement) {
    pickerCanvas.width = pickerSource.width;
    pickerCanvas.height = pickerSource.height;
    ctx.drawImage(pickerSource, 0, 0);
  } else {
    pickerCanvas.width = pickerSource.width;
    pickerCanvas.height = pickerSource.height;
    ctx.drawImage(pickerSource, 0, 0);
  }
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
  bgStatus.textContent = '...';

  const selected = cells.filter(c => c.selected);
  for (let i = 0; i < selected.length; i++) {
    const cell = selected[i];
    if (bgMode === 'color' && pickedColor) {
      removeColorBg(cell, pickedColor, parseInt(tolInput.value));
    }
    bgBar.value = Math.round(((i + 1) / selected.length) * 100);
    bgStatus.textContent = `${i + 1} / ${selected.length}`;
    await new Promise(r => setTimeout(r, 0));
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
    // Pass 0: protect dark outline pixels
  // Mark dark pixels by storing brightness flag in a Set
  const protectedPixels = new Set();
  for (let i = 0; i < d.length; i += 4) {
    const brightness = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
    if (brightness < 80) {
      protectedPixels.add(i);
    }
  }

  const unifyRange = tolerance * 1.5;
  // Pass 1: unify near-bg colors
  for (let i = 0; i < d.length; i += 4) {
    if (protectedPixels.has(i)) continue;
    const dist = Math.sqrt((d[i] - color.r) ** 2 + (d[i+1] - color.g) ** 2 + (d[i+2] - color.b) ** 2);
    if (dist < unifyRange) { d[i] = color.r; d[i+1] = color.g; d[i+2] = color.b; }
  }
  // Pass 2: remove unified bg (wider fade band)
  const outer = tolerance + 60;
  for (let i = 0; i < d.length; i += 4) {
    if (protectedPixels.has(i)) continue;
    const dist = Math.sqrt((d[i] - color.r) ** 2 + (d[i+1] - color.g) ** 2 + (d[i+2] - color.b) ** 2);
    if (dist <= tolerance) { d[i+3] = 0; }
    else if (dist < outer) { d[i+3] = Math.round(((dist - tolerance) / (outer - tolerance)) * 255); }
  }
  // Pass 3: defringe - remove background color spill from semi-transparent pixels only
  for (let i = 0; i < d.length; i += 4) {
    if (d[i+3] === 0 || d[i+3] >= 250) continue;
    if (protectedPixels.has(i)) continue;
    const dr = d[i] - color.r;
    const dg = d[i+1] - color.g;
    const db = d[i+2] - color.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < outer * 1.2) {
      const strength = Math.pow(1 - Math.min(dist / (outer * 1.2), 1), 0.5);
      d[i]   = Math.max(0, Math.min(255, Math.round(d[i]   + dr * strength * 1.0)));
      d[i+1] = Math.max(0, Math.min(255, Math.round(d[i+1] + dg * strength * 1.0)));
      d[i+2] = Math.max(0, Math.min(255, Math.round(d[i+2] + db * strength * 1.0)));
      d[i+3] = Math.max(0, Math.round(d[i+3] * (1 - strength * 0.5)));
    }
  }
    const w = cell.canvas.width;
  const h = cell.canvas.height;
    // Pass 3.5: flood fill - remove isolated background-color regions
  const floodThreshold = tolerance * 2.5;
  let changed = true;
  const maxFloodPasses = 10;
  let floodPass = 0;
  while (changed && floodPass < maxFloodPasses) {
    changed = false;
    floodPass++;
    const snap = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (d[idx + 3] === 0) continue;
        if (protectedPixels.has(idx)) continue;
        const dist = Math.sqrt((d[idx] - color.r) ** 2 + (d[idx+1] - color.g) ** 2 + (d[idx+2] - color.b) ** 2);
        if (dist > floodThreshold) continue;
        let bgCount = 0;
        let total = 0;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            total++;
            const nIdx = (ny * w + nx) * 4;
            if (snap[nIdx + 3] === 0) { bgCount++; continue; }
            const nDist = Math.sqrt((snap[nIdx] - color.r) ** 2 + (snap[nIdx+1] - color.g) ** 2 + (snap[nIdx+2] - color.b) ** 2);
            if (nDist < floodThreshold) bgCount++;
          }
        }
        if (bgCount >= total * 0.5) {
          d[idx + 3] = 0;
          changed = true;
        }
      }
    }
  }
 // Pass 3.7: force-remove residual bg-colored opaque pixels
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (d[idx + 3] === 0) continue;
      if (protectedPixels.has(idx)) continue;
      const dist = Math.sqrt((d[idx] - color.r) ** 2 + (d[idx+1] - color.g) ** 2 + (d[idx+2] - color.b) ** 2);
      if (dist < floodThreshold) {
        // Check if any neighbor is transparent (within 4px radius)
        let nearTransparent = false;
        for (let dy = -4; dy <= 4 && !nearTransparent; dy++) {
          for (let dx = -4; dx <= 4 && !nearTransparent; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            if (d[(ny * w + nx) * 4 + 3] === 0) nearTransparent = true;
          }
        }
        if (nearTransparent) {
          d[idx + 3] = 0;
        }
      }
    }
  }
  // Pass 4: edge erode - remove fringe bordering transparent pixels

  const erodeThreshold = outer * 2.0;
  const erodePasses = 5;
  for (let pass = 0; pass < erodePasses; pass++) {
    const snapshot = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (d[idx + 3] === 0) continue;
        let hasTransparentNeighbor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) { hasTransparentNeighbor = true; continue; }
            if (snapshot[(ny * w + nx) * 4 + 3] === 0) hasTransparentNeighbor = true;
          }
        }
        if (hasTransparentNeighbor) {
          const dr = d[idx] - color.r, dg = d[idx+1] - color.g, db = d[idx+2] - color.b;
          const dist = Math.sqrt(dr*dr + dg*dg + db*db);
          if (dist < erodeThreshold) {
            d[idx + 3] = 0;
          } else {
            const softEdge = erodeThreshold * 1.3;
            if (dist < softEdge) {
              d[idx + 3] = Math.round(d[idx + 3] * ((dist - erodeThreshold) / (softEdge - erodeThreshold)));
            }
          }
        }
      }
    }
  }
  // Pass 5: color neutralize - remove background color cast from remaining semi-transparent pixels
  for (let i = 0; i < d.length; i += 4) {
    if (d[i+3] === 0 || d[i+3] >= 250) continue;
    const dr = d[i] - color.r, dg = d[i+1] - color.g, db = d[i+2] - color.b;
    const dist = Math.sqrt(dr*dr + dg*dg + db*db);
    if (dist < outer * 2.5) {
      const a = d[i+3] / 255;
      d[i]   = Math.min(255, Math.max(0, Math.round(d[i]   + (d[i]   - color.r) * (1 - a) * 1.2)));
      d[i+1] = Math.min(255, Math.max(0, Math.round(d[i+1] + (d[i+1] - color.g) * (1 - a) * 1.2)));
      d[i+2] = Math.min(255, Math.max(0, Math.round(d[i+2] + (d[i+2] - color.b) * (1 - a) * 1.2)));
    }
  }
  // Pass 6: anti-alias - smooth jagged edges after erosion
  const aaData = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      if (d[idx + 3] === 0) continue;
      let transCount = 0;
      let totalNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          totalNeighbors++;
          const nIdx = ((y + dy) * w + (x + dx)) * 4;
          if (aaData[nIdx + 3] === 0) transCount++;
        }
      }
      if (transCount > 0 && transCount < totalNeighbors) {
        const opaqueFraction = (totalNeighbors - transCount) / totalNeighbors;
        d[idx + 3] = Math.round(d[idx + 3] * opaqueFraction);
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
    alert(`スタンプ数は ${allowed.join('/')} 個のいずれかにしてください（現在: ${selected.length}個）`);
    btnPackage.disabled = false;
    return;
  }

  const zip = new JSZip();
  const mainIdx = parseInt(mainSelect.value);
  const tabIdx = parseInt(tabSelect.value);

  zip.file('main.png', await resizeToBlob(cells[mainIdx].canvas, 240, 240));
  zip.file('tab.png', await resizeToBlob(cells[tabIdx].canvas, 96, 74));

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
  if (w < minSide || h < minSide) {
    ratio = Math.max(minSide / srcCanvas.width, minSide / srcCanvas.height);
    w = Math.round(srcCanvas.width * ratio);
    h = Math.round(srcCanvas.height * ratio);
  }
  w = w % 2 === 0 ? w : w + 1;
  h = h % 2 === 0 ? h : h + 1;
  if (w > maxW) w = maxW;
  if (h > maxH) h = maxH;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d').drawImage(srcCanvas, 0, 0, w, h);
  return new Promise(r => cv.toBlob(r, 'image/png'));
}
