// =========================================================
// 1. DOM Elements & Global State
// =========================================================

// Upload & Controls
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const controlsCard = document.getElementById('controls-card');
const fileCountLabel = document.getElementById('fileCountLabel');
const addMoreBtn = document.getElementById('addMoreBtn');
const queueList = document.getElementById('queueList');

const globalFormatSelect = document.getElementById('globalFormatSelect');
const resolutionSelect = document.getElementById('resolutionSelect');
const convertButton = document.getElementById('convertButton');
const resetBtn = document.getElementById('resetBtn');

// Modals & Navigation
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingTitle = document.getElementById('loadingTitle');
const loadingText = document.getElementById('loadingText');
const thankYouSlide = document.getElementById('thankYouSlide');
const downloadButton = document.getElementById('downloadButton');
const convertMoreButton = document.getElementById('convertMoreButton');
const successSubtitle = document.getElementById('successSubtitle');

const hamburgerBtn = document.getElementById('hamburger-btn');
const navMenu = document.getElementById('nav-menu');

// Queue State Array
// Each item: { id, file, originalName, format, aiRecommended, aiReason, previewUrl, isHeic }
let fileQueue = [];
let convertedBlobs = [];

// =========================================================
// 2. Navigation & Mobile Hamburger Listeners
// =========================================================
if (hamburgerBtn && navMenu) {
  hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hamburgerBtn.classList.toggle('active');
    navMenu.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!navMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
      hamburgerBtn.classList.remove('active');
      navMenu.classList.remove('active');
    }
  });

  navMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      hamburgerBtn.classList.remove('active');
      navMenu.classList.remove('active');
    });
  });
}

// =========================================================
// 3. Drag & Drop File Upload Handling
// =========================================================
dropZone.addEventListener('click', () => fileInput.click());
addMoreBtn.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover'].forEach((name) => {
  dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#10b981';
    dropZone.style.background = 'rgba(16, 185, 129, 0.08)';
  });
});

['dragleave', 'drop'].forEach((name) => {
  dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'rgba(16, 185, 129, 0.24)';
    dropZone.style.background = 'var(--card-bg)';
  });
});

dropZone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleIncomingFiles(Array.from(e.dataTransfer.files));
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleIncomingFiles(Array.from(e.target.files));
  }
});

// =========================================================
// 4. Smart AI Recommendation Engine (Pixel & Geometry Scan)
// =========================================================
async function inspectAndRecommend(file, isHeic) {
  // Rule 1: Apple iPhone Photos -> Recommend JPG for maximum cross-platform compatibility
  if (isHeic) {
    return {
      format: 'jpg',
      reason: 'Apple Photo (Cross-Platform Universal)'
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      // Rule 2: Square geometry & Icon dimensions -> Recommend ICO (Favicon)
      const ratio = w / h;
      if (ratio >= 0.95 && ratio <= 1.05 && Math.max(w, h) <= 512) {
        resolve({
          format: 'ico',
          reason: 'Square Icon / Logo (Favicon Ready)'
        });
        return;
      }

      // Sample image on 80x80 canvas to test for Alpha Transparency
      const canvas = document.createElement('canvas');
      canvas.width = 80;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 80, 80);

      let hasTransparency = false;
      try {
        const imgData = ctx.getImageData(0, 0, 80, 80).data;
        for (let i = 3; i < imgData.length; i += 4) {
          if (imgData[i] < 240) {
            hasTransparency = true;
            break;
          }
        }
      } catch (e) {
        // Fallback if canvas security blocks inspection
        hasTransparency = file.type === 'image/png';
      }

      // Rule 3: Transparent background detected -> Recommend WEBP (or PNG)
      if (hasTransparency) {
        resolve({
          format: 'webp',
          reason: 'Alpha Transparency Detected (Saves Space)'
        });
        return;
      }

      // Rule 4: High-Resolution Photo -> Recommend AVIF (Next-Gen Ultra Compression)
      if (Math.max(w, h) >= 1000) {
        resolve({
          format: 'avif',
          reason: 'High-Res Photo (Next-Gen Compression)'
        });
        return;
      }

      // Default fallback
      resolve({
        format: 'webp',
        reason: 'Optimal Web Standard'
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        format: 'png',
        reason: 'Standard Fallback'
      });
    };

    img.src = objectUrl;
  });
}

