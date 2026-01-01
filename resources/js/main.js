const APP_VERSION = '0.0.8';
const GITHUB_REPO = 'lvminhnhat/FileFilter';

// Version check cache
const VERSION_CACHE_KEY = 'filefilter_version_cache';
const VERSION_CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

let selectedFolder = '';
let imageResults = [];
let currentPage = 0;
const ITEMS_PER_PAGE = 50;
let isLoadingThumbs = false;

let convertFiles = [];
let compressFiles = [];
let convertOutputFolder = '';
let compressOutputFolder = '';

const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif'];
const CONVERTIBLE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
const COMPRESSIBLE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'tif'];

Neutralino.init();

Neutralino.events.on('ready', () => {
  initEventListeners();
  initTabNavigation();
  initConvertTab();
  initCompressTab();
  checkForUpdates();
  document.getElementById('appVersion').textContent = `v${APP_VERSION}`;
});

function initTabNavigation() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });
}

function initEventListeners() {
  document.getElementById('btnSelectFolder').addEventListener('click', selectFolder);
  document.getElementById('btnScan').addEventListener('click', startScan);
  document.getElementById('btnReset').addEventListener('click', resetFilters);
  document.getElementById('btnExport').addEventListener('click', exportResults);
  document.getElementById('btnCopyPaths').addEventListener('click', copyPaths);
  document.getElementById('btnCopyTo').addEventListener('click', () => copyOrMoveImages('copy'));
  document.getElementById('btnMoveTo').addEventListener('click', () => copyOrMoveImages('move'));
  document.getElementById('btnCheckUpdate').addEventListener('click', manualCheckUpdate);
  document.getElementById('formatAll').addEventListener('change', toggleFormatList);
  document.getElementById('enableSizeFilter').addEventListener('change', toggleSizeFilter);
  document.getElementById('enableDimensionFilter').addEventListener('change', toggleDimensionFilter);
  document.getElementById('enableWidthFilter').addEventListener('change', toggleWidthFilter);
  document.getElementById('enableHeightFilter').addEventListener('change', toggleHeightFilter);
  
  document.getElementById('btnCloseResult').addEventListener('click', () => {
    document.getElementById('resultModal').classList.add('hidden');
  });
  
  const resultsGrid = document.getElementById('resultsGrid');
  resultsGrid.addEventListener('scroll', handleScroll);
}

function initConvertTab() {
  document.getElementById('btnSelectConvertFiles').addEventListener('click', selectConvertFiles);
  document.getElementById('btnSelectConvertFolder').addEventListener('click', selectConvertFolder);
  document.getElementById('btnSelectConvertOutput').addEventListener('click', selectConvertOutputFolder);
  document.getElementById('btnStartConvert').addEventListener('click', startConversion);
  document.getElementById('btnClearConvertList').addEventListener('click', clearConvertList);
  
  const qualitySlider = document.getElementById('convertQuality');
  qualitySlider.addEventListener('input', (e) => {
    document.getElementById('convertQualityValue').textContent = `${e.target.value}%`;
  });
}

function initCompressTab() {
  document.getElementById('btnSelectCompressFiles').addEventListener('click', selectCompressFiles);
  document.getElementById('btnSelectCompressFolder').addEventListener('click', selectCompressFolder);
  document.getElementById('btnSelectCompressOutput').addEventListener('click', selectCompressOutputFolder);
  document.getElementById('btnStartCompress').addEventListener('click', startCompression);
  document.getElementById('btnClearCompressList').addEventListener('click', clearCompressList);
  
  document.querySelectorAll('input[name="compressMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const qualitySection = document.querySelector('.compress-quality-options');
      const sizeSection = document.querySelector('.compress-size-options');
      
      if (e.target.value === 'quality') {
        qualitySection.classList.remove('hidden');
        sizeSection.classList.add('hidden');
      } else {
        qualitySection.classList.add('hidden');
        sizeSection.classList.remove('hidden');
      }
    });
  });
  
  const compressSlider = document.getElementById('compressQuality');
  compressSlider.addEventListener('input', (e) => {
    document.getElementById('compressQualityValue').textContent = `${e.target.value}%`;
    document.querySelectorAll('.quality-presets .preset-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.quality) === parseInt(e.target.value));
    });
  });
  
  document.querySelectorAll('.quality-presets .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const quality = btn.dataset.quality;
      document.getElementById('compressQuality').value = quality;
      document.getElementById('compressQualityValue').textContent = `${quality}%`;
      document.querySelectorAll('.quality-presets .preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  document.querySelectorAll('.size-presets .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.size;
      document.getElementById('targetSizeKB').value = size;
      document.querySelectorAll('.size-presets .preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  document.getElementById('targetSizeKB').addEventListener('input', () => {
    document.querySelectorAll('.size-presets .preset-btn').forEach(b => b.classList.remove('active'));
  });
}

