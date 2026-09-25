// =========================================================
// 1. DOM Elements & State
// =========================================================

// Tabs
const tabResizeCrop = document.getElementById("tabResizeCrop");
const tabCompress = document.getElementById("tabCompress");
const panelResizeCrop = document.getElementById("panelResizeCrop");
const panelCompress = document.getElementById("panelCompress");

// Upload & Controls
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("fileInput");
const controlsCard = document.getElementById("controls-card");
const fileNameLabel = document.getElementById("fileNameLabel");
const fileDimsLabel = document.getElementById("fileDimsLabel");
const fileSizeLabel = document.getElementById("fileSizeLabel");

// Workspace & Canvas
const workspaceContainer = document.getElementById("workspaceContainer");
const imageElement = document.getElementById("imageElement");
const previewCanvas = document.getElementById("previewCanvas");
const ctx = previewCanvas.getContext("2d");

// Sub-Toggles (Resize vs Crop)
const btnModeResize = document.getElementById("btnModeResize");
const btnModeCrop = document.getElementById("btnModeCrop");
const subpanelResize = document.getElementById("subpanelResize");
const subpanelCrop = document.getElementById("subpanelCrop");

// Resizer Elements
const resizeWidthInput = document.getElementById("resizeWidth");
const resizeHeightInput = document.getElementById("resizeHeight");
const aspectLockBtn = document.getElementById("aspectLockBtn");
const aspectLockIcon = document.getElementById("aspectLockIcon");
const scaleButtons = document.querySelectorAll(".preset-scale-row .preset-btn");
const executeResizeCropBtn = document.getElementById("executeResizeCropBtn");

// Cropper Action Buttons
const cropPresetButtons = document.querySelectorAll(".crop-presets-wrapper .preset-btn");
const btnRotateLeft = document.getElementById("btnRotateLeft");
const btnRotateRight = document.getElementById("btnRotateRight");
const btnFlipH = document.getElementById("btnFlipH");
const btnResetCrop = document.getElementById("btnResetCrop");

// Compressor Elements
const statOriginalSize = document.getElementById("statOriginalSize");
const statCompressedSize = document.getElementById("statCompressedSize");
const statSavings = document.getElementById("statSavings");
const compressionQuality = document.getElementById("compressionQuality");
const qualityDisplay = document.getElementById("qualityDisplay");
const targetSizeInput = document.getElementById("targetSizeInput");
const exportFormatSelect = document.getElementById("exportFormatSelect");
const executeCompressBtn = document.getElementById("executeCompressBtn");

// Overlays & Reset Buttons
const resetBtn1 = document.getElementById("resetBtn1");
const resetBtn2 = document.getElementById("resetBtn2");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingTitle = document.getElementById("loadingTitle");
const loadingText = document.getElementById("loadingText");
const thankYouOverlay = document.getElementById("thankYouOverlay");
const downloadButton = document.getElementById("downloadButton");
const convertMoreButton = document.getElementById("convertMoreButton");

const hamburgerBtn = document.getElementById("hamburger-btn");
const navMenu = document.getElementById("nav-menu");

// State Variables
let originalImage = new Image();
let originalFile = null;
let originalWidth = 0;
let originalHeight = 0;
let originalFileSize = 0;

let isAspectLocked = true;
let activeToolMode = "resize";
let cropperInstance = null;
let isFlippedH = false;

// Fixed dimensions for the canvas element to prevent DOM reflow
const CANVAS_STAGE_W = 800;
const CANVAS_STAGE_H = 440;

// =========================================================
// 2. Navigation & Mobile Hamburger Listeners
// =========================================================
if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        hamburgerBtn.classList.toggle("active");
        navMenu.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
        if (!navMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
            hamburgerBtn.classList.remove("active");
            navMenu.classList.remove("active");
        }
    });

    navMenu.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            hamburgerBtn.classList.remove("active");
            navMenu.classList.remove("active");
        });
    });
}

// =========================================================
// 3. Tab Switchers (Resize & Crop vs. Compressor)
// =========================================================
tabResizeCrop.addEventListener("click", () => {
    tabResizeCrop.classList.add("active");
    tabCompress.classList.remove("active");
    panelResizeCrop.style.display = "block";
    panelCompress.style.display = "none";
});