// =========================================================
// 5. Incoming File Queue & HEIC Decoder
// =========================================================
async function handleIncomingFiles(files) {
  if (files.length === 0) return;

  loadingOverlay.classList.remove('hidden');
  loadingTitle.textContent = 'Processing Files...';
  loadingText.textContent = 'Running AI format analysis & decoding HEIC...';

  for (const file of files) {
    const isHeic = file.name.match(/\.(heic|heif)$/i) || file.type === 'image/heic' || file.type === 'image/heif';
    let previewUrl = '';
    let processedBlob = file;

    if (isHeic) {
      try {
        if (window.heic2any) {
          const res = await heic2any({ blob: file, toType: 'image/png' });
          processedBlob = Array.isArray(res) ? res[0] : res;
          previewUrl = URL.createObjectURL(processedBlob);
        }
      } catch (err) {
        console.warn('HEIC decode fallback:', err);
      }
    } else {
      previewUrl = URL.createObjectURL(file);
    }

    // Run AI Inspection
    const aiResult = await inspectAndRecommend(processedBlob, isHeic);

    const initialFormat = globalFormatSelect.value === 'ai' ? aiResult.format : globalFormatSelect.value;

    fileQueue.push({
      id: Math.random().toString(36).substr(2, 9),
      file: processedBlob,
      originalName: file.name,
      format: initialFormat,
      aiRecommended: aiResult.format,
      aiReason: aiResult.reason,
      previewUrl: previewUrl,
      isHeic: isHeic
    });
  }

  loadingOverlay.classList.add('hidden');
  renderQueue();

  dropZone.style.display = 'none';
  controlsCard.style.display = 'block';
}

function renderQueue() {
  queueList.innerHTML = '';
  fileCountLabel.textContent = `${fileQueue.length} file(s) queued`;

  fileQueue.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'queue-item';

    const ext = item.originalName.split('.').pop().toUpperCase();
    const isAiPicked = item.format === item.aiRecommended;

    row.innerHTML = `
      <div class="queue-thumb-wrap">
        <img class="queue-thumb" src="${item.previewUrl || 'favicon.ico'}" alt="Preview" />
        <div class="queue-details">
          <span class="queue-name" title="${item.originalName}">${item.originalName}</span>
          <div class="queue-badges">
            <span class="badge-tag">${ext}</span>
            ${item.isHeic ? '<span class="badge-tag" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8;">APPLE HEIC</span>' : ''}
          </div>
          <span class="ai-recommend-pill ${isAiPicked ? '' : 'manual'}">
            ${isAiPicked ? `✨ AI Recommends: ${item.aiRecommended.toUpperCase()} (${item.aiReason})` : `Manual Override: ${item.format.toUpperCase()} (AI suggested ${item.aiRecommended.toUpperCase()})`}
          </span>
        </div>
      </div>
      <div class="queue-controls">
        <select class="queue-select" data-id="${item.id}">
          <option value="avif" ${item.format === 'avif' ? 'selected' : ''}>AVIF</option>
          <option value="webp" ${item.format === 'webp' ? 'selected' : ''}>WEBP</option>
          <option value="png" ${item.format === 'png' ? 'selected' : ''}>PNG</option>
          <option value="jpg" ${item.format === 'jpg' ? 'selected' : ''}>JPG</option>
          <option value="ico" ${item.format === 'ico' ? 'selected' : ''}>ICO</option>
          <option value="bmp" ${item.format === 'bmp' ? 'selected' : ''}>BMP</option>
        </select>
        <button class="queue-remove-btn" data-id="${item.id}" title="Remove file">×</button>
      </div>
    `;

    row.querySelector('.queue-select').addEventListener('change', (e) => {
      item.format = e.target.value;
      renderQueue();
    });

    row.querySelector('.queue-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      fileQueue.splice(index, 1);
      if (fileQueue.length === 0) {
        resetState();
      } else {
        renderQueue();
      }
    });

    queueList.appendChild(row);
  });
}

// Global format change: either applies AI Auto or forces a single format to all
globalFormatSelect.addEventListener('change', () => {
  const chosen = globalFormatSelect.value;
  fileQueue.forEach((item) => {
    item.format = chosen === 'ai' ? item.aiRecommended : chosen;
  });
  renderQueue();
});

