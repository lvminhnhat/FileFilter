let selectedFolder = '';
let imageResults = [];

const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif'];

Neutralino.init();

Neutralino.events.on('ready', () => {
  initEventListeners();
});

function initEventListeners() {
  document.getElementById('btnSelectFolder').addEventListener('click', selectFolder);
  document.getElementById('btnScan').addEventListener('click', startScan);
  document.getElementById('btnReset').addEventListener('click', resetFilters);
  document.getElementById('btnExport').addEventListener('click', exportResults);
  document.getElementById('btnCopyPaths').addEventListener('click', copyPaths);
  document.getElementById('formatAll').addEventListener('change', toggleFormatList);
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

async function startScan() {
  if (!selectedFolder) return;

  const filters = getFilters();
  showLoading(true);
  setStatus('Đang quét...');
  imageResults = [];

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

  return {
    includeSubfolders: document.getElementById('includeSubfolders').checked,
    formats,
    minWidth: parseInt(document.getElementById('minWidth').value) || 0,
    maxWidth: parseInt(document.getElementById('maxWidth').value) || Infinity,
    minHeight: parseInt(document.getElementById('minHeight').value) || 0,
    maxHeight: parseInt(document.getElementById('maxHeight').value) || Infinity,
    minSize: (parseInt(document.getElementById('minSize').value) || 0) * 1024,
    maxSize: (parseInt(document.getElementById('maxSize').value) || Infinity) * 1024
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

    if (fileSize < filters.minSize || fileSize > filters.maxSize) return;

    const dimensions = await getImageDimensions(filePath, ext);

    if (dimensions) {
      if (dimensions.width < filters.minWidth || dimensions.width > filters.maxWidth) return;
      if (dimensions.height < filters.minHeight || dimensions.height > filters.maxHeight) return;
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

function displayResults() {
  const grid = document.getElementById('resultsGrid');
  document.getElementById('resultCount').textContent = `(${imageResults.length} ảnh)`;

  if (imageResults.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>Không tìm thấy ảnh phù hợp</p></div>';
    document.getElementById('btnExport').disabled = true;
    document.getElementById('btnCopyPaths').disabled = true;
    return;
  }

  document.getElementById('btnExport').disabled = false;
  document.getElementById('btnCopyPaths').disabled = false;

  grid.innerHTML = imageResults.map((img, idx) => `
    <div class="image-card" onclick="openImage(${idx})" title="${img.path}">
      <div class="thumb">
        <img src="file://${img.path}" alt="${img.name}" loading="lazy" onerror="this.parentElement.innerHTML='<span>Không tải được</span>'">
      </div>
      <div class="info">
        <div class="name">${img.name}</div>
        <div class="meta">${img.width}x${img.height} | ${formatSize(img.size)}</div>
      </div>
    </div>
  `).join('');
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
  document.getElementById('minWidth').value = '';
  document.getElementById('maxWidth').value = '';
  document.getElementById('minHeight').value = '';
  document.getElementById('maxHeight').value = '';
  document.getElementById('minSize').value = '';
  document.getElementById('maxSize').value = '';
  document.getElementById('btnScan').disabled = true;
  document.getElementById('resultsGrid').innerHTML = '<div class="empty-state"><p>Chọn thư mục và nhấn "Quét ảnh" để bắt đầu</p></div>';
  document.getElementById('resultCount').textContent = '(0 ảnh)';
  document.getElementById('btnExport').disabled = true;
  document.getElementById('btnCopyPaths').disabled = true;
  selectedFolder = '';
  imageResults = [];
  setStatus('Đã đặt lại bộ lọc');
}

function showLoading(show) {
  document.getElementById('loadingIndicator').classList.toggle('hidden', !show);
  document.getElementById('resultsGrid').classList.toggle('hidden', show);
}

function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}