tabCompress.addEventListener("click", () => {
    tabCompress.classList.add("active");
    tabResizeCrop.classList.remove("active");
    panelCompress.style.display = "block";
    panelResizeCrop.style.display = "none";

    if (cropperInstance) {
        destroyCropper();
    }
    updateLiveResizePreview();
    updateCompressionEstimate();
});

// =========================================================
// 4. Drag & Drop File Upload Handling
// =========================================================
dropZone.addEventListener("click", () => fileInput.click());

["dragenter", "dragover"].forEach((name) => {
    dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#06b6d4";
        dropZone.style.background = "rgba(6, 182, 212, 0.08)";
    });
});

["dragleave", "drop"].forEach((name) => {
    dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "rgba(6, 182, 212, 0.24)";
        dropZone.style.background = "var(--card-bg)";
    });
});

dropZone.addEventListener("drop", (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processUploadedImage(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
        processUploadedImage(e.target.files[0]);
    }
});

function formatBytes(bytes) {
    if (bytes === 0) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

function processUploadedImage(file) {
    if (!file.type.startsWith("image/")) {
        alert("Please upload a valid image file.");
        return;
    }

    originalFile = file;
    originalFileSize = file.size;

    fileNameLabel.textContent = file.name;
    fileSizeLabel.textContent = formatBytes(file.size);
    statOriginalSize.textContent = formatBytes(file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage = new Image();
        originalImage.onload = () => {
            originalWidth = originalImage.naturalWidth || originalImage.width;
            originalHeight = originalImage.naturalHeight || originalImage.height;

            fileDimsLabel.textContent = `${originalWidth} × ${originalHeight} px`;
            resizeWidthInput.value = originalWidth;
            resizeHeightInput.value = originalHeight;

            // Initialize canvas buffer at fixed resolution
            previewCanvas.width = CANVAS_STAGE_W;
            previewCanvas.height = CANVAS_STAGE_H;

            updateLiveResizePreview();

            dropZone.style.display = "none";
            controlsCard.style.display = "block";

            updateCompressionEstimate();
        };
        originalImage.src = e.target.result;
        imageElement.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// =========================================================
// 5. Zero-Reflow Live Resizer Preview Engine
// =========================================================
function updateLiveResizePreview() {
    if (!originalImage || !originalImage.complete || activeToolMode !== "resize") return;

    const targetW = parseInt(resizeWidthInput.value, 10);
    const targetH = parseInt(resizeHeightInput.value, 10);

    if (isNaN(targetW) || isNaN(targetH) || targetW <= 0 || targetH <= 0) return;

    previewCanvas.style.display = "block";
    imageElement.style.display = "none";

    // 1. Calculate base scale for 100% size within the 800x440 canvas
    const baseScale = Math.min(CANVAS_STAGE_W / originalWidth, CANVAS_STAGE_H / originalHeight);

    // 2. Scale image relative to target dimensions
    let drawW = targetW * baseScale;
    let drawH = targetH * baseScale;

    // 3. Keep within canvas boundaries if enlarged past 100%
    const fitFactor = Math.min(1, CANVAS_STAGE_W / drawW, CANVAS_STAGE_H / drawH);
    drawW = Math.max(1, Math.round(drawW * fitFactor));
    drawH = Math.max(1, Math.round(drawH * fitFactor));

    // 4. Center the scaled image inside the static canvas
    const startX = Math.round((CANVAS_STAGE_W - drawW) / 2);
    const startY = Math.round((CANVAS_STAGE_H - drawH) / 2);

    // Draw inside static canvas: DOM tree never resizes, preventing any scroll jumps
    ctx.clearRect(0, 0, CANVAS_STAGE_W, CANVAS_STAGE_H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(originalImage, startX, startY, drawW, drawH);

    fileDimsLabel.textContent = `${targetW} × ${targetH} px`;
}

// =========================================================
// 6. Sub-Mode Toggle: Dimension Resizer vs. Cropper
// =========================================================
btnModeResize.addEventListener("click", () => {
    btnModeResize.classList.add("active");
    btnModeCrop.classList.remove("active");
    subpanelResize.style.display = "block";
    subpanelCrop.style.display = "none";
    activeToolMode = "resize";

    destroyCropper();
    updateLiveResizePreview();
});

btnModeCrop.addEventListener("click", () => {
    btnModeCrop.classList.add("active");
    btnModeResize.classList.remove("active");
    subpanelCrop.style.display = "block";
    subpanelResize.style.display = "none";
    activeToolMode = "crop";

    initCropper();
});

// =========================================================
// 7. Cropper.js Management
// =========================================================
function initCropper() {
    if (cropperInstance) destroyCropper();

    previewCanvas.style.display = "none";
    imageElement.style.display = "block";

    cropperInstance = new Cropper(imageElement, {
        aspectRatio: NaN,
        viewMode: 1,
        autoCropArea: 0.85,
        responsive: true,
        background: false,
    });
}

function destroyCropper() {
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    imageElement.style.display = "none";
    previewCanvas.style.display = "block";
}

cropPresetButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        cropPresetButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const ratio = parseFloat(btn.dataset.ratio);
        if (cropperInstance) {
            cropperInstance.setAspectRatio(isNaN(ratio) ? NaN : ratio);
        }
    });
});