// =========================================================
// 6. Conversion Engine (AVIF, WEBP, PNG, JPG, ICO, BMP)
// =========================================================
async function convertSingleFile(item, resolutionMode) {
  return new Promise(async (resolve, reject) => {
    const img = new Image();
    const objectUrl = item.previewUrl || URL.createObjectURL(item.file);

    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let targetW = img.naturalWidth || img.width;
      let targetH = img.naturalHeight || img.height;

      // Resolution scaling
      if (resolutionMode === '1080p') {
        const scale = Math.min(1920 / targetW, 1080 / targetH, 1);
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      } else if (resolutionMode === '720p') {
        const scale = Math.min(1280 / targetW, 720 / targetH, 1);
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      } else if (resolutionMode === '480p') {
        const scale = Math.min(854 / targetW, 480 / targetH, 1);
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      }

      canvas.width = targetW;
      canvas.height = targetH;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // If format doesn't support alpha (JPG, BMP), paint solid white background
      if (item.format === 'jpg' || item.format === 'bmp') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);

      // 1. True ICO Favicon Generation
      if (item.format === 'ico') {
        try {
          const icoBlob = await generateIcoBlob(canvas);
          resolve(icoBlob);
        } catch (e) {
          reject(e);
        }
        return;
      }

      // 2. AVIF Export (with automatic fallback to WEBP if browser lacks encoder)
      if (item.format === 'avif') {
        canvas.toBlob((blob) => {
          if (blob && blob.size > 0 && blob.type === 'image/avif') {
            resolve(blob);
          } else {
            // Browser fallback
            canvas.toBlob((fallbackBlob) => resolve(fallbackBlob), 'image/webp', 0.90);
          }
        }, 'image/avif', 0.88);
        return;
      }

      // 3. Standard Formats
      let mimeType = 'image/png';
      if (item.format === 'jpg') mimeType = 'image/jpeg';
      else if (item.format === 'webp') mimeType = 'image/webp';
      else if (item.format === 'bmp') mimeType = 'image/bmp';

      canvas.toBlob((blob) => {
        if (!blob) reject(new Error('Conversion failed'));
        else resolve(blob);
      }, mimeType, 0.95);
    };

    img.onerror = () => reject(new Error(`Failed to load ${item.originalName}`));
    img.src = objectUrl;
  });
}

// Multi-Size ICO Binary Generator
async function generateIcoBlob(sourceCanvas) {
  const icoCanvas = document.createElement('canvas');
  icoCanvas.width = 32;
  icoCanvas.height = 32;
  const ictx = icoCanvas.getContext('2d');
  ictx.drawImage(sourceCanvas, 0, 0, 32, 32);

  const pngBlob = await new Promise((r) => icoCanvas.toBlob(r, 'image/png'));
  const pngBuffer = await pngBlob.arrayBuffer();
  const pngBytes = new Uint8Array(pngBuffer);

  const icoHeader = new Uint8Array([
    0, 0,
    1, 0,
    1, 0,
    32,
    32,
    0,
    0,
    1, 0,
    32, 0,
    pngBytes.length & 0xff,
    (pngBytes.length >> 8) & 0xff,
    (pngBytes.length >> 16) & 0xff,
    (pngBytes.length >> 24) & 0xff,
    22, 0, 0, 0
  ]);

  const combined = new Uint8Array(icoHeader.length + pngBytes.length);
  combined.set(icoHeader, 0);
  combined.set(pngBytes, icoHeader.length);
  return new Blob([combined], { type: 'image/x-icon' });
}

// =========================================================
// 7. Batch Conversion & ZIP Packaging
// =========================================================
convertButton.addEventListener('click', async () => {
  if (fileQueue.length === 0) {
    alert('Please upload at least one image.');
    return;
  }

  loadingOverlay.classList.remove('hidden');
  loadingTitle.textContent = 'Converting Images...';
  const resolution = resolutionSelect.value;
  convertedBlobs = [];

  try {
    for (let i = 0; i < fileQueue.length; i++) {
      const item = fileQueue[i];
      loadingText.textContent = `Converting ${i + 1} of ${fileQueue.length}: ${item.originalName} ➔ ${item.format.toUpperCase()}...`;

      const blob = await convertSingleFile(item, resolution);
      const baseName = item.originalName.substring(0, item.originalName.lastIndexOf('.')) || item.originalName;
      const finalName = `${baseName}.${item.format}`;

      convertedBlobs.push({ name: finalName, blob: blob });
    }

    loadingOverlay.classList.add('hidden');
    thankYouSlide.classList.remove('hidden');

    if (convertedBlobs.length === 1) {
      successSubtitle.textContent = `Converted ${convertedBlobs[0].name} successfully.`;
      downloadButton.textContent = `Download ${convertedBlobs[0].name}`;
      downloadButton.onclick = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(convertedBlobs[0].blob);
        a.download = convertedBlobs[0].name;
        a.click();
      };
    } else {
      successSubtitle.textContent = `Successfully converted ${convertedBlobs.length} images into a ZIP archive.`;
      downloadButton.textContent = 'Download All as ZIP';
      downloadButton.onclick = async () => {
        const zip = new JSZip();
        convertedBlobs.forEach((item) => {
          zip.file(item.name, item.blob);
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = 'pixelmorph-converted-images.zip';
        a.click();
      };
    }
  } catch (err) {
    loadingOverlay.classList.add('hidden');
    alert('Conversion Error: ' + err.message);
  }
});

// =========================================================
// 8. Reset & Clear State
// =========================================================
function resetState() {
  fileQueue = [];
  convertedBlobs = [];
  fileInput.value = '';
  queueList.innerHTML = '';
  controlsCard.style.display = 'none';
  dropZone.style.display = 'block';
}

resetBtn.addEventListener('click', resetState);

convertMoreButton.addEventListener('click', () => {
  thankYouSlide.classList.add('hidden');
  resetState();
});