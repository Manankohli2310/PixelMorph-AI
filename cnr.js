const fileInput = document.getElementById("fileInput");
const imagePreview = document.getElementById("imagePreview");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resizeTools = document.getElementById("resizeTools");
const compressionTools = document.getElementById("compressionTools");
const resizerTool = document.getElementById("resizerTool");
const compressorTool = document.getElementById("compressorTool");
const resizeWidthInput = document.getElementById("resizeWidth");
const resizeHeightInput = document.getElementById("resizeHeight");
const compressionQualityInput = document.getElementById("compressionQuality");
const replaceButton = document.getElementById("replaceButton");
const aspectLock = document.getElementById("aspectLock");
const thankYouScreen = document.getElementById("thankyouoverlay"); 
const downloadButton = document.getElementById("downloadButton"); 
const convertMoreButton = document.getElementById("convertMoreButton"); 
const loadingScreen = document.getElementById("loadingScreen"); 

let img = new Image();
let originalWidth, originalHeight;
let aspectRatioLocked = false;
let imageUploaded = false;

resizerTool.addEventListener("click", () => {
  resizerTool.classList.add("active");
  compressorTool.classList.remove("active");
  resizeTools.style.display = "block";
  compressionTools.style.display = "none";
});

compressorTool.addEventListener("click", () => {
  compressorTool.classList.add("active");
  resizerTool.classList.remove("active");
  compressionTools.style.display = "block";
  resizeTools.style.display = "none";
});

resizeTools.style.display = "block";
compressionTools.style.display = "none";

imagePreview.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (!imageUploaded) imagePreview.classList.add("dragging");
});

imagePreview.addEventListener("dragleave", () => {
  if (!imageUploaded) imagePreview.classList.remove("dragging");
});

imagePreview.addEventListener("drop", (e) => {
  e.preventDefault();
  if (!imageUploaded) {
    imagePreview.classList.remove("dragging");
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }
});

imagePreview.addEventListener("click", () => {
  if (!imageUploaded) {
    fileInput.click();
  }
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
});

replaceButton.addEventListener("click", () => {
  fileInput.click();
});

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

img.onload = () => {
  originalWidth = img.width;
  originalHeight = img.height;

  const scale = Math.min(500 / originalWidth, 400 / originalHeight);
  const displayWidth = originalWidth * scale;
  const displayHeight = originalHeight * scale;

  canvas.width = displayWidth;
  canvas.height = displayHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

  resizeWidthInput.value = originalWidth;
  resizeHeightInput.value = originalHeight;

  imageUploaded = true;
  imagePreview.classList.add("inactive");
  replaceButton.classList.add("active");
  imagePreview.querySelector("p").textContent = "";
};

function showLoadingScreen() {
  loadingScreen.classList.add("active");
}

function hideLoadingScreen() {
  loadingScreen.classList.remove("active");
}

function showThankYouScreen(imageURL) {
  thankYouScreen.classList.add("active");
  downloadButton.href = imageURL; 
}

function hideThankYouScreen() {
  thankYouScreen.classList.remove("active");
}

function resizeImage() {
  const newWidth = parseInt(resizeWidthInput.value, 10);
  const newHeight = parseInt(resizeHeightInput.value, 10);

  if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) {
    alert("Please enter valid dimensions for resizing.");
    return;
  }

  showLoadingScreen();

  setTimeout(() => {
    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    const resizedImageURL = canvas.toDataURL("image/png");

    hideLoadingScreen();
    showThankYouScreen(resizedImageURL);
  }, 2000); 
}

function compressImage() {
  const quality = parseFloat(compressionQualityInput.value);

  if (isNaN(quality) || quality < 0.8 || quality > 1.0) {
    alert("Please enter a quality value between 0.8 and 1.0.");
    return;
  }

  showLoadingScreen();

  setTimeout(() => {
    const compressedImageURL = canvas.toDataURL("image/jpeg", quality);

    hideLoadingScreen();
    showThankYouScreen(compressedImageURL);
  }, 2000); 
}

convertMoreButton.addEventListener("click", () => {
  location.reload(); 
});

aspectLock.addEventListener("click", () => {
  aspectRatioLocked = !aspectRatioLocked;
  aspectLock.textContent = aspectRatioLocked ? "✔" : "✘";

  if (aspectRatioLocked) {
    resizeWidthInput.addEventListener("input", syncHeight);
    resizeHeightInput.addEventListener("input", syncWidth);
  } else {
    resizeWidthInput.removeEventListener("input", syncHeight);
    resizeHeightInput.removeEventListener("input", syncWidth);
  }
});

function syncHeight() {
  const newWidth = parseInt(resizeWidthInput.value, 10);
  if (!isNaN(newWidth) && originalWidth > 0) {
    resizeHeightInput.value = Math.round((newWidth * originalHeight) / originalWidth);
  }
}

function syncWidth() {
  const newHeight = parseInt(resizeHeightInput.value, 10);
  if (!isNaN(newHeight) && originalHeight > 0) {
    resizeWidthInput.value = Math.round((newHeight * originalWidth) / originalHeight);
  }
}
const thankYouSlide = document.getElementById('thankyouoverlay');

thankYouSlide.addEventListener('click', (e) => {
    if (e.target === thankYouSlide) {
        convertMoreButton.click();
    }
});
const hamburgerMenu = document.querySelector('.hamburger-menu');
const dropdownMenu = document.querySelector('.dropdown-menu');

hamburgerMenu.addEventListener('click', () => {
    dropdownMenu.classList.toggle('show');
});