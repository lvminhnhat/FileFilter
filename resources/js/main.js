const APP_VERSION = '0.0.4';
const GITHUB_REPO = 'lvminhnhat/FileFilter';

let selectedFolder = '';
let imageResults = [];
let currentPage = 0;
const ITEMS_PER_PAGE = 50;
let isLoadingThumbs = false;

const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif'];

Neutralino.init();

Neutralino.events.on('ready', () => {
  initEventListeners();
  checkForUpdates();
  document.getElementById('appVersion').textContent = `v${APP_VERSION}`;
});

function initEventListeners() {
  document.getElementById('btnSelectFolder').addEventListener('click', selectFolder);
  document.getElementById('btnScan').addEventListener('click', startScan);
  document.getElementById('btnReset').addEventListener('click', resetFilters);
  document.getElementById('btnExport').addEventListener('click', exportResults);
  document.getElementById('btnCopyPaths').addEventListener('click', copyPaths);
  document.getElementById('btnCopyTo').addEventListener('click', () => copyOrMoveImages('copy'));
  document.getElementById('btnMoveTo').addEventListener('click', () => copyOrMoveImages('move'));
  document.getElementById('formatAll').addEventListener('change', toggleFormatList);
  document.getElementById('enableSizeFilter').addEventListener('change', toggleSizeFilter);
  document.getElementById('enableDimensionFilter').addEventListener('change', toggleDimensionFilter);
  document.getElementById('enableWidthFilter').addEventListener('change', toggleWidthFilter);
  document.getElementById('enableHeightFilter').addEventListener('change', toggleHeightFilter);
  
  const resultsGrid = document.getElementById('resultsGrid');
  resultsGrid.addEventListener('scroll', handleScroll);
}

async function checkForUpdates() {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    if (!response.ok) return;
    
    const data = await response.json();
    const latestVersion = data.tag_name.replace('v', '');
    
    if (compareVersions(latestVersion, APP_VERSION) > 0) {
      showUpdateNotification(latestVersion, data.html_url);
    }
  } catch (err) {
    console.log('Không thể kiểm tra cập nhật:', err);
  }
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

function showUpdateNotification(newVersion, downloadUrl) {
  const notification = document.createElement('div');
  notification.className = 'update-notification';
  notification.innerHTML = `
    <span>Phiên bản mới ${newVersion} đã có!</span>
    <button onclick="window.open('${downloadUrl}')">Tải về</button>
    <button onclick="this.parentElement.remove()" class="btn-close">×</button>
  `;
  document.body.appendChild(notification);
}

async function selectFolder() {
  try {
    const folder = await Neutralino.os.showFolderDialog('Chọn thư mục chứa ảnh');
    if (folder) {
      selectedFolder = folder;
      document.getElementById('folderPath').value = folder;
      document.getElementById('btnScan').disabled = false;
      setStatus('Đã chọn thư mục: ' + folder);
    }
  } catch (err) {
    console.error('Lỗi chọn thư mục:', err);
  }
}

function toggleFormatList(e) {
  const formatList = document.getElementById('formatList');
  formatList.classList.toggle('hidden', e.target.checked);
}

function toggleSizeFilter(e) {
  const sizeInputs = document.getElementById('sizeFilterInputs');
  sizeInputs.classList.toggle('hidden', !e.target.checked);
}

function toggleDimensionFilter(e) {
  const dimensionInputs = document.getElementById('dimensionFilterInputs');
  dimensionInputs.classList.toggle('hidden', !e.target.checked);
}

function toggleWidthFilter(e) {
  const widthInputs = document.getElementById('widthInputs');
  widthInputs.querySelectorAll('input[type="number"]').forEach(input => {
    input.disabled = !e.target.checked;
  });
}

function toggleHeightFilter(e) {
  const heightInputs = document.getElementById('heightInputs');
  heightInputs.querySelectorAll('input[type="number"]').forEach(input => {
    input.disabled = !e.target.checked;
  });
}