btnRotateLeft.addEventListener("click", (e) => {
    e.preventDefault();
    if (cropperInstance) cropperInstance.rotate(-90);
});

btnRotateRight.addEventListener("click", (e) => {
    e.preventDefault();
    if (cropperInstance) cropperInstance.rotate(90);
});

btnFlipH.addEventListener("click", (e) => {
    e.preventDefault();
    if (cropperInstance) {
        isFlippedH = !isFlippedH;
        cropperInstance.scaleX(isFlippedH ? -1 : 1);
    }
});

btnResetCrop.addEventListener("click", (e) => {
    e.preventDefault();
    if (cropperInstance) cropperInstance.reset();
});

// =========================================================
// 8. Resizer Event Listeners (Zero-Scroll Jump)
// =========================================================
aspectLockBtn.addEventListener("click", (e) => {
    e.preventDefault();
    isAspectLocked = !isAspectLocked;
    aspectLockBtn.classList.toggle("active", isAspectLocked);
    aspectLockIcon.textContent = isAspectLocked ? "🔗 Locked" : "🔓 Unlocked";
});

resizeWidthInput.addEventListener("input", () => {
    if (isAspectLocked && originalWidth > 0) {
        const val = parseInt(resizeWidthInput.value, 10);
        if (!isNaN(val) && val > 0) {
            resizeHeightInput.value = Math.round((val * originalHeight) / originalWidth);
        }
    }
    updateLiveResizePreview();
});

resizeHeightInput.addEventListener("input", () => {
    if (isAspectLocked && originalHeight > 0) {
        const val = parseInt(resizeHeightInput.value, 10);
        if (!isNaN(val) && val > 0) {
            resizeWidthInput.value = Math.round((val * originalWidth) / originalHeight);
        }
    }
    updateLiveResizePreview();
});

scaleButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        const scale = parseFloat(btn.dataset.scale);
        resizeWidthInput.value = Math.round(originalWidth * scale);
        resizeHeightInput.value = Math.round(originalHeight * scale);
        updateLiveResizePreview();
    });
});

// Execute Resize or Crop
executeResizeCropBtn.addEventListener("click", (e) => {
    e.preventDefault();
    loadingOverlay.classList.remove("hidden");
    loadingTitle.textContent = "Processing Image...";

    setTimeout(() => {
        let outputCanvas;

        if (activeToolMode === "crop" && cropperInstance) {
            outputCanvas = cropperInstance.getCroppedCanvas({
                imageSmoothingEnabled: true,
                imageSmoothingQuality: "high",
            });
        } else {
            const targetW = parseInt(resizeWidthInput.value, 10) || originalWidth;
            const targetH = parseInt(resizeHeightInput.value, 10) || originalHeight;

            outputCanvas = document.createElement("canvas");
            outputCanvas.width = targetW;
            outputCanvas.height = targetH;
            const oCtx = outputCanvas.getContext("2d");
            oCtx.imageSmoothingEnabled = true;
            oCtx.imageSmoothingQuality = "high";
            oCtx.drawImage(originalImage, 0, 0, targetW, targetH);
        }

        outputCanvas.toBlob((blob) => {
            const outputUrl = URL.createObjectURL(blob);
            loadingOverlay.classList.add("hidden");
            thankYouOverlay.classList.remove("hidden");

            const ext = originalFile.name.split(".").pop() || "png";
            downloadButton.href = outputUrl;
            downloadButton.download = `pixelmorph-${activeToolMode}-${Date.now()}.${ext}`;
        }, originalFile.type || "image/png", 0.95);
    }, 400);
});

