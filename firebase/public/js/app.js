/**
 * Package Extractor - Main Application Script
 */

import { PackageExtractor } from './extractor.js';

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const progressContainer = document.getElementById('progress-container');
const progressStatus = document.getElementById('progress-status');
const progressDetail = document.getElementById('progress-detail');
const progressBar = document.getElementById('progress-bar');
const viewerContainer = document.getElementById('viewer-container');

// Info Bar Elements
const pkgNameEl = document.getElementById('pkg-name');
const pkgCountEl = document.getElementById('pkg-count');
const pkgSizeEl = document.getElementById('pkg-size');
const resetBtn = document.getElementById('reset-btn');
const downloadZipBtn = document.getElementById('download-zip-btn');

// Toolbar Elements
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const filterBtns = document.querySelectorAll('.filter-btn');

// Workspace Elements
const treeContainer = document.getElementById('tree-container');
const assetListEl = document.getElementById('asset-list');
const noResultsEl = document.getElementById('no-results');
const previewPanel = document.getElementById('preview-panel');
const previewBody = document.getElementById('preview-body');
const closePreviewBtn = document.getElementById('close-preview-btn');
const expandAllBtn = document.getElementById('expand-all-btn');
const collapseAllBtn = document.getElementById('collapse-all-btn');

// App State
const extractor = new PackageExtractor();
let currentPackageName = '';
let allAssets = [];
let filteredAssets = [];
let selectedPathPrefix = '';
let activeFilter = 'all';
let searchQuery = '';
let activeAsset = null;

// Initialize
initEvents();

function initEvents() {
  // File Selection
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag and Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    viewerContainer.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
    allAssets = [];
    filteredAssets = [];
  });

  // Download ZIP
  downloadZipBtn.addEventListener('click', async () => {
    if (filteredAssets.length === 0) return;
    try {
      downloadZipBtn.disabled = true;
      const originalText = downloadZipBtn.innerHTML;
      downloadZipBtn.innerHTML = '<span>⏳</span> ZIP生成中...';
      
      const zipName = currentPackageName ? currentPackageName.replace(/\.unitypackage$/i, '') + '.zip' : 'assets.zip';
      await extractor.downloadZip(filteredAssets, zipName);
      
      downloadZipBtn.innerHTML = originalText;
      downloadZipBtn.disabled = false;
    } catch (err) {
      alert('ZIPの作成に失敗しました: ' + err.message);
      downloadZipBtn.disabled = false;
    }
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    clearSearchBtn.classList.toggle('hidden', searchQuery.length === 0);
    applyFilters();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    applyFilters();
  });

  // Filters
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.type;
      applyFilters();
    });
  });

  // Preview Close
  closePreviewBtn.addEventListener('click', () => {
    previewPanel.classList.add('hidden');
  });

  // Tree Controls
  expandAllBtn.addEventListener('click', () => {
    document.querySelectorAll('.tree-children').forEach(el => el.classList.add('show'));
    document.querySelectorAll('.tree-arrow').forEach(el => el.classList.add('expanded'));
  });

  collapseAllBtn.addEventListener('click', () => {
    document.querySelectorAll('.tree-children').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.tree-arrow').forEach(el => el.classList.remove('expanded'));
  });
}

/**
 * .unitypackage の読み込み・解析開始
 */
async function handleFile(file) {
  if (!file.name.endsWith('.unitypackage')) {
    alert('「.unitypackage」ファイルを選択してください。');
    return;
  }

  currentPackageName = file.name;
  dropZone.classList.add('hidden');
  progressContainer.classList.remove('hidden');
  progressBar.style.width = '0%';
  progressStatus.textContent = 'パッケージを解析中...';
  progressDetail.textContent = '準備中';

  try {
    const assets = await extractor.extract(file, ({ percent, message }) => {
      progressBar.style.width = `${percent}%`;
      progressDetail.textContent = message;
    });

    allAssets = assets;
    showViewer(file);
  } catch (err) {
    alert('パッケージの展開に失敗しました:\n' + err.message);
    progressContainer.classList.add('hidden');
    dropZone.classList.remove('hidden');
  }
}

/**
 * 解析完了後のUI表示初期化
 */
function showViewer(file) {
  progressContainer.classList.add('hidden');
  viewerContainer.classList.remove('hidden');

  // Info Bar
  pkgNameEl.textContent = currentPackageName;
  pkgCountEl.textContent = allAssets.length.toLocaleString();

  const totalBytes = allAssets.reduce((sum, a) => sum + (a.size || 0), 0);
  pkgSizeEl.textContent = formatFileSize(totalBytes);

  // ツリー描画
  renderTree(extractor.tree);

  // リスト描画
  applyFilters();
}

