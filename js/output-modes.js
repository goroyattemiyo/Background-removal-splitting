// ============================================
// Output mode controller
// LINE delivery mode / arbitrary split download mode
// ============================================

const $ = id => document.getElementById(id);

let outputMode = null; // 'line' | 'split'

const stepUpload = $('step-upload');
const stepSplit = $('step-split');
const stepSelect = $('step-select');
const stepBg = $('step-bg');
const stepDownload = $('step-download');

const lineInputChoice = $('line-input-choice');
const splitUploadIntro = $('split-upload-intro');
const uploadSheet = $('upload-sheet');
const uploadIndividual = $('upload-individual');
const lineSelectControls = $('line-select-controls');
const lineDownloadPanel = $('line-download-panel');
const splitDownloadPanel = $('split-download-panel');
const countWarning = $('count-warning');

const uploadStepTitle = $('upload-step-title');
const splitStepTitle = $('split-step-title');
const selectStepTitle = $('select-step-title');
const bgStepTitle = $('bg-step-title');
const downloadStepTitle = $('download-step-title');
const selectHint = $('select-hint');

const btnSplitDownload = $('btn-split-download');
const splitPkgProgress = $('split-pkg-progress');
const splitPkgBar = $('split-pkg-bar');
const splitPkgStatus = $('split-pkg-status');

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle('hidden', hidden);
}

function getInputMode() {
  return document.querySelector('input[name="app-mode"]:checked')?.value || null;
}

function setPurposeActive(mode) {
  $('purpose-line-label').classList.toggle('active', mode === 'line');
  $('purpose-split-label').classList.toggle('active', mode === 'split');
}

function resetInputChoice() {
  // app.js の内部状態と後続ステップを確実に初期化してから、
  // LINEモードでは入力方法を未選択状態に戻す。
  const sheetRadio = document.querySelector('input[name="app-mode"][value="sheet"]');
  if (sheetRadio) {
    sheetRadio.checked = true;
    sheetRadio.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.querySelectorAll('input[name="app-mode"]').forEach(radio => {
    radio.checked = false;
  });
  $('mode-sheet-label').classList.remove('active');
  $('mode-individual-label').classList.remove('active');
  setHidden(uploadSheet, true);
  setHidden(uploadIndividual, true);
}

function activateSheetInput() {
  const sheetRadio = document.querySelector('input[name="app-mode"][value="sheet"]');
  if (!sheetRadio) return;
  sheetRadio.checked = true;
  sheetRadio.dispatchEvent(new Event('change', { bubbles: true }));
}

function updateStepLabels() {
  const inputMode = getInputMode();

  if (outputMode === 'split') {
    uploadStepTitle.textContent = '② シート画像をアップロード';
    splitStepTitle.textContent = '③ グリッド設定＆分割';
    selectStepTitle.textContent = '④ ダウンロードする画像を選択';
    downloadStepTitle.textContent = '⑤ 分割画像をダウンロード';
    selectHint.textContent = '※ 必要な画像だけ選択できます。枚数制限はありません。';
    return;
  }

  uploadStepTitle.textContent = '② 画像の用意方法を選択';
  if (inputMode === 'individual') {
    selectStepTitle.textContent = '③ スタンプを選択';
    bgStepTitle.textContent = '④ 背景除去（任意）';
    downloadStepTitle.textContent = '⑤ LINEパッケージ生成';
  } else {
    splitStepTitle.textContent = '③ グリッド設定＆分割';
    selectStepTitle.textContent = '④ スタンプを選択';
    bgStepTitle.textContent = '⑤ 背景除去（任意）';
    downloadStepTitle.textContent = '⑥ LINEパッケージ生成';
  }
  selectHint.textContent = '※ 番号はセル左上の数字です。選んだセルの画像がLINE用にリサイズされます。';
}

function applyOutputModeView() {
  document.body.dataset.outputMode = outputMode || '';
  updateStepLabels();

  if (outputMode === 'split') {
    setHidden(lineInputChoice, true);
    setHidden(splitUploadIntro, false);
    setHidden(uploadIndividual, true);

    // app.js は選択画面表示時に背景除去とLINEダウンロードも表示するため、
    // 任意分割モードではここで必要な画面だけに絞る。
    if (!stepSelect.classList.contains('hidden')) {
      setHidden(stepBg, true);
      setHidden(stepDownload, false);
    }
    setHidden(lineSelectControls, true);
    setHidden(lineDownloadPanel, true);
    setHidden(splitDownloadPanel, false);
    if (countWarning) countWarning.classList.add('hidden');
  } else if (outputMode === 'line') {
    setHidden(splitUploadIntro, true);
    setHidden(lineInputChoice, false);
    setHidden(lineSelectControls, false);
    setHidden(lineDownloadPanel, false);
    setHidden(splitDownloadPanel, true);
  }
}

document.querySelectorAll('input[name="output-mode"]').forEach(radio => {
  radio.addEventListener('change', event => {
    outputMode = event.target.value;
    setPurposeActive(outputMode);
    setHidden(stepUpload, false);

    if (outputMode === 'line') {
      resetInputChoice();
      setHidden(lineInputChoice, false);
      setHidden(splitUploadIntro, true);
    } else {
      setHidden(lineInputChoice, true);
      setHidden(splitUploadIntro, false);
      activateSheetInput();
    }

    applyOutputModeView();
    stepUpload.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.querySelectorAll('input[name="app-mode"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (outputMode !== 'line') return;
    updateStepLabels();
  });
});

// app.js が非同期で個別画像を読み込んだ後にも表示状態を補正できるよう監視する。
const workflowObserver = new MutationObserver(() => {
  if (!outputMode) return;
  applyOutputModeView();
});

[stepSplit, stepSelect, stepBg, stepDownload].forEach(el => {
  workflowObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
});

btnSplitDownload.addEventListener('click', async () => {
  const selectedItems = [...document.querySelectorAll('#cell-grid .cell-item.selected')];
  if (selectedItems.length === 0) {
    alert('ダウンロードする画像を1枚以上選択してください。');
    return;
  }

  btnSplitDownload.disabled = true;
  setHidden(splitPkgProgress, false);
  splitPkgBar.value = 0;
  splitPkgStatus.textContent = `0 / ${selectedItems.length}`;

  try {
    const zip = new JSZip();
    const totalCellCount = document.querySelectorAll('#cell-grid .cell-item').length;
    const digits = Math.max(2, String(totalCellCount).length);

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const img = item.querySelector('img');
      const cellNumber = parseInt(item.querySelector('.cell-num')?.textContent || String(i + 1), 10);
      const response = await fetch(img.src);
      const blob = await response.blob();
      const filename = `${String(cellNumber).padStart(digits, '0')}.png`;
      zip.file(filename, blob);

      splitPkgBar.value = Math.round(((i + 1) / selectedItems.length) * 80);
      splitPkgStatus.textContent = `${i + 1} / ${selectedItems.length}`;
    }

    splitPkgStatus.textContent = 'ZIP生成中...';
    const content = await zip.generateAsync(
      { type: 'blob' },
      metadata => {
        splitPkgBar.value = 80 + Math.round(metadata.percent * 0.2);
      }
    );

    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'split_images.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    splitPkgBar.value = 100;
    splitPkgStatus.textContent = `${selectedItems.length}枚 完了`;
  } catch (error) {
    console.error(error);
    splitPkgStatus.textContent = 'ZIP生成に失敗しました';
    alert('ZIPの生成に失敗しました。画像を再読み込みしてもう一度お試しください。');
  } finally {
    btnSplitDownload.disabled = false;
  }
});