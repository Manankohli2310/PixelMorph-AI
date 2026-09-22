// =========================================================
// 1. DOM Element Selectors & Global State
// =========================================================

// Upload & Controls
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const controls = document.getElementById('controls');
const fileNameLabel = document.getElementById('file-name-label');
const fileDimsLabel = document.getElementById('file-dims-label');

const modelSelect = document.getElementById('model-select');
const scaleSelect = document.getElementById('scale-select');
const qualitySelect = document.getElementById('quality-select');
const formatSelect = document.getElementById('format-select');
const faceToggle = document.getElementById('face-toggle');
const clarityToggle = document.getElementById('clarity-toggle');
const enhanceBtn = document.getElementById('enhance-btn');
const faceDetectBadge = document.getElementById('face-detect-badge');
// Progress & Countdown Elements
const loader = document.getElementById('loader');
const loaderSubtext = document.getElementById('loader-subtext');
const progressStageLabel = document.getElementById('progress-stage-label');
const progressTimer = document.getElementById('progress-timer');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressPercent = document.getElementById('progress-percent');
const progressTilesCount = document.getElementById('progress-tiles-count');

// Comparison Viewer & Results
const resultView = document.getElementById('result-view');
const comparisonBox = document.getElementById('comparison-box');
const imgBefore = document.getElementById('img-before');
const imgAfter = document.getElementById('img-after');
const splitSlider = document.getElementById('split-slider');

// Telemetry Stats
const statRes = document.getElementById('stat-res');
const statMp = document.getElementById('stat-mp');
const statTime = document.getElementById('stat-time');
const statModel = document.getElementById('stat-model');

// Mobile Hamburger Menu Toggle
const hamburgerBtn = document.getElementById('hamburger-btn');
const navMenu = document.getElementById('nav-menu');

// Zoom Toolbar Elements
const zoomBtns = document.querySelectorAll('.zoom-btn[data-zoom]');
const zoomResetBtn = document.getElementById('zoom-reset-btn');

// Download & Reset Actions
const downloadBtn = document.getElementById('download-btn');
const downloadFormatLabel = document.getElementById('download-format-label');
const resetBtn = document.getElementById('reset-btn');

// State Variables
let selectedFile = null;
let pollInterval = null;

// Automatically detects whether you are on localhost or mobile IP!
const BACKEND_URL = window.location.origin;

// Zoom & Pan State
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;


// =========================================================
// 2. Mobile Hamburger Menu Listeners
// =========================================================
if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hamburgerBtn.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
            hamburgerBtn.classList.remove('active');
            navMenu.classList.remove('active');
        }
    });

    // Close menu when a link inside is clicked
    navMenu.querySelectorAll('a').forEach(link => {
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

['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#f59e0b';
        dropZone.style.background = 'rgba(245, 158, 11, 0.08)';
    });
});

['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = 'rgba(255, 175, 45, 0.22)';
        dropZone.style.background = 'var(--card-bg)';
    });
});

dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processUploadedFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
        processUploadedFile(e.target.files[0]);
    }
});

function processUploadedFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload a valid image (PNG, JPG, or WEBP).');
        return;
    }

    selectedFile = file;
    fileNameLabel.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        const tempImg = new Image();
        tempImg.onload = () => {
            fileDimsLabel.textContent = `Original: ${tempImg.naturalWidth} × ${tempImg.naturalHeight} px`;
            imgBefore.src = e.target.result;
            dropZone.style.display = 'none';
            controls.style.display = 'block';

            // Trigger instant lightweight face pre-scan (Takes ~20ms)
            scanForFacesImmediately(file);
        };
        tempImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Instant Pre-Scan Function