/**
 * フォルダツリーの描画
 */
function renderTree(rootNode) {
  treeContainer.innerHTML = '';

  function createTreeNodeElement(node) {
    const div = document.createElement('div');
    div.className = 'tree-node';

    const label = document.createElement('div');
    label.className = 'tree-label';
    if (selectedPathPrefix === node.path) {
      label.classList.add('active');
    }

    const hasChildren = node.isDirectory && node.children && node.children.size > 0;

    if (hasChildren) {
      const arrow = document.createElement('span');
      arrow.className = 'tree-arrow expanded';
      arrow.textContent = '▶';
      label.appendChild(arrow);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'tree-arrow';
      spacer.textContent = '';
      label.appendChild(spacer);
    }

    const icon = document.createElement('span');
    icon.textContent = node.isDirectory ? '📁' : getFileIcon(node.name);
    label.appendChild(icon);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = node.name === 'root' ? 'Assets' : node.name;
    label.appendChild(nameSpan);

    div.appendChild(label);

    let childrenContainer = null;
    if (hasChildren) {
      childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children show';

      // フォルダ優先でソート
      const sortedEntries = Array.from(node.children.values()).sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });

      for (const childNode of sortedEntries) {
        childrenContainer.appendChild(createTreeNodeElement(childNode));
      }
      div.appendChild(childrenContainer);
    }

    // クリックイベント
    label.addEventListener('click', (e) => {
      e.stopPropagation();

      // 矢印トグル
      if (hasChildren && childrenContainer) {
        const arrow = label.querySelector('.tree-arrow');
        const isShown = childrenContainer.classList.toggle('show');
        if (arrow) arrow.classList.toggle('expanded', isShown);
      }

      // 選択フォルダでフィルタ
      document.querySelectorAll('.tree-label').forEach(el => el.classList.remove('active'));
      label.classList.add('active');
      selectedPathPrefix = node.path === '' ? '' : node.path;
      applyFilters();
    });

    return div;
  }

  treeContainer.appendChild(createTreeNodeElement(rootNode));
}

/**
 * フィルタと検索を適用してアセット一覧を更新
 */
function applyFilters() {
  filteredAssets = allAssets.filter(asset => {
    // ディレクトリ絞り込み
    if (selectedPathPrefix && !asset.path.startsWith(selectedPathPrefix)) {
      return false;
    }

    // 検索語句絞り込み
    if (searchQuery) {
      const matchPath = asset.path.toLowerCase().includes(searchQuery);
      if (!matchPath) return false;
    }

    // 種類フィルタ
    if (activeFilter !== 'all') {
      const ext = getExtension(asset.name);
      if (activeFilter === 'textures' && !['png', 'jpg', 'jpeg', 'tga', 'psd', 'tif', 'tiff'].includes(ext)) return false;
      if (activeFilter === 'models' && !['fbx', 'obj', 'blend', 'dae'].includes(ext)) return false;
      if (activeFilter === 'scripts' && !['cs', 'js', 'shader', 'cginc', 'hlsl', 'compute', 'json'].includes(ext)) return false;
      if (activeFilter === 'audio' && !['wav', 'mp3', 'ogg', 'aiff'].includes(ext)) return false;
      if (activeFilter === 'other') {
        const known = ['png', 'jpg', 'jpeg', 'tga', 'psd', 'tif', 'tiff', 'fbx', 'obj', 'blend', 'dae', 'cs', 'js', 'shader', 'cginc', 'hlsl', 'compute', 'json', 'wav', 'mp3', 'ogg', 'aiff'];
        if (known.includes(ext)) return false;
      }
    }

    return true;
  });

  renderAssetList(filteredAssets);
}

/**
 * アセットリストのDOM生成
 */