async function selectConvertFiles() {
  try {
    const files = await Neutralino.os.showOpenDialog('Chọn ảnh để chuyển đổi', {
      filters: [
        { name: 'Ảnh', extensions: CONVERTIBLE_FORMATS }
      ],
      multiSelections: true
    });
    
    if (files && files.length > 0) {
      await addFilesToConvertList(files);
    }
  } catch (err) {
    console.error('Lỗi chọn file:', err);
  }
}

async function selectConvertFolder() {
  try {
    const folder = await Neutralino.os.showFolderDialog('Chọn thư mục chứa ảnh');
    if (folder) {
      setStatus('Đang quét thư mục...');
      const files = await scanFolderForImages(folder, CONVERTIBLE_FORMATS);
      await addFilesToConvertList(files);
      setStatus(`Đã thêm ${files.length} ảnh`);
    }
  } catch (err) {
    console.error('Lỗi chọn thư mục:', err);
  }
}

async function scanFolderForImages(folderPath, allowedFormats) {
  const results = [];
  
  async function scan(dir) {
    try {
      const entries = await Neutralino.filesystem.readDirectory(dir);
      for (const entry of entries) {
        if (entry.entry === '.' || entry.entry === '..') continue;
        const fullPath = dir + '/' + entry.entry;
        
        if (entry.type === 'DIRECTORY') {
          await scan(fullPath);
        } else if (entry.type === 'FILE') {
          const ext = entry.entry.split('.').pop().toLowerCase();
          if (allowedFormats.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (err) {
      console.error('Lỗi quét:', dir, err);
    }
  }
  
  await scan(folderPath);
  return results;
}

async function addFilesToConvertList(files) {
  for (const filePath of files) {
    if (convertFiles.find(f => f.path === filePath)) continue;
    
    try {
      const stats = await Neutralino.filesystem.getStats(filePath);
      const ext = filePath.split('.').pop().toLowerCase();
      const name = filePath.split('/').pop();
      
      convertFiles.push({
        path: filePath,
        name: name,
        size: stats.size,
        ext: ext
      });
    } catch (err) {
      console.error('Lỗi đọc file:', filePath, err);
    }
  }
  
  updateConvertUI();
}

function updateConvertUI() {
  const grid = document.getElementById('convertGrid');
  const countEl = document.getElementById('convertCount');
  const sourceInfo = document.getElementById('convertSourceInfo');
  const btnStart = document.getElementById('btnStartConvert');
  const btnClear = document.getElementById('btnClearConvertList');
  
  countEl.textContent = `(${convertFiles.length} ảnh)`;
  sourceInfo.innerHTML = convertFiles.length > 0 
    ? `<span class="has-files">${convertFiles.length} ảnh đã chọn</span>`
    : '<span>Chưa chọn file</span>';
  sourceInfo.classList.toggle('has-files', convertFiles.length > 0);
  
  btnStart.disabled = convertFiles.length === 0;
  btnClear.disabled = convertFiles.length === 0;
  
  if (convertFiles.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
          <polyline points="17 1 21 5 17 9"></polyline>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
          <polyline points="7 23 3 19 7 15"></polyline>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>
        <p>Chọn file hoặc thư mục để chuyển đổi định dạng</p>
        <p class="hint">Hỗ trợ: JPG, PNG, WebP, GIF, BMP</p>
      </div>
    `;
    return;
  }
  
  const targetFormat = document.querySelector('input[name="convertFormat"]:checked').value;
  grid.innerHTML = '';
  
  convertFiles.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `
      <div class="thumb" id="convert-thumb-${index}">
        <span class="loading-thumb">...</span>
      </div>
      <div class="info">
        <div class="name">${file.name}</div>
        <div class="meta">${formatSize(file.size)}</div>
        <div class="convert-info">
          <span>${file.ext.toUpperCase()}</span>
          <span class="arrow">→</span>
          <span>${targetFormat.toUpperCase()}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
    loadConvertThumbnail(file.path, index);
  });
}

async function loadConvertThumbnail(filePath, index) {
  try {
    const dataUrl = await loadImageAsBase64(filePath);
    const thumbEl = document.getElementById(`convert-thumb-${index}`);
    if (dataUrl && thumbEl) {
      thumbEl.innerHTML = `<img src="${dataUrl}" alt="">`;
    }
  } catch (err) {
    console.error('Lỗi load thumbnail:', err);
  }
}

async function selectConvertOutputFolder() {
  try {
    const folder = await Neutralino.os.showFolderDialog('Chọn thư mục đích');
    if (folder) {
      convertOutputFolder = folder;
      document.getElementById('convertOutputPath').value = folder;
    }
  } catch (err) {
    console.error('Lỗi chọn thư mục:', err);
  }
}

function clearConvertList() {
  convertFiles = [];
  convertOutputFolder = '';
  document.getElementById('convertOutputPath').value = '';
  updateConvertUI();
}

async function startConversion() {
  if (convertFiles.length === 0) return;
  
  const targetFormat = document.querySelector('input[name="convertFormat"]:checked').value;
  const quality = parseInt(document.getElementById('convertQuality').value) / 100;
  const keepOriginal = document.getElementById('convertKeepOriginal').checked;
  
  const total = convertFiles.length;
  let successCount = 0;
  let errorCount = 0;
  let totalSavedBytes = 0;
  
  showProgress(true, 'Đang chuyển đổi định dạng...');
  
  for (let i = 0; i < total; i++) {
    const file = convertFiles[i];
    updateProgress(i + 1, total, file.name);
    
    try {
      const result = await convertImage(file.path, targetFormat, quality, convertOutputFolder, keepOriginal);
      if (result.success) {
        successCount++;
        totalSavedBytes += (file.size - result.newSize);
      } else {
        errorCount++;
      }
    } catch (err) {
      console.error('Lỗi chuyển đổi:', file.path, err);
      errorCount++;
    }
  }
  
  showProgress(false);
  
  showResultModal(
    'Chuyển đổi hoàn tất!',
    `Đã chuyển đổi ${successCount} ảnh sang ${targetFormat.toUpperCase()}`,
    [
      { label: 'Thành công', value: successCount, success: true },
      { label: 'Lỗi', value: errorCount },
      { label: 'Thay đổi dung lượng', value: formatSize(Math.abs(totalSavedBytes)), success: totalSavedBytes > 0 }
    ]
  );
  
  if (!keepOriginal) {
    clearConvertList();
  }
}

async function convertImage(filePath, targetFormat, quality, outputFolder, keepOriginal) {
  try {
    const data = await Neutralino.filesystem.readBinaryFile(filePath);
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        URL.revokeObjectURL(url);
        
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        let mimeType = 'image/jpeg';
        let extension = targetFormat;
        
        switch (targetFormat) {
          case 'jpg':
          case 'jpeg':
            mimeType = 'image/jpeg';
            extension = 'jpg';
            break;
          case 'png':
            mimeType = 'image/png';
            break;
          case 'webp':
            mimeType = 'image/webp';
            break;
          case 'gif':
            mimeType = 'image/gif';
            break;
          case 'bmp':
            mimeType = 'image/bmp';
            break;
        }
        
        const useQuality = (targetFormat === 'jpg' || targetFormat === 'jpeg' || targetFormat === 'webp');
        const dataUrl = useQuality 
          ? canvas.toDataURL(mimeType, quality)
          : canvas.toDataURL(mimeType);
        
        const base64Data = dataUrl.split(',')[1];
        const binaryData = base64ToArrayBuffer(base64Data);
        
        const originalName = filePath.split('/').pop();
        const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
        const newFileName = `${nameWithoutExt}.${extension}`;
        
        let outputPath;
        if (outputFolder) {
          outputPath = `${outputFolder}/${newFileName}`;
        } else {
          const dir = filePath.substring(0, filePath.lastIndexOf('/'));
          outputPath = `${dir}/${newFileName}`;
        }
        
        if (outputPath === filePath && !keepOriginal) {
          const tempPath = outputPath + '.tmp';
          await Neutralino.filesystem.writeBinaryFile(tempPath, binaryData);
          await Neutralino.filesystem.removeFile(filePath);
          await Neutralino.filesystem.moveFile(tempPath, outputPath);
        } else {
          await Neutralino.filesystem.writeBinaryFile(outputPath, binaryData);
          if (!keepOriginal && outputPath !== filePath) {
            await Neutralino.filesystem.removeFile(filePath);
          }
        }
        
        resolve({ success: true, newSize: binaryData.byteLength });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ success: false, error: 'Không thể đọc ảnh' });
      };
      
      img.src = url;
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function selectCompressFiles() {
  try {
    const files = await Neutralino.os.showOpenDialog('Chọn ảnh để nén', {
      filters: [
        { name: 'Ảnh', extensions: COMPRESSIBLE_FORMATS }
      ],
      multiSelections: true
    });
    
    if (files && files.length > 0) {
      await addFilesToCompressList(files);
    }
  } catch (err) {
    console.error('Lỗi chọn file:', err);
  }
}

async function selectCompressFolder() {
  try {
    const folder = await Neutralino.os.showFolderDialog('Chọn thư mục chứa ảnh');
    if (folder) {
      setStatus('Đang quét thư mục...');
      const files = await scanFolderForImages(folder, COMPRESSIBLE_FORMATS);
      await addFilesToCompressList(files);
      setStatus(`Đã thêm ${files.length} ảnh`);
    }
  } catch (err) {
    console.error('Lỗi chọn thư mục:', err);
  }
}

async function addFilesToCompressList(files) {
  for (const filePath of files) {
    if (compressFiles.find(f => f.path === filePath)) continue;
    
    try {
      const stats = await Neutralino.filesystem.getStats(filePath);
      const ext = filePath.split('.').pop().toLowerCase();
      const name = filePath.split('/').pop();
      
      compressFiles.push({
        path: filePath,
        name: name,
        size: stats.size,
        ext: ext
      });
    } catch (err) {
      console.error('Lỗi đọc file:', filePath, err);
    }
  }
  
  updateCompressUI();
}

function updateCompressUI() {
  const grid = document.getElementById('compressGrid');
  const countEl = document.getElementById('compressCount');
  const sourceInfo = document.getElementById('compressSourceInfo');
  const btnStart = document.getElementById('btnStartCompress');
  const btnClear = document.getElementById('btnClearCompressList');
  
  countEl.textContent = `(${compressFiles.length} ảnh)`;
  sourceInfo.innerHTML = compressFiles.length > 0 
    ? `<span class="has-files">${compressFiles.length} ảnh đã chọn (${formatSize(compressFiles.reduce((sum, f) => sum + f.size, 0))})</span>`
    : '<span>Chưa chọn file</span>';
  sourceInfo.classList.toggle('has-files', compressFiles.length > 0);
  
  btnStart.disabled = compressFiles.length === 0;
  btnClear.disabled = compressFiles.length === 0;
  
  if (compressFiles.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <p>Chọn file hoặc thư mục để nén ảnh</p>
        <p class="hint">Hỗ trợ: JPG, PNG, WebP, GIF, BMP, TIFF</p>
      </div>
    `;
    document.getElementById('compressSavings').classList.add('hidden');
    return;
  }
  
  grid.innerHTML = '';
  
  compressFiles.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `
      <div class="thumb" id="compress-thumb-${index}">
        <span class="loading-thumb">...</span>
      </div>
      <div class="info">
        <div class="name">${file.name}</div>
        <div class="meta">${file.ext.toUpperCase()} - ${formatSize(file.size)}</div>
      </div>
    `;
    grid.appendChild(card);
    loadCompressThumbnail(file.path, index);
  });
}

async function loadCompressThumbnail(filePath, index) {
  try {
    const dataUrl = await loadImageAsBase64(filePath);
    const thumbEl = document.getElementById(`compress-thumb-${index}`);
    if (dataUrl && thumbEl) {
      thumbEl.innerHTML = `<img src="${dataUrl}" alt="">`;
    }
  } catch (err) {
    console.error('Lỗi load thumbnail:', err);
  }
}

async function selectCompressOutputFolder() {
  try {
    const folder = await Neutralino.os.showFolderDialog('Chọn thư mục đích');
    if (folder) {
      compressOutputFolder = folder;
      document.getElementById('compressOutputPath').value = folder;
    }
  } catch (err) {
    console.error('Lỗi chọn thư mục:', err);
  }
}

function clearCompressList() {
  compressFiles = [];
  compressOutputFolder = '';
  document.getElementById('compressOutputPath').value = '';
  updateCompressUI();
}

async function startCompression() {
  if (compressFiles.length === 0) return;
  
  const mode = document.querySelector('input[name="compressMode"]:checked').value;
  const quality = parseInt(document.getElementById('compressQuality').value) / 100;
  const targetSizeKB = parseInt(document.getElementById('targetSizeKB').value) || 200;
  const keepOriginal = document.getElementById('compressKeepOriginal').checked;
  const addSuffix = document.getElementById('compressAddSuffix').checked;
  
  const total = compressFiles.length;
  let successCount = 0;
  let errorCount = 0;
  let totalOriginalSize = 0;
  let totalNewSize = 0;
  
  showProgress(true, 'Đang nén ảnh...');
  
  for (let i = 0; i < total; i++) {
    const file = compressFiles[i];
    updateProgress(i + 1, total, file.name);
    
    try {
      let result;
      if (mode === 'quality') {
        result = await compressImageByQuality(file.path, quality, compressOutputFolder, keepOriginal, addSuffix);
      } else {
        result = await compressImageBySize(file.path, targetSizeKB * 1024, compressOutputFolder, keepOriginal, addSuffix);
      }
      
      if (result.success) {
        successCount++;
        totalOriginalSize += file.size;
        totalNewSize += result.newSize;
      } else {
        errorCount++;
      }
    } catch (err) {
      console.error('Lỗi nén:', file.path, err);
      errorCount++;
    }
  }
  
  showProgress(false);
  
  const savedBytes = totalOriginalSize - totalNewSize;
  const savedPercent = totalOriginalSize > 0 ? Math.round((savedBytes / totalOriginalSize) * 100) : 0;
  
  showResultModal(
    'Nén ảnh hoàn tất!',
    `Đã nén ${successCount} ảnh`,
    [
      { label: 'Thành công', value: successCount, success: true },
      { label: 'Lỗi', value: errorCount },
      { label: 'Dung lượng gốc', value: formatSize(totalOriginalSize) },
      { label: 'Dung lượng mới', value: formatSize(totalNewSize), success: true },
      { label: 'Tiết kiệm', value: `${formatSize(savedBytes)} (${savedPercent}%)`, success: true }
    ]
  );
}

async function compressImageByQuality(filePath, quality, outputFolder, keepOriginal, addSuffix) {
  try {
    const data = await Neutralino.filesystem.readBinaryFile(filePath);
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const ext = filePath.split('.').pop().toLowerCase();
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        URL.revokeObjectURL(url);
        
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        let mimeType = 'image/jpeg';
        let outputExt = ext;
        
        if (ext === 'png') {
          mimeType = 'image/png';
        } else if (ext === 'webp') {
          mimeType = 'image/webp';
        } else if (ext === 'gif') {
          mimeType = 'image/gif';
        } else if (ext === 'bmp') {
          mimeType = 'image/jpeg';
          outputExt = 'jpg';
        } else if (ext === 'tiff' || ext === 'tif') {
          mimeType = 'image/jpeg';
          outputExt = 'jpg';
        } else {
          mimeType = 'image/jpeg';
          outputExt = 'jpg';
        }
        
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64Data = dataUrl.split(',')[1];
        const binaryData = base64ToArrayBuffer(base64Data);
        
        const outputPath = buildOutputPath(filePath, outputFolder, addSuffix ? '_compressed' : '', outputExt);
        
        await Neutralino.filesystem.writeBinaryFile(outputPath, binaryData);
        
        if (!keepOriginal && outputPath !== filePath) {
          await Neutralino.filesystem.removeFile(filePath);
        }
        
        resolve({ success: true, newSize: binaryData.byteLength });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ success: false, error: 'Không thể đọc ảnh' });
      };
      
      img.src = url;
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function compressImageBySize(filePath, targetBytes, outputFolder, keepOriginal, addSuffix) {
  try {
    const data = await Neutralino.filesystem.readBinaryFile(filePath);
    
    if (data.byteLength <= targetBytes) {
      const outputPath = buildOutputPath(filePath, outputFolder, addSuffix ? '_compressed' : '', null);
      if (outputPath !== filePath) {
        await Neutralino.filesystem.writeBinaryFile(outputPath, data);
      }
      return { success: true, newSize: data.byteLength };
    }
    
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const ext = filePath.split('.').pop().toLowerCase();
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        URL.revokeObjectURL(url);
        
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        let mimeType, outputExt;
        if (ext === 'png') {
          mimeType = 'image/png';
          outputExt = 'png';
        } else if (ext === 'webp') {
          mimeType = 'image/webp';
          outputExt = 'webp';
        } else if (ext === 'gif') {
          mimeType = 'image/gif';
          outputExt = 'gif';
        } else {
          mimeType = 'image/jpeg';
          outputExt = 'jpg';
        }
        
        let quality = 0.9;
        let binaryData;
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts) {
          const dataUrl = canvas.toDataURL(mimeType, quality);
          const base64Data = dataUrl.split(',')[1];
          binaryData = base64ToArrayBuffer(base64Data);
          
          if (binaryData.byteLength <= targetBytes || quality <= 0.05) {
            break;
          }
          
          quality -= 0.05;
          attempts++;
        }
        
        if (binaryData.byteLength > targetBytes && (ext !== 'jpg' && ext !== 'jpeg')) {
          mimeType = 'image/jpeg';
          outputExt = 'jpg';
          quality = 0.9;
          attempts = 0;
          
          while (attempts < maxAttempts) {
            const dataUrl = canvas.toDataURL(mimeType, quality);
            const base64Data = dataUrl.split(',')[1];
            binaryData = base64ToArrayBuffer(base64Data);
            
            if (binaryData.byteLength <= targetBytes || quality <= 0.05) {
              break;
            }
            
            quality -= 0.05;
            attempts++;
          }
        }
        
        if (binaryData.byteLength > targetBytes) {
          const scale = Math.sqrt(targetBytes / binaryData.byteLength) * 0.9;
          canvas.width = Math.floor(img.naturalWidth * scale);
          canvas.height = Math.floor(img.naturalHeight * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          quality = 0.85;
          const dataUrl = canvas.toDataURL(mimeType, quality);
          const base64Data = dataUrl.split(',')[1];
          binaryData = base64ToArrayBuffer(base64Data);
        }
        
        const outputPath = buildOutputPath(filePath, outputFolder, addSuffix ? '_compressed' : '', outputExt);
        
        await Neutralino.filesystem.writeBinaryFile(outputPath, binaryData);
        
        if (!keepOriginal && outputPath !== filePath) {
          await Neutralino.filesystem.removeFile(filePath);
        }
        
        resolve({ success: true, newSize: binaryData.byteLength });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ success: false, error: 'Không thể đọc ảnh' });
      };
      
      img.src = url;
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function buildOutputPath(filePath, outputFolder, suffix, newExt) {
  const originalName = filePath.split('/').pop();
  const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
  const originalExt = originalName.split('.').pop();
  const extension = newExt || originalExt;
  const newFileName = `${nameWithoutExt}${suffix}.${extension}`;
  
  if (outputFolder) {
    return `${outputFolder}/${newFileName}`;
  } else {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    return `${dir}/${newFileName}`;
  }
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function showResultModal(title, message, stats) {
  const modal = document.getElementById('resultModal');
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultMessage').textContent = message;
  
  const statsEl = document.getElementById('resultStats');
  statsEl.innerHTML = stats.map(s => `
    <div class="stat-row">
      <span class="stat-label">${s.label}</span>
      <span class="stat-value ${s.success ? 'success' : ''}">${s.value}</span>
    </div>
  `).join('');
  
  modal.classList.remove('hidden');
}

async function manualCheckUpdate() {
  setStatus('Đang kiểm tra cập nhật...');
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    if (!response.ok) {
      setStatus('Không thể kiểm tra cập nhật');
      return;
    }
    
    const data = await response.json();
    const latestVersion = data.tag_name.replace('v', '');
    
    saveVersionCache(latestVersion, data.html_url);
    
    if (compareVersions(latestVersion, APP_VERSION) > 0) {
      showUpdateNotification(latestVersion, data.html_url);
      setStatus(`Có phiên bản mới: ${latestVersion}`);
    } else {
      setStatus('Bạn đang dùng phiên bản mới nhất!');
    }
  } catch (err) {
    console.log('Không thể kiểm tra cập nhật:', err);
    setStatus('Lỗi kết nối khi kiểm tra cập nhật');
  }
}

async function checkForUpdates() {
  const cached = getVersionCache();
  if (cached) {
    if (compareVersions(cached.version, APP_VERSION) > 0) {
      showUpdateNotification(cached.version, cached.url);
    }
    return;
  }
  
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    if (!response.ok) return;
    
    const data = await response.json();
    const latestVersion = data.tag_name.replace('v', '');
    
    saveVersionCache(latestVersion, data.html_url);
    
    if (compareVersions(latestVersion, APP_VERSION) > 0) {
      showUpdateNotification(latestVersion, data.html_url);
    }
  } catch (err) {
    console.log('Không thể kiểm tra cập nhật:', err);
  }
}

function getVersionCache() {
  try {
    const cached = localStorage.getItem(VERSION_CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > VERSION_CACHE_DURATION) {
      localStorage.removeItem(VERSION_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveVersionCache(version, url) {
  try {
    localStorage.setItem(VERSION_CACHE_KEY, JSON.stringify({
      version,
      url,
      timestamp: Date.now()
    }));
  } catch {
    // localStorage not available
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

    let dimensions = null;
    
    if (filters.enableWidthFilter || filters.enableHeightFilter) {
      dimensions = await getImageDimensions(filePath, ext);
      if (dimensions) {
        if (filters.enableWidthFilter) {
          if (dimensions.width < filters.minWidth || dimensions.width > filters.maxWidth) return;
        }
        if (filters.enableHeightFilter) {
          if (dimensions.height < filters.minHeight || dimensions.height > filters.maxHeight) return;
        }
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
    
    const hasDimensions = img.width > 0 && img.height > 0;
    const dimensionText = hasDimensions ? `${img.width}x${img.height} | ` : '';
    
    card.innerHTML = `
      <div class="thumb" id="thumb-${i}">
        <span class="loading-thumb">...</span>
      </div>
      <div class="info">
        <div class="name">${img.name}</div>
        <div class="meta" id="meta-${i}">${dimensionText}${formatSize(img.size)}</div>
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
      
      if (img.width === 0 || img.height === 0) {
        const dimensions = await getImageDimensionsFromDataUrl(dataUrl);
        if (dimensions) {
          img.width = dimensions.width;
          img.height = dimensions.height;
          const metaEl = document.getElementById(`meta-${index}`);
          if (metaEl) {
            metaEl.textContent = `${dimensions.width}x${dimensions.height} | ${formatSize(img.size)}`;
          }
        }
      }
    } else if (thumbEl) {
      thumbEl.innerHTML = '<span>Không tải được</span>';
    }
  } catch {
    if (thumbEl) {
      thumbEl.innerHTML = '<span>Lỗi</span>';
    }
  }
}

function getImageDimensionsFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = dataUrl;
  });
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

    const total = imageResults.length;
    let successCount = 0;
    let errorCount = 0;
    
    showProgress(true, action === 'copy' ? 'Đang copy ảnh...' : 'Đang di chuyển ảnh...');

    for (let i = 0; i < total; i++) {
      const img = imageResults[i];
      updateProgress(i + 1, total, img.name);
      
      try {
        const fileName = img.name;
        const destPath = destFolder + '/' + fileName;
        
        const fileData = await Neutralino.filesystem.readBinaryFile(img.path);
        await Neutralino.filesystem.writeBinaryFile(destPath, fileData);
        
        if (action === 'move') {
          await Neutralino.filesystem.removeFile(img.path);
        }
        
        successCount++;
      } catch (err) {
        console.error(`Lỗi ${action} file:`, img.path, err);
        errorCount++;
      }
    }

    showProgress(false);

    if (action === 'move' && successCount > 0) {
      imageResults = [];
      displayResults();
    }

    setStatus(`Hoàn thành! ${action === 'copy' ? 'Đã copy' : 'Đã di chuyển'} ${successCount} ảnh${errorCount > 0 ? `, ${errorCount} lỗi` : ''}`);
  } catch (err) {
    console.error('Lỗi:', err);
    showProgress(false);
    setStatus('Lỗi: ' + err.message);
  }
}

function showProgress(show, title = '') {
  const modal = document.getElementById('progressModal');
  if (show) {
    document.getElementById('progressTitle').textContent = title;
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';
    document.getElementById('progressCount').textContent = '0/0';
    document.getElementById('progressCurrentFile').textContent = '';
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

function updateProgress(current, total, fileName) {
  const percent = Math.round((current / total) * 100);
  document.getElementById('progressBar').style.width = percent + '%';
  document.getElementById('progressPercent').textContent = percent + '%';
  document.getElementById('progressCount').textContent = `${current}/${total}`;
  document.getElementById('progressCurrentFile').textContent = fileName;
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