async function scanForFacesImmediately(file) {
    if (!faceDetectBadge) return;

    faceDetectBadge.style.display = 'inline-block';
    faceDetectBadge.className = 'detect-badge';
    faceDetectBadge.textContent = 'Scanning for faces...';

    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await fetch(`${BACKEND_URL}/api/detect-faces`, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            if (data.has_faces) {
                // Auto-tick the checkbox
                faceToggle.checked = true;
                faceDetectBadge.className = 'detect-badge found';
                faceDetectBadge.textContent = `✓ ${data.face_count} face(s) found (Auto-enabled)`;
            } else {
                // Leave unticked
                faceToggle.checked = false;
                faceDetectBadge.className = 'detect-badge none';
                faceDetectBadge.textContent = 'No faces detected';
            }
        }
    } catch (err) {
        faceDetectBadge.style.display = 'none';
    }
}


// =========================================================
// 4. Comparison Slider & Format Listeners
// =========================================================
splitSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    comparisonBox.style.setProperty('--split-pos', `${val}%`);
});

formatSelect.addEventListener('change', () => {
    downloadFormatLabel.textContent = formatSelect.value;
});


// =========================================================
// 5. Interactive Zoom & Pan (ROI Magnifier)
// =========================================================
function applyZoomPan() {
    comparisonBox.style.setProperty('--zoom', currentZoom);
    comparisonBox.style.setProperty('--pan-x', `${panX}px`);
    comparisonBox.style.setProperty('--pan-y', `${panY}px`);

    if (currentZoom > 1) {
        comparisonBox.classList.add('is-zoomed');
    } else {
        comparisonBox.classList.remove('is-zoomed');
        panX = 0;
        panY = 0;
        comparisonBox.style.setProperty('--pan-x', '0px');
        comparisonBox.style.setProperty('--pan-y', '0px');
    }

    zoomBtns.forEach(btn => {
        if (parseFloat(btn.dataset.zoom) === currentZoom) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function setZoom(val) {
    currentZoom = Math.min(Math.max(val, 1), 5);
    applyZoomPan();
}

zoomBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setZoom(parseFloat(btn.dataset.zoom));
    });
});

zoomResetBtn.addEventListener('click', () => {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    applyZoomPan();
});

// Mouse Wheel Zoom
comparisonBox.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoom(currentZoom + delta);
}, { passive: false });

// Pan on Drag (when zoomed)
comparisonBox.addEventListener('mousedown', (e) => {
    if (currentZoom > 1 && e.button === 0) {
        // Prevent pan if user clicks directly on the range slider thumb
        const thumbPos = (splitSlider.value / 100) * comparisonBox.clientWidth;
        if (Math.abs(e.offsetX - thumbPos) < 26) {
            return;
        }
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        comparisonBox.classList.add('is-panning');
    }
});

window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyZoomPan();
});

window.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        comparisonBox.classList.remove('is-panning');
    }
});