function renderAssetList(assets) {
  assetListEl.innerHTML = '';

  if (assets.length === 0) {
    noResultsEl.classList.remove('hidden');
    return;
  }
  noResultsEl.classList.add('hidden');

  for (const asset of assets) {
    const row = document.createElement('div');
    row.className = 'asset-row';
    if (activeAsset === asset) {
      row.classList.add('active');
    }

    // アイコン＆名前
    const nameCol = document.createElement('div');
    nameCol.className = 'col-name';

    const icon = document.createElement('span');
    icon.className = 'asset-icon';
    icon.textContent = getFileIcon(asset.name);
    nameCol.appendChild(icon);

    const pathText = document.createElement('span');
    pathText.className = 'asset-path-text';
    pathText.textContent = asset.path;
    pathText.title = asset.path;
    nameCol.appendChild(pathText);

    // 形式
    const typeCol = document.createElement('div');
    typeCol.className = 'col-type';
    typeCol.textContent = getExtension(asset.name).toUpperCase() || 'FILE';

    // サイズ
    const sizeCol = document.createElement('div');
    sizeCol.className = 'col-size';
    sizeCol.textContent = asset.isDirectory ? '-' : formatFileSize(asset.size);

    // 操作
    const actionCol = document.createElement('div');
    actionCol.className = 'col-action';

    if (!asset.isDirectory && asset.assetData) {
      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn-download-single';
      dlBtn.textContent = '保存';
      dlBtn.title = 'このアセットのみダウンロード';
      dlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        extractor.downloadAsset(asset);
      });
      actionCol.appendChild(dlBtn);
    }

    row.appendChild(nameCol);
    row.appendChild(typeCol);
    row.appendChild(sizeCol);
    row.appendChild(actionCol);

    // 行クリックでプレビュー表示
    row.addEventListener('click', () => {
      document.querySelectorAll('.asset-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      activeAsset = asset;
      showPreview(asset);
    });

    assetListEl.appendChild(row);
  }
}

/**
 * プレビュー表示
 */
function showPreview(asset) {
  previewPanel.classList.remove('hidden');
  previewBody.innerHTML = '';

  const ext = getExtension(asset.name);
  const isImage = ['png', 'jpg', 'jpeg', 'tga', 'tif', 'tiff'].includes(ext);
  const isText = ['cs', 'js', 'json', 'txt', 'shader', 'cginc', 'hlsl', 'compute', 'xml', 'md'].includes(ext);

  // 画像プレビュー
  if (isImage && asset.assetData) {
    const container = document.createElement('div');
    container.className = 'preview-img-container';
    const img = document.createElement('img');
    img.className = 'preview-img';
    const blob = new Blob([asset.assetData]);
    img.src = URL.createObjectURL(blob);
    container.appendChild(img);
    previewBody.appendChild(container);
  } else if (asset.previewData) {
    // Unity が生成した preview.png がある場合
    const container = document.createElement('div');
    container.className = 'preview-img-container';
    const img = document.createElement('img');
    img.className = 'preview-img';
    const blob = new Blob([asset.previewData]);
    img.src = URL.createObjectURL(blob);
    container.appendChild(img);
    previewBody.appendChild(container);
  } else if (isText && asset.assetData) {
    // テキスト/コードプレビュー
    try {
      const text = new TextDecoder('utf-8').decode(asset.assetData);
      const codeBlock = document.createElement('pre');
      codeBlock.className = 'preview-code';
      codeBlock.textContent = text.slice(0, 50000) + (text.length > 50000 ? '\n\n... (以降省略)' : '');
      previewBody.appendChild(codeBlock);
    } catch (e) {
      const p = document.createElement('p');
      p.className = 'preview-placeholder';
      p.textContent = 'テキストのデコードに失敗しました。';
      previewBody.appendChild(p);
    }
  } else {
    const p = document.createElement('p');
    p.className = 'preview-placeholder';
    p.textContent = 'プレビュー非対応のフォーマットです。';
    previewBody.appendChild(p);
  }

  // メタデータ表示
  const metaContainer = document.createElement('div');
  metaContainer.className = 'preview-meta';
  metaContainer.innerHTML = `
    <div class="meta-row">
      <span class="meta-key">名前:</span>
      <span class="meta-val">${asset.name}</span>
    </div>
    <div class="meta-row">
      <span class="meta-key">サイズ:</span>
      <span class="meta-val">${formatFileSize(asset.size)}</span>
    </div>
    <div class="meta-row">
      <span class="meta-key">GUID:</span>
      <span class="meta-val">${asset.guid}</span>
    </div>
  `;
  previewBody.appendChild(metaContainer);
}

// ユーティリティ
function getExtension(filename) {
  if (!filename) return '';
  const idx = filename.lastIndexOf('.');
  return idx !== -1 ? filename.slice(idx + 1).toLowerCase() : '';
}

function getFileIcon(filename) {
  const ext = getExtension(filename);
  if (['png', 'jpg', 'jpeg', 'tga', 'psd', 'tif', 'tiff'].includes(ext)) return '🖼️';
  if (['fbx', 'obj', 'blend', 'dae'].includes(ext)) return '🧊';
  if (['cs', 'js', 'shader', 'cginc', 'hlsl'].includes(ext)) return '📜';
  if (['wav', 'mp3', 'ogg'].includes(ext)) return '🎵';
  if (['mat', 'prefab', 'unity'].includes(ext)) return '📦';
  return '📄';
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
