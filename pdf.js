// External Libraries (Loaded via CDN in HTML)
const { PDFDocument } = PDFLib;

// PDF.js Worker Configuration
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// =========================================================
// 1. DOM Elements
// =========================================================
// Mode Tabs
const tabImgToPdf = document.getElementById('tabImgToPdf');
const tabPdfToImg = document.getElementById('tabPdfToImg');
const sectionImgToPdf = document.getElementById('sectionImgToPdf');
const sectionPdfToImg = document.getElementById('sectionPdfToImg');

// Images to PDF Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const controlsCard = document.getElementById('controls-card');
const fileCountLabel = document.getElementById('fileCountLabel');
const addMoreBtn = document.getElementById('addMoreBtn');
const imageGrid = document.getElementById('imageGrid');
const pageLayoutSelect = document.getElementById('pageLayoutSelect');
const scanFilterSelect = document.getElementById('scanFilterSelect');
const docDetectBadge = document.getElementById('docDetectBadge');

const docNameInput = document.getElementById('docName');
const authorNameInput = document.getElementById('authorName');
const subjectInput = document.getElementById('subject');
const keywordsInput = document.getElementById('keywords');

const convertButton = document.getElementById('convertButton');
const resetImagesBtn = document.getElementById('resetImagesBtn');

// PDF to Images Elements
const pdfDropZone = document.getElementById('pdfDropZone');
const pdfFileInput = document.getElementById('pdfFileInput');
const pdfExtractCard = document.getElementById('pdfExtractCard');
const pdfFileNameLabel = document.getElementById('pdfFileNameLabel');
const pdfPageCountLabel = document.getElementById('pdfPageCountLabel');
const pdfPagesGrid = document.getElementById('pdfPagesGrid');
const pdfExportFormat = document.getElementById('pdfExportFormat');
const downloadAllImagesBtn = document.getElementById('downloadAllImagesBtn');
const resetPdfBtn = document.getElementById('resetPdfBtn');

// Overlays & Navigation
const thankYouOverlay = document.getElementById('thankYouOverlay');
const downloadButton = document.getElementById('downloadButton');
const convertMoreButton = document.getElementById('convertMoreButton');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingTitle = document.getElementById('loadingTitle');
const loadingText = document.getElementById('loadingText');

const hamburgerBtn = document.getElementById('hamburger-btn');
const navMenu = document.getElementById('nav-menu');

// State Variables
let selectedImageFiles = [];
let extractedPdfPages = [];

// =========================================================
// 2. Navigation & Mode Switcher Listeners
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

    navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburgerBtn.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
}

tabImgToPdf.addEventListener('click', () => {
    tabImgToPdf.classList.add('active');
    tabPdfToImg.classList.remove('active');
    sectionImgToPdf.style.display = 'block';
    sectionPdfToImg.style.display = 'none';
});

tabPdfToImg.addEventListener('click', () => {
    tabPdfToImg.classList.add('active');
    tabImgToPdf.classList.remove('active');
    sectionImgToPdf.style.display = 'none';
    sectionPdfToImg.style.display = 'block';
});

// =========================================================
// 3. Client-Side Document Auto-Detection Engine (Canvas)
// =========================================================
function analyzeIfDocument(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const canvas = document.createElement('canvas');
            const sampleSize = 160;
            canvas.width = sampleSize;
            canvas.height = sampleSize;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

            const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
            const data = imgData.data;
            const totalPixels = sampleSize * sampleSize;

            let whitePaperCount = 0;
            let darkTextCount = 0;
            let saturatedColorCount = 0;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const maxC = Math.max(r, g, b);
                const minC = Math.min(r, g, b);
                const saturation = maxC - minC;
                const brightness = (r + g + b) / 3;

                // Paper Background Check: Bright, low chromatic variance
                if (brightness > 175 && saturation < 25) {
                    whitePaperCount++;
                }

                // Dark Ink/Text Check: High contrast, dark pixels
                if (brightness < 100 && saturation < 35) {
                    darkTextCount++;
                }

                // Color Saliency: High saturation indicates natural scenery, sky, skin, foliage
                if (saturation > 38) {
                    saturatedColorCount++;
                }
            }

            const whiteRatio = whitePaperCount / totalPixels;
            const textRatio = darkTextCount / totalPixels;
            const colorRatio = saturatedColorCount / totalPixels;

            // Decision: High white background + low colors + clear text strokes
            const isDoc = (whiteRatio > 0.45 && colorRatio < 0.18 && textRatio > 0.01) ||
                          (whiteRatio > 0.60 && colorRatio < 0.25);

            resolve(isDoc);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(false);
        };

        img.src = objectUrl;
    });
}

async function runAutoDocumentClassification(files) {
    if (!docDetectBadge || files.length === 0) return;

    docDetectBadge.style.display = 'inline-block';
    docDetectBadge.className = 'detect-badge';
    docDetectBadge.textContent = 'Scanning image type...';

    // Sample up to first 3 images for instant sub-10ms response
    const samplesToTest = files.slice(0, 3);
    const results = await Promise.all(samplesToTest.map(analyzeIfDocument));
    const documentCount = results.filter(Boolean).length;
    const isDocumentCollection = (documentCount / results.length) >= 0.5;

    if (isDocumentCollection) {
        // Auto-switch to Enhanced Scan mode
        scanFilterSelect.value = 'magic';
        docDetectBadge.className = 'detect-badge doc-found';
        docDetectBadge.textContent = '✓ Document detected (Auto-Scan enabled)';
    } else {
        // Leave at Original Colors
        scanFilterSelect.value = 'original';
        docDetectBadge.className = 'detect-badge photo-found';
        docDetectBadge.textContent = '🖼️ Photo detected (Original colors)';
    }
}

// =========================================================
// 4. Images to PDF: Upload & Sortable Grid
// =========================================================
dropZone.addEventListener('click', () => fileInput.click());
addMoreBtn.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#d946ef';
        dropZone.style.background = 'rgba(217, 70, 239, 0.08)';
    });
});

['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(217, 70, 239, 0.24)';
        dropZone.style.background = 'var(--card-bg)';
    });
});

dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleImageFiles(Array.from(e.dataTransfer.files));
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
        handleImageFiles(Array.from(e.target.files));
    }
});

function handleImageFiles(newFiles) {
    const validImages = newFiles.filter(f => f.type.startsWith('image/') || f.name.match(/\.(jfif|webp|png|jpg|jpeg|avif)$/i));
    if (validImages.length === 0) {
        alert('Please select valid image files.');
        return;
    }

    selectedImageFiles = [...selectedImageFiles, ...validImages];
    renderImageGrid();

    dropZone.style.display = 'none';
    controlsCard.style.display = 'block';

    // Trigger instant client-side document detection
    runAutoDocumentClassification(selectedImageFiles);
}

function renderImageGrid() {
    imageGrid.innerHTML = '';
    fileCountLabel.textContent = `${selectedImageFiles.length} image(s) selected`;

    selectedImageFiles.forEach((file, idx) => {
        const item = document.createElement('div');
        item.className = 'image-item';
        item.dataset.index = idx;

        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove image';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedImageFiles.splice(idx, 1);
            if (selectedImageFiles.length === 0) {
                resetImagesState();
            } else {
                renderImageGrid();
                runAutoDocumentClassification(selectedImageFiles);
            }
        });

        item.appendChild(img);
        item.appendChild(removeBtn);
        imageGrid.appendChild(item);
    });

    new Sortable(imageGrid, {
        animation: 150,
        onEnd() {
            const reorderedIndices = Array.from(imageGrid.children).map(child => parseInt(child.dataset.index, 10));
            selectedImageFiles = reorderedIndices.map(i => selectedImageFiles[i]);
            renderImageGrid();
        }
    });
}

function resetImagesState() {
    selectedImageFiles = [];
    fileInput.value = '';
    imageGrid.innerHTML = '';
    controlsCard.style.display = 'none';
    dropZone.style.display = 'block';
    if (docDetectBadge) {
        docDetectBadge.style.display = 'none';
    }
}

resetImagesBtn.addEventListener('click', resetImagesState);

// =========================================================
// 5. Bulletproof Image Processor & Scan Filter (Fixes SOI Error)
// =========================================================
function processImageToCleanBuffer(file, filterMode) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0);

            if (filterMode === 'magic' || filterMode === 'bw') {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;

                if (filterMode === 'magic') {
                    for (let i = 0; i < data.length; i += 4) {
                        let r = data[i], g = data[i + 1], b = data[i + 2];
                        data[i] = Math.min(255, Math.max(0, (r - 128) * 1.35 + 145));
                        data[i + 1] = Math.min(255, Math.max(0, (g - 128) * 1.35 + 145));
                        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.35 + 145));
                    }
                } else if (filterMode === 'bw') {
                    for (let i = 0; i < data.length; i += 4) {
                        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                        const val = gray > 140 ? 255 : (gray < 80 ? 0 : (gray - 80) * 4.25);
                        data[i] = val;
                        data[i + 1] = val;
                        data[i + 2] = val;
                    }
                }
                ctx.putImageData(imgData, 0, 0);
            }

            const isPng = file.type === 'image/png';
            const mime = isPng ? 'image/png' : 'image/jpeg';

            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("Canvas conversion failed"));
                    return;
                }
                blob.arrayBuffer().then((buffer) => {
                    resolve({
                        buffer,
                        isPng,
                        width: canvas.width,
                        height: canvas.height
                    });
                }).catch(reject);
            }, mime, 0.95);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`Failed to load image: ${file.name}`));
        };

        img.src = objectUrl;
    });
}

// =========================================================
// 6. Convert Images to PDF (With Default A4 Width Fit)
// =========================================================
convertButton.addEventListener('click', async () => {
    if (selectedImageFiles.length === 0) {
        alert('Please upload at least one image.');
        return;
    }

    loadingOverlay.classList.remove('hidden');
    loadingTitle.textContent = 'Compiling PDF Document...';
    loadingText.textContent = 'Processing document scan filters & page layouts...';

    const layout = pageLayoutSelect.value;
    const filter = scanFilterSelect.value;

    const docName = docNameInput.value.trim() || 'PixelMorph-Document';
    const author = authorNameInput.value.trim() || 'Pixel Morph';
    const subject = subjectInput.value.trim() || '';
    const keywords = keywordsInput.value.trim() || '';

    try {
        const pdfDoc = await PDFDocument.create();
        pdfDoc.setTitle(docName);
        pdfDoc.setAuthor(author);
        pdfDoc.setSubject(subject);
        pdfDoc.setKeywords(keywords.split(',').map(k => k.trim()));

        for (let i = 0; i < selectedImageFiles.length; i++) {
            loadingText.textContent = `Rendering page ${i + 1} of ${selectedImageFiles.length}...`;

            const { buffer, isPng, width: imgW, height: imgH } = await processImageToCleanBuffer(selectedImageFiles[i], filter);

            let embeddedImg;
            if (isPng) {
                embeddedImg = await pdfDoc.embedPng(buffer);
            } else {
                embeddedImg = await pdfDoc.embedJpg(buffer);
            }

            // 1. DEFAULT: Standard A4 Width with Proportional Height (Zero Side Margins)
            if (layout === 'a4-fit') {
                const pageW = 595.28;
                const pageH = (pageW * imgH) / imgW;
                const page = pdfDoc.addPage([pageW, pageH]);
                page.drawImage(embeddedImg, {
                    x: 0,
                    y: 0,
                    width: pageW,
                    height: pageH
                });

            // 2. Raw Original Image Dimensions
            } else if (layout === 'fit') {
                const page = pdfDoc.addPage([imgW, imgH]);
                page.drawImage(embeddedImg, { 
                    x: 0, 
                    y: 0, 
                    width: imgW, 
                    height: imgH 
                });

            // 3. Fixed A4 Portrait with Centering
            } else if (layout === 'portrait') {
                const pageW = 595.28;
                const pageH = 841.89;
                const page = pdfDoc.addPage([pageW, pageH]);
                const scale = Math.min(pageW / imgW, pageH / imgH);
                const drawW = imgW * scale;
                const drawH = imgH * scale;
                page.drawImage(embeddedImg, {
                    x: (pageW - drawW) / 2,
                    y: (pageH - drawH) / 2,
                    width: drawW,
                    height: drawH
                });

            // 4. Fixed A4 Landscape with Centering
            } else if (layout === 'landscape') {
                const pageW = 841.89;
                const pageH = 595.28;
                const page = pdfDoc.addPage([pageW, pageH]);
                const scale = Math.min(pageW / imgW, pageH / imgH);
                const drawW = imgW * scale;
                const drawH = imgH * scale;
                page.drawImage(embeddedImg, {
                    x: (pageW - drawW) / 2,
                    y: (pageH - drawH) / 2,
                    width: drawW,
                    height: drawH
                });
            }
        }

        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);

        loadingOverlay.classList.add('hidden');
        thankYouOverlay.classList.remove('hidden');

        downloadButton.onclick = () => {
            const a = document.createElement('a');
            a.href = pdfUrl;
            a.download = `${docName}.pdf`;
            a.click();
        };

        convertMoreButton.onclick = () => {
            thankYouOverlay.classList.add('hidden');
            resetImagesState();
        };

    } catch (err) {
        loadingOverlay.classList.add('hidden');
        alert('PDF Generation failed: ' + err.message);
    }
});

// =========================================================
// 7. PDF to Images (Vice Versa Extraction + ZIP)
// =========================================================
pdfDropZone.addEventListener('click', () => pdfFileInput.click());

pdfFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        processPdfFile(e.target.files[0]);
    }
});

async function processPdfFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }

    loadingOverlay.classList.remove('hidden');
    loadingTitle.textContent = 'Extracting PDF Pages...';
    loadingText.textContent = 'Rendering pages to high-res raster images...';

    pdfFileNameLabel.textContent = file.name;
    extractedPdfPages = [];
    pdfPagesGrid.innerHTML = '';

    try {
        const fileData = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: fileData }).promise;
        const totalPages = pdf.numPages;
        pdfPageCountLabel.textContent = `${totalPages} page(s) extracted`;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            loadingText.textContent = `Extracting Page ${pageNum} of ${totalPages}...`;
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            await page.render({ canvasContext: ctx, viewport }).promise;

            const dataUrl = canvas.toDataURL('image/png');
            extractedPdfPages.push({ pageNum, canvas, dataUrl });

            const item = document.createElement('div');
            item.className = 'image-item';
            const img = document.createElement('img');
            img.src = dataUrl;
            item.appendChild(img);
            pdfPagesGrid.appendChild(item);
        }

        loadingOverlay.classList.add('hidden');
        pdfDropZone.style.display = 'none';
        pdfExtractCard.style.display = 'block';

    } catch (err) {
        loadingOverlay.classList.add('hidden');
        alert('Failed to read PDF: ' + err.message);
    }
}

downloadAllImagesBtn.addEventListener('click', async () => {
    if (extractedPdfPages.length === 0) return;

    loadingOverlay.classList.remove('hidden');
    loadingTitle.textContent = 'Creating ZIP Archive...';
    loadingText.textContent = 'Packaging all pages into a zip file...';

    const zip = new JSZip();
    const format = pdfExportFormat.value;
    const baseName = pdfFileNameLabel.textContent.replace('.pdf', '');

    for (const item of extractedPdfPages) {
        const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const ext = format === 'jpeg' ? 'jpg' : 'png';
        const imgData = item.canvas.toDataURL(mime, 0.95).split(',')[1];
        zip.file(`${baseName}-page-${item.pageNum}.${ext}`, imgData, { base64: true });
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);

    loadingOverlay.classList.add('hidden');
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = `${baseName}-images.zip`;
    a.click();
});

resetPdfBtn.addEventListener('click', () => {
    pdfFileInput.value = '';
    extractedPdfPages = [];
    pdfPagesGrid.innerHTML = '';
    pdfExtractCard.style.display = 'none';
    pdfDropZone.style.display = 'block';
});