// =========================================================
// 6. Dynamic Server-Synchronized Execution & Real-Time Polling
// =========================================================
enhanceBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    controls.style.display = 'none';
    loader.style.display = 'block';

    const chosenFormat = formatSelect.value;
    const chosenModel = modelSelect.value;
    const chosenQuality = qualitySelect.value;
    const isFaceRestore = faceToggle.checked;

    // Reset progress UI state
    progressBarFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressTilesCount.textContent = 'Preparing...';
    progressTimer.textContent = '⏱️ Calculating time on CPU...';
    progressStageLabel.textContent = 'Initializing neural network...';
    loaderSubtext.textContent = `Processing image with ${chosenModel === 'anime' ? 'Anime 6B' : 'Real-ESRGAN'}...`;

    // 1. Dispatch background job to server
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('model_type', chosenModel);
    formData.append('scale', scaleSelect.value);
    formData.append('quality_mode', chosenQuality);
    formData.append('clarity_boost', clarityToggle.checked);
    formData.append('face_restore', isFaceRestore);
    formData.append('output_format', chosenFormat);

    try {
        const startRes = await fetch(`${BACKEND_URL}/api/enhance/start`, {
            method: 'POST',
            body: formData
        });

        if (!startRes.ok) {
            throw new Error('Failed to initiate enhancement on server');
        }

        const { job_id } = await startRes.json();

        // 2. Poll server every 600ms for actual CPU measurements
        const pollProgress = async () => {
            try {
                const progRes = await fetch(`${BACKEND_URL}/api/enhance/progress/${job_id}`);
                if (!progRes.ok) return;

                const data = await progRes.json();

                if (data.status === 'failed') {
                    throw new Error(data.error || 'Server processing failed');
                }

                if (data.status === 'processing') {
                    const currentTile = data.current_tile;
                    const totalTiles = data.total_tiles;
                    const percent = data.percent;
                    const etaSeconds = data.eta_seconds;

                    progressBarFill.style.width = `${percent}%`;
                    progressPercent.textContent = `${percent}%`;
                    progressTilesCount.textContent = `Tile ${currentTile} / ${totalTiles}`;
                    progressStageLabel.textContent = data.stage;

                    if (etaSeconds !== null && etaSeconds !== undefined) {
                        progressTimer.textContent = `⏱️ ~${etaSeconds}s remaining`;
                    } else {
                        progressTimer.textContent = '⏱️ Timing Tile 1 on your CPU...';
                    }
                }

                if (data.status === 'completed') {
                    clearInterval(pollInterval);

                    progressBarFill.style.width = '100%';
                    progressPercent.textContent = '100%';
                    progressStageLabel.textContent = 'Completed!';
                    progressTimer.textContent = '⏱️ Done!';

                    // 3. Retrieve final image result
                    const resultRes = await fetch(`${BACKEND_URL}/api/enhance/result/${job_id}`);
                    if (!resultRes.ok) throw new Error('Failed to retrieve image result');

                    // Parse Telemetry Headers
                    const execTimeStr = resultRes.headers.get('X-Execution-Time') || '';
                    const origDims = resultRes.headers.get('X-Original-Dims') || '';
                    const enhDims = resultRes.headers.get('X-Enhanced-Dims') || '';
                    const origMp = resultRes.headers.get('X-Original-MP') || '';
                    const enhMp = resultRes.headers.get('X-Enhanced-MP') || '';
                    const modelName = resultRes.headers.get('X-Model-Name') || 'Real-ESRGAN';

                    statRes.textContent = `${origDims} ➔ ${enhDims}`;
                    statMp.textContent = `${origMp} ➔ ${enhMp}`;
                    statTime.textContent = execTimeStr;
                    statModel.textContent = modelName;

                    const blob = await resultRes.blob();
                    const outputUrl = URL.createObjectURL(blob);

                    imgAfter.src = outputUrl;
                    downloadBtn.href = outputUrl;

                    // Dynamic Download Filename & Extension
                    const ext = chosenFormat.toLowerCase();
                    const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || 'image';
                    downloadBtn.download = `pixelmorph-${baseName}-${scaleSelect.value}x.${ext}`;
                    downloadFormatLabel.textContent = chosenFormat;

                    // Reset Split Slider & Zoom for clean inspection
                    splitSlider.value = 50;
                    comparisonBox.style.setProperty('--split-pos', '50%');
                    currentZoom = 1;
                    panX = 0;
                    panY = 0;
                    applyZoomPan();

                    // Reveal Result View
                    setTimeout(() => {
                        loader.style.display = 'none';
                        resultView.style.display = 'block';
                    }, 400);
                }
            } catch (err) {
                clearInterval(pollInterval);
                alert('Enhancement Error: ' + err.message);
                loader.style.display = 'none';
                controls.style.display = 'block';
            }
        };

        pollInterval = setInterval(pollProgress, 600);

    } catch (err) {
        alert('Connection Error: ' + err.message);
        loader.style.display = 'none';
        controls.style.display = 'block';
    }
});


// =========================================================
// 7. Reset & Enhance Another File
// =========================================================
resetBtn.addEventListener('click', () => {
    if (pollInterval) {
        clearInterval(pollInterval);
    }

    if (faceDetectBadge) {
    faceDetectBadge.style.display = 'none';
    faceDetectBadge.textContent = '';
    }
    selectedFile = null;
    fileInput.value = '';
    resultView.style.display = 'none';
    controls.style.display = 'none';
    dropZone.style.display = 'block';
    imgBefore.src = '';
    imgAfter.src = '';

    currentZoom = 1;
    panX = 0;
    panY = 0;
    applyZoomPan();
});