async function startScan() {
  if (!selectedFolder) return;

  const filters = getFilters();
  showLoading(true);
  setStatus('Đang quét...');
  imageResults = [];
  currentPage = 0;

  try {
    await scanDirectory(selectedFolder, filters, filters.includeSubfolders);
    displayResults();
    setStatus(`Hoàn thành! Tìm thấy ${imageResults.length} ảnh`);
  } catch (err) {
    console.error('Lỗi quét:', err);
    setStatus('Lỗi: ' + err.message);
  }

  showLoading(false);
}

function getFilters() {
  const formatAll = document.getElementById('formatAll').checked;
  let formats = SUPPORTED_FORMATS;

  if (!formatAll) {
    formats = [];
    document.querySelectorAll('#formatList input:checked').forEach(cb => {
      const val = cb.value;
      formats.push(val);
      if (val === 'jpg') formats.push('jpeg');
      if (val === 'tiff') formats.push('tif');
    });
  }

  const enableSizeFilter = document.getElementById('enableSizeFilter').checked;
  const enableDimensionFilter = document.getElementById('enableDimensionFilter').checked;
  const enableWidthFilter = enableDimensionFilter && document.getElementById('enableWidthFilter').checked;
  const enableHeightFilter = enableDimensionFilter && document.getElementById('enableHeightFilter').checked;

  return {
    includeSubfolders: document.getElementById('includeSubfolders').checked,
    formats,
    enableDimensionFilter,
    enableWidthFilter,
    enableHeightFilter,
    minWidth: enableWidthFilter ? (parseInt(document.getElementById('minWidth').value) || 0) : 0,
    maxWidth: enableWidthFilter ? (parseInt(document.getElementById('maxWidth').value) || Infinity) : Infinity,
    minHeight: enableHeightFilter ? (parseInt(document.getElementById('minHeight').value) || 0) : 0,
    maxHeight: enableHeightFilter ? (parseInt(document.getElementById('maxHeight').value) || Infinity) : Infinity,
    enableSizeFilter,
    minSize: enableSizeFilter ? (parseInt(document.getElementById('minSize').value) || 0) * 1024 : 0,
    maxSize: enableSizeFilter ? (parseInt(document.getElementById('maxSize').value) || Infinity) * 1024 : Infinity
  };
}

async function scanDirectory(dirPath, filters, recursive) {
  try {
    const entries = await Neutralino.filesystem.readDirectory(dirPath);

    for (const entry of entries) {
      if (entry.entry === '.' || entry.entry === '..') continue;

      const fullPath = dirPath + '/' + entry.entry;

      if (entry.type === 'DIRECTORY' && recursive) {
        await scanDirectory(fullPath, filters, recursive);
      } else if (entry.type === 'FILE') {
        await processFile(fullPath, filters);
      }
    }
  } catch (err) {
    console.error('Lỗi đọc thư mục:', dirPath, err);
  }
}

async function processFile(filePath, filters) {
  const ext = filePath.split('.').pop().toLowerCase();

  if (!filters.formats.includes(ext)) return;

  try {
    const stats = await Neutralino.filesystem.getStats(filePath);
    const fileSize = stats.size;

    if (filters.enableSizeFilter) {
      if (fileSize < filters.minSize || fileSize > filters.maxSize) return;
    }

    const dimensions = await getImageDimensions(filePath, ext);

    if (dimensions) {
      if (filters.enableWidthFilter) {
        if (dimensions.width < filters.minWidth || dimensions.width > filters.maxWidth) return;
      }
      if (filters.enableHeightFilter) {
        if (dimensions.height < filters.minHeight || dimensions.height > filters.maxHeight) return;
      }
    }

    imageResults.push({
      path: filePath,
      name: filePath.split('/').pop(),
      size: fileSize,
      width: dimensions?.width || 0,
      height: dimensions?.height || 0,
      ext
    });

    document.getElementById('scanProgress').textContent = `Đã tìm: ${imageResults.length} ảnh`;
  } catch (err) {
    console.error('Lỗi xử lý file:', filePath, err);
  }
}

async function getImageDimensions(filePath, ext) {
  if (ext === 'svg') return null;

  try {
    const data = await Neutralino.filesystem.readBinaryFile(filePath);
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

async function loadImageAsBase64(filePath) {
  try {
    const data = await Neutralino.filesystem.readBinaryFile(filePath);
    const ext = filePath.split('.').pop().toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'bmp') mimeType = 'image/bmp';
    else if (ext === 'svg') mimeType = 'image/svg+xml';
    else if (ext === 'ico') mimeType = 'image/x-icon';
    else if (ext === 'tiff' || ext === 'tif') mimeType = 'image/tiff';
    
    const base64 = arrayBufferToBase64(data);
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function displayResults() {
  const grid = document.getElementById('resultsGrid');
  document.getElementById('resultCount').textContent = `(${imageResults.length} ảnh)`;

  if (imageResults.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>Không tìm thấy ảnh phù hợp</p></div>';
    toggleResultButtons(false);
    return;
  }

  toggleResultButtons(true);
  currentPage = 0;
  grid.innerHTML = '';
  
  loadMoreItems();
}

function loadMoreItems() {
  if (isLoadingThumbs) return;
  
  const grid = document.getElementById('resultsGrid');
  const start = currentPage * ITEMS_PER_PAGE;
  const end = Math.min(start + ITEMS_PER_PAGE, imageResults.length);
  
  if (start >= imageResults.length) return;
  
  const fragment = document.createDocumentFragment();
  
  for (let i = start; i < end; i++) {
    const img = imageResults[i];
    const card = document.createElement('div');
    card.className = 'image-card';
    card.onclick = () => openImage(i);
    card.title = img.path;
    card.innerHTML = `
      <div class="thumb" id="thumb-${i}">
        <span class="loading-thumb">...</span>
      </div>
      <div class="info">
        <div class="name">${img.name}</div>
        <div class="meta">${img.width}x${img.height} | ${formatSize(img.size)}</div>
      </div>
    `;
    fragment.appendChild(card);
  }
  
  grid.appendChild(fragment);
  currentPage++;
  
  loadVisibleThumbnails(start, end);
}

async function loadVisibleThumbnails(start, end) {
  isLoadingThumbs = true;
  
  const batchSize = 5;
  for (let i = start; i < end; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, end); j++) {
      batch.push(loadSingleThumbnail(j));
    }
    await Promise.all(batch);
    
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  isLoadingThumbs = false;
}

async function loadSingleThumbnail(index) {
  const img = imageResults[index];
  const thumbEl = document.getElementById(`thumb-${index}`);
  if (!thumbEl) return;

  try {
    const dataUrl = await loadImageAsBase64(img.path);
    if (dataUrl && thumbEl) {
      thumbEl.innerHTML = `<img src="${dataUrl}" alt="${img.name}">`;
    } else if (thumbEl) {
      thumbEl.innerHTML = '<span>Không tải được</span>';
    }
  } catch {
    if (thumbEl) {
      thumbEl.innerHTML = '<span>Lỗi</span>';
    }
  }
}

function handleScroll(e) {
  const grid = e.target;
  const scrollBottom = grid.scrollHeight - grid.scrollTop - grid.clientHeight;
  
  if (scrollBottom < 200 && !isLoadingThumbs) {
    loadMoreItems();
  }
}

function toggleResultButtons(enabled) {
  document.getElementById('btnExport').disabled = !enabled;
  document.getElementById('btnCopyPaths').disabled = !enabled;
  document.getElementById('btnCopyTo').disabled = !enabled;
  document.getElementById('btnMoveTo').disabled = !enabled;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function openImage(idx) {
  const img = imageResults[idx];
  try {
    await Neutralino.os.open(img.path);
  } catch (err) {
    console.error('Lỗi mở file:', err);
  }
}

async function copyOrMoveImages(action) {
  if (imageResults.length === 0) return;

  try {
    const destFolder = await Neutralino.os.showFolderDialog(
      action === 'copy' ? 'Chọn thư mục đích để copy ảnh' : 'Chọn thư mục đích để di chuyển ảnh'
    );

    if (!destFolder) return;

    setStatus(`Đang ${action === 'copy' ? 'copy' : 'di chuyển'} ${imageResults.length} ảnh...`);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < imageResults.length; i++) {
      const img = imageResults[i];
      try {
        const fileName = img.name;
        const destPath = destFolder + '/' + fileName;
        
        const fileData = await Neutralino.filesystem.readBinaryFile(img.path);
        await Neutralino.filesystem.writeBinaryFile(destPath, fileData);
        
        if (action === 'move') {
          await Neutralino.filesystem.removeFile(img.path);
        }
        
        successCount++;
        setStatus(`Đang ${action === 'copy' ? 'copy' : 'di chuyển'}: ${successCount}/${imageResults.length}`);
      } catch (err) {
        console.error(`Lỗi ${action} file:`, img.path, err);
        errorCount++;
      }
    }

    if (action === 'move' && successCount > 0) {
      imageResults = [];
      displayResults();
    }

    setStatus(`Hoàn thành! ${action === 'copy' ? 'Đã copy' : 'Đã di chuyển'} ${successCount} ảnh${errorCount > 0 ? `, ${errorCount} lỗi` : ''}`);
  } catch (err) {
    console.error('Lỗi:', err);
    setStatus('Lỗi: ' + err.message);
  }
}

async function exportResults() {
  if (imageResults.length === 0) return;

  try {
    const savePath = await Neutralino.os.showSaveDialog('Lưu danh sách', {
      filters: [{ name: 'Text files', extensions: ['txt'] }]
    });

    if (savePath) {
      const content = imageResults.map(img =>
        `${img.path}\t${img.width}x${img.height}\t${formatSize(img.size)}`
      ).join('\n');

      await Neutralino.filesystem.writeFile(savePath, content);
      setStatus('Đã xuất danh sách: ' + savePath);
    }
  } catch (err) {
    console.error('Lỗi xuất file:', err);
  }
}

async function copyPaths() {
  if (imageResults.length === 0) return;

  const paths = imageResults.map(img => img.path).join('\n');
  try {
    await Neutralino.clipboard.writeText(paths);
    setStatus('Đã copy ' + imageResults.length + ' đường dẫn');
  } catch (err) {
    console.error('Lỗi copy:', err);
  }
}

function resetFilters() {
  document.getElementById('folderPath').value = '';
  document.getElementById('includeSubfolders').checked = true;
  document.getElementById('formatAll').checked = true;
  document.getElementById('formatList').classList.add('hidden');
  document.querySelectorAll('#formatList input').forEach(cb => cb.checked = true);
  document.getElementById('enableDimensionFilter').checked = false;
  document.getElementById('dimensionFilterInputs').classList.add('hidden');
  document.getElementById('enableWidthFilter').checked = true;
  document.getElementById('enableHeightFilter').checked = true;
  document.getElementById('minWidth').value = '';
  document.getElementById('maxWidth').value = '';
  document.getElementById('minHeight').value = '';
  document.getElementById('maxHeight').value = '';
  document.getElementById('enableSizeFilter').checked = false;
  document.getElementById('sizeFilterInputs').classList.add('hidden');
  document.getElementById('minSize').value = '';
  document.getElementById('maxSize').value = '';
  document.getElementById('btnScan').disabled = true;
  document.getElementById('resultsGrid').innerHTML = '<div class="empty-state"><p>Chọn thư mục và nhấn "Quét ảnh" để bắt đầu</p></div>';
  document.getElementById('resultCount').textContent = '(0 ảnh)';
  toggleResultButtons(false);
  selectedFolder = '';
  imageResults = [];
  currentPage = 0;
  setStatus('Đã đặt lại bộ lọc');
}

function showLoading(show) {
  document.getElementById('loadingIndicator').classList.toggle('hidden', !show);
  document.getElementById('resultsGrid').classList.toggle('hidden', show);
}

function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}