// =========================================================
// 9. Smart Compressor Logic (Real-Time Estimation & Quality)
// =========================================================
compressionQuality.addEventListener("input", () => {
    qualityDisplay.textContent = `${compressionQuality.value}%`;
    updateCompressionEstimate();
});

exportFormatSelect.addEventListener("change", updateCompressionEstimate);
targetSizeInput.addEventListener("input", updateCompressionEstimate);

function updateCompressionEstimate() {
    if (!originalImage || !originalWidth) return;

    const quality = parseFloat(compressionQuality.value) / 100;
    const mime = exportFormatSelect.value;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = originalWidth;
    tempCanvas.height = originalHeight;
    const tCtx = tempCanvas.getContext("2d");
    tCtx.drawImage(originalImage, 0, 0);

    tempCanvas.toBlob((blob) => {
        if (!blob) return;
        const compSize = blob.size;
        statCompressedSize.textContent = formatBytes(compSize);

        const savedBytes = originalFileSize - compSize;
        const savedPercent = Math.round((savedBytes / originalFileSize) * 100);

        if (savedPercent > 0) {
            statSavings.textContent = `${savedPercent}% Saved`;
            statSavings.className = "stat-value highlight";
        } else {
            statSavings.textContent = `0% Saved`;
            statSavings.className = "stat-value";
        }
    }, mime, quality);
}

executeCompressBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    loadingOverlay.classList.remove("hidden");
    loadingTitle.textContent = "Compressing Image...";
    loadingText.textContent = "Applying quality quantization and encoding...";

    const targetKB = parseFloat(targetSizeInput.value);
    const mime = exportFormatSelect.value;
    let quality = parseFloat(compressionQuality.value) / 100;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = originalWidth;
    tempCanvas.height = originalHeight;
    const tCtx = tempCanvas.getContext("2d");
    tCtx.drawImage(originalImage, 0, 0);

    if (!isNaN(targetKB) && targetKB > 0 && mime !== "image/png") {
        const targetBytes = targetKB * 1024;
        let minQ = 0.05, maxQ = 0.98;

        for (let i = 0; i < 6; i++) {
            quality = (minQ + maxQ) / 2;
            const b = await new Promise((r) => tempCanvas.toBlob(r, mime, quality));
            if (b.size > targetBytes) {
                maxQ = quality;
            } else {
                minQ = quality;
            }
        }
    }

    tempCanvas.toBlob((blob) => {
        const outputUrl = URL.createObjectURL(blob);
        loadingOverlay.classList.add("hidden");
        thankYouOverlay.classList.remove("hidden");

        const ext = mime === "image/png" ? "png" : (mime === "image/webp" ? "webp" : "jpg");
        downloadButton.href = outputUrl;
        downloadButton.download = `pixelmorph-compressed-${Date.now()}.${ext}`;
    }, mime, quality);
});

// =========================================================
// 10. Reset & Clear State
// =========================================================
function resetState() {
    destroyCropper();
    originalImage = new Image();
    originalFile = null;
    originalWidth = 0;
    originalHeight = 0;
    fileInput.value = "";
    targetSizeInput.value = "";
    controlsCard.style.display = "none";
    dropZone.style.display = "block";
}

resetBtn1.addEventListener("click", resetState);
resetBtn2.addEventListener("click", resetState);

convertMoreButton.addEventListener("click", (e) => {
    e.preventDefault();
    thankYouOverlay.classList.add("hidden");
    resetState();
});