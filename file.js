document.addEventListener('DOMContentLoaded', () => {
    const dragDropArea = document.getElementById('dragDropArea');
    const fileInput = document.getElementById('fileInput');
    const convertButton = document.getElementById('convertButton');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const thankYouSlide = document.getElementById('thankYouSlide');
    const downloadButton = document.getElementById('downloadButton');
    const convertMoreButton = document.getElementById('convertMoreButton');
    let selectedFormat = null;
    let selectedQuality = null;
    let fileToConvert = null;
    let convertedFileURL = null;

    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/x-icon', 'image/tiff'];

    loadingOverlay.classList.add('hidden');
    thankYouSlide.classList.add('hidden');

    function validateFileType(file) {
        if (!validImageTypes.includes(file.type)) {
            alert('Please upload a valid image file (jpg, png, webp, ico, tiff).');
            return false;
        }
        return true;
    }

    dragDropArea.addEventListener('click', () => fileInput.click());
    dragDropArea.addEventListener('dragover', (e) => e.preventDefault());
    dragDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length) {
            if (validateFileType(files[0])) {
                fileToConvert = files[0];
                dragDropArea.innerText = `File Added Successfully!`;
            } else {
                dragDropArea.innerText = 'Invalid file. Please upload an image.';
            }
        }
    });

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length) {
            if (validateFileType(files[0])) {
                fileToConvert = files[0];
                dragDropArea.innerText = `File Added Successfully!`;
            } else {
                dragDropArea.innerText = 'Invalid file. Please upload an image.';
            }
        }
    });

    document.querySelectorAll('.option-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.dataset.format) {
                selectedFormat = btn.dataset.format;
                document.querySelectorAll('.option-btn[data-format]').forEach((b) =>
                    b.classList.remove('selected')
                );
            }
            if (btn.dataset.quality) {
                selectedQuality = btn.dataset.quality;
                document.querySelectorAll('.option-btn[data-quality]').forEach((b) =>
                    b.classList.remove('selected')
                );
            }
            btn.classList.add('selected');
        });
    });

    convertButton.addEventListener('click', async () => {
        if (!fileToConvert) {
            alert('Please upload a file first!');
            return;
        }
        if (!selectedFormat || !selectedQuality) {
            alert('Please select both format and quality!');
            return;
        }

        loadingOverlay.classList.remove('hidden');

        try {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const convertedFileBlob = await convertFile(fileToConvert, selectedFormat, selectedQuality);
            convertedFileURL = URL.createObjectURL(convertedFileBlob);
            loadingOverlay.classList.add('hidden');
            thankYouSlide.classList.remove('hidden');
        } catch (error) {
            alert('File conversion failed. Please try again!');
            loadingOverlay.classList.add('hidden');
            dragDropArea.classList.remove('hidden');
        }
    });

    downloadButton.addEventListener('click', () => {
        if (convertedFileURL) {
            const a = document.createElement('a');
            a.href = convertedFileURL;
            a.download = `Pixel Morph.${selectedFormat}`;
            a.click();
        }
    });

    convertMoreButton.addEventListener('click', () => {
        thankYouSlide.classList.add('hidden');
        dragDropArea.classList.remove('hidden');
        dragDropArea.innerText = 'Convert More Files!';
        convertedFileURL = null;
        fileToConvert = null;
        document.querySelectorAll('.option-btn').forEach((btn) => btn.classList.remove('selected'));
    });

    async function convertFile(file, format, quality) {
        const image = await loadImage(file);

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        switch (quality) {
            case '1080p':
                canvas.width = 1920;
                canvas.height = (1920 / image.width) * image.height;
                break;
            case '720p':
                canvas.width = 1280;
                canvas.height = (1280 / image.width) * image.height;
                break;
            case '480p':
                canvas.width = 854;
                canvas.height = (854 / image.width) * image.height;
                break;
            default:
                canvas.width = image.width;
                canvas.height = image.height;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const mimeType = getMimeType(format);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType));
        return blob;
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();
            reader.onload = (e) => {
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function getMimeType(format) {
        switch (format) {
            case 'png':
                return 'image/png';
            case 'jpg':
                return 'image/jpeg';
            case 'webp':
                return 'image/webp';
            case 'ico':
                return 'image/x-icon';
            case 'tiff':
                return 'image/tiff';
            default:
                return 'image/png';
        }
    }
});

function showThankYouSlide() {
    document.getElementById('thankYouSlide').classList.remove('hidden');
    document.querySelector('.main-layout').classList.add('hidden');
}

function hideThankYouSlide() {
    document.getElementById('thankYouSlide').classList.add('hidden');
    document.querySelector('.main-layout').classList.remove('hidden');
}

const hamburgerMenu = document.querySelector('.hamburger-menu');
const dropdownMenu = document.querySelector('.dropdown-menu');

hamburgerMenu.addEventListener('click', () => {
    dropdownMenu.classList.toggle('show');
});

const thankYouSlide = document.getElementById('thankYouSlide');
const convertMoreButton = document.getElementById('convertMoreButton');

thankYouSlide.addEventListener('click', () => {
    convertMoreButton.click();
});