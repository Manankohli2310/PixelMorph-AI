import os
import time
import urllib.request
import cv2
import torch
import numpy as np
from PIL import Image, ImageFilter
from io import BytesIO
from spandrel import ModelLoader

# Allocate all CPU threads for PyTorch operations
torch.set_num_threads(os.cpu_count() or 4)
DEVICE = torch.device("cpu")

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "weights")

# Model Registry
MODELS_CONFIG = {
    "general": {
        "filename": "RealESRGAN_x4plus.pth",
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        "name": "General Photo (x4plus)"
    },
    "anime": {
        "filename": "RealESRGAN_x4plus_anime_6B.pth",
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth",
        "name": "Digital Art / Anime (6B Compact)"
    }
}

_loaded_models = {}

def get_model(model_type: str = "general"):
    if model_type not in MODELS_CONFIG:
        model_type = "general"

    cfg = MODELS_CONFIG[model_type]
    file_path = os.path.join(WEIGHTS_DIR, cfg["filename"])

    if model_type not in _loaded_models:
        os.makedirs(WEIGHTS_DIR, exist_ok=True)
        if not os.path.exists(file_path):
            print(f"[AI] Downloading {cfg['name']} weights...")
            urllib.request.urlretrieve(cfg["url"], file_path)
            print(f"[AI] {cfg['name']} downloaded.")

        print(f"[AI] Loading {cfg['name']} into CPU memory...")
        loader = ModelLoader(device=DEVICE)
        descriptor = loader.load_from_file(file_path)
        model = descriptor.model
        model.eval()
        _loaded_models[model_type] = model
        print(f"[AI] {cfg['name']} is ready!")

    return _loaded_models[model_type]

def detect_faces(image_bytes: bytes) -> dict:
    """
    Ultra-fast pre-scan (15-30ms) to detect human faces on image upload
    without running any heavy super-resolution models.
    """
    cascade_cls = getattr(cv2, 'CascadeClassifier', None)
    if cascade_cls is None and hasattr(cv2, 'objdetect'):
        cascade_cls = getattr(cv2.objdetect, 'CascadeClassifier', None)

    if cascade_cls is None:
        return {"face_count": 0, "has_faces": False}

    try:
        cascade_file = os.path.join(WEIGHTS_DIR, "haarcascade_frontalface_default.xml")
        if not os.path.exists(cascade_file):
            if hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades'):
                built_in = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
                if os.path.exists(built_in):
                    cascade_file = built_in

        if not os.path.exists(cascade_file):
            url = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml"
            urllib.request.urlretrieve(url, cascade_file)

        face_cascade = cascade_cls(cascade_file)

        # Quick thumbnail resize for sub-30ms detection
        pil_img = Image.open(BytesIO(image_bytes)).convert("RGB")
        w, h = pil_img.size
        if max(w, h) > 800:
            scale = 800 / max(w, h)
            pil_img = pil_img.resize((int(w * scale), int(h * scale)), Image.Resampling.BILINEAR)

        cv_img = np.array(pil_img)
        gray = cv2.cvtColor(cv_img, cv2.COLOR_RGB2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5, minSize=(30, 30))

        return {
            "face_count": len(faces),
            "has_faces": len(faces) > 0
        }
    except Exception as e:
        print(f"[AI Face] Pre-scan detection error: {e}")
        return {"face_count": 0, "has_faces": False}

def restore_faces(cv_image: np.ndarray) -> np.ndarray:
    face_start_time = time.time()
    cascade_cls = getattr(cv2, 'CascadeClassifier', None)
    
    if cascade_cls is None and hasattr(cv2, 'objdetect'):
        cascade_cls = getattr(cv2.objdetect, 'CascadeClassifier', None)

    if cascade_cls is None:
        print("[AI Face] OpenCV CascadeClassifier not available. Applying portrait clarity fallback.")
        return cv2.bilateralFilter(cv_image, d=7, sigmaColor=50, sigmaSpace=50)

    try:
        cascade_file = os.path.join(WEIGHTS_DIR, "haarcascade_frontalface_default.xml")
        if not os.path.exists(cascade_file):
            if hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades'):
                built_in = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
                if os.path.exists(built_in):
                    cascade_file = built_in

        if not os.path.exists(cascade_file):
            print("[AI Face] Downloading face cascade model (~900KB)...")
            url = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml"
            urllib.request.urlretrieve(url, cascade_file)

        face_cascade = cascade_cls(cascade_file)
        gray = cv2.cvtColor(cv_image, cv2.COLOR_RGB2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5, minSize=(60, 60))

        if len(faces) == 0:
            print("[AI Face] No human faces detected in image.")
            return cv_image

        print(f"[AI Face] Found {len(faces)} human face(s). Beginning portrait refinement...")
        result = cv_image.copy()

        for idx, (x, y, w, h) in enumerate(faces, start=1):
            t0 = time.time()
            pad_x = int(w * 0.15)
            pad_y = int(h * 0.20)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(cv_image.shape[1], x + w + pad_x)
            y2 = min(cv_image.shape[0], y + h + pad_y)

            face_roi = cv_image[y1:y2, x1:x2]
            if face_roi.size == 0:
                continue

            smooth_skin = cv2.bilateralFilter(face_roi, d=9, sigmaColor=75, sigmaSpace=75)
            gaussian = cv2.GaussianBlur(face_roi, (0, 0), sigmaX=1.5)
            sharp_face = cv2.addWeighted(face_roi, 1.4, gaussian, -0.4, 0)
            enhanced_face = cv2.addWeighted(sharp_face, 0.7, smooth_skin, 0.3, 0)

            mask = np.zeros((y2 - y1, x2 - x1), dtype=np.float32)
            center = ((x2 - x1) // 2, (y2 - y1) // 2)
            axes = ((x2 - x1) // 2 - 4, (y2 - y1) // 2 - 4)
            cv2.ellipse(mask, center, axes, 0, 0, 360, 1.0, -1)
            mask = cv2.GaussianBlur(mask, (31, 31), 11)
            mask_3ch = np.dstack([mask, mask, mask])

            orig_region = result[y1:y2, x1:x2].astype(np.float32)
            blended = (enhanced_face.astype(np.float32) * mask_3ch) + (orig_region * (1.0 - mask_3ch))
            result[y1:y2, x1:x2] = np.clip(blended, 0, 255).astype(np.uint8)

            face_time = (time.time() - t0) * 1000
            print(f"   └─ Face #{idx}: Position=({x}, {y}) | Size={w}x{h}px | Refined in {face_time:.1f}ms")

        total_face_time = (time.time() - face_start_time) * 1000
        print(f"[AI Face] Successfully refined all faces in {total_face_time:.1f}ms!")
        return result

    except Exception as e:
        print(f"[AI Face] Face restoration skipped due to unexpected issue: {e}")
        return cv_image

def upscale_tensor_tiled(img_tensor: torch.Tensor, model, tile_size: int = 256, tile_pad: int = 16, progress_callback=None) -> torch.Tensor:
    _, _, h, w = img_tensor.shape
    scale = 4

    y_steps = list(range(0, h, tile_size))
    x_steps = list(range(0, w, tile_size))
    total_tiles = len(y_steps) * len(x_steps)

    if total_tiles == 1:
        if progress_callback:
            progress_callback(1, 1, 0, "Computing single tile...")
        with torch.no_grad():
            return model(img_tensor)

    out_h, out_w = h * scale, w * scale
    output = torch.zeros((1, 3, out_h, out_w), dtype=img_tensor.dtype, device=DEVICE)

    tile_count = 0
    start_time = time.time()

    for y in y_steps:
        for x in x_steps:
            tile_count += 1
            print(f"[AI] Processing tile {tile_count}/{total_tiles}...")

            y1 = max(y - tile_pad, 0)
            x1 = max(x - tile_pad, 0)
            y2 = min(y + tile_size + tile_pad, h)
            x2 = min(x + tile_size + tile_pad, w)

            tile_in = img_tensor[:, :, y1:y2, x1:x2]
            with torch.no_grad():
                tile_out = model(tile_in)

            in_pad_top = (y - y1) * scale
            in_pad_left = (x - x1) * scale
            out_tile_h = min(tile_size, h - y) * scale
            out_tile_w = min(tile_size, w - x) * scale

            cropped = tile_out[:, :, in_pad_top:in_pad_top + out_tile_h, in_pad_left:in_pad_left + out_tile_w]
            output[:, :, y * scale:y * scale + out_tile_h, x * scale:x * scale + out_tile_w] = cropped

            # Real-time measurement of this exact user's CPU speed
            if progress_callback:
                elapsed = time.time() - start_time
                avg_tile_time = elapsed / tile_count
                remaining_tiles = total_tiles - tile_count
                dynamic_eta = round(remaining_tiles * avg_tile_time)
                stage = f"Tile {tile_count} of {total_tiles} completed on CPU..."
                progress_callback(tile_count, total_tiles, dynamic_eta, stage)

    return output

def enhance_image(
    image_bytes: bytes, 
    model_type: str = "general", 
    target_scale: int = 4, 
    quality_mode: str = "balanced",
    clarity_boost: bool = True,
    face_restore: bool = False,
    output_format: str = "PNG",
    progress_callback=None
):
    start_time = time.time()
    model = get_model(model_type)

    if progress_callback:
        progress_callback(0, 1, None, "Preparing image and tensors...")

    pil_img = Image.open(BytesIO(image_bytes))
    orig_w, orig_h = pil_img.size

    # Handle Transparency (RGBA)
    has_alpha = pil_img.mode in ("RGBA", "LA") or (pil_img.mode == "P" and "transparency" in pil_img.info)
    alpha_channel = None
    if has_alpha:
        pil_img = pil_img.convert("RGBA")
        alpha_channel = pil_img.split()[3]
        rgb_img = Image.merge("RGB", pil_img.split()[:3])
    else:
        rgb_img = pil_img.convert("RGB")

    # Quality Mode Handling
    if quality_mode == "balanced":
        MAX_DIM = 960
        if max(orig_w, orig_h) > MAX_DIM:
            ratio = MAX_DIM / max(orig_w, orig_h)
            new_w, new_h = int(orig_w * ratio), int(orig_h * ratio)
            print(f"[AI] Balanced mode: Auto-scaled input to {new_w}x{new_h} to avoid CPU lag.")
            rgb_img = rgb_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            if alpha_channel:
                alpha_channel = alpha_channel.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Tensor conversion
    np_img = np.array(rgb_img, dtype=np.float32) / 255.0
    tensor_img = torch.from_numpy(np_img).permute(2, 0, 1).unsqueeze(0).to(DEVICE)

    # Inference with live progress callback
    with torch.no_grad():
        out_tensor = upscale_tensor_tiled(tensor_img, model, tile_size=256, tile_pad=16, progress_callback=progress_callback)

    # Post-process back to numpy array
    out_tensor = out_tensor.squeeze(0).permute(1, 2, 0).clamp(0, 1).cpu()
    out_np = (out_tensor.numpy() * 255.0).round().astype(np.uint8)

    # Apply Face Restoration if enabled
    if face_restore:
        if progress_callback:
            progress_callback(1, 1, 2, "Scanning & refining facial landmarks...")
        out_np = restore_faces(out_np)

    if progress_callback:
        progress_callback(1, 1, 1, "Finalizing texture blending & compression...")

    enhanced_pil = Image.fromarray(out_np)

    if has_alpha and alpha_channel is not None:
        upscaled_alpha = alpha_channel.resize(enhanced_pil.size, Image.Resampling.LANCZOS)
        enhanced_pil = Image.merge("RGBA", (*enhanced_pil.split(), upscaled_alpha))

    if target_scale == 2:
        w, h = enhanced_pil.size
        enhanced_pil = enhanced_pil.resize((w // 2, h // 2), Image.Resampling.LANCZOS)

    if clarity_boost:
        if enhanced_pil.mode == "RGBA":
            r, g, b, a = enhanced_pil.split()
            rgb_part = Image.merge("RGB", (r, g, b)).filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=3))
            enhanced_pil = Image.merge("RGBA", (*rgb_part.split(), a))
        else:
            enhanced_pil = enhanced_pil.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=3))

    out_w, out_h = enhanced_pil.size
    exec_time = time.time() - start_time

    output_format = output_format.upper()
    output_buffer = BytesIO()

    if output_format in ("JPG", "JPEG"):
        if enhanced_pil.mode == "RGBA":
            bg = Image.new("RGB", enhanced_pil.size, (255, 255, 255))
            bg.paste(enhanced_pil, mask=enhanced_pil.split()[3])
            enhanced_pil = bg
        enhanced_pil.save(output_buffer, format="JPEG", quality=95)
        mime_type = "image/jpeg"
    elif output_format == "WEBP":
        enhanced_pil.save(output_buffer, format="WEBP", quality=95)
        mime_type = "image/webp"
    else:
        enhanced_pil.save(output_buffer, format="PNG")
        mime_type = "image/png"

    metadata = {
        "exec_time": f"{exec_time:.2f}",
        "orig_w": orig_w,
        "orig_h": orig_h,
        "out_w": out_w,
        "out_h": out_h,
        "orig_mp": f"{(orig_w * orig_h) / 1_000_000:.2f}",
        "out_mp": f"{(out_w * out_h) / 1_000_000:.2f}",
        "model_name": MODELS_CONFIG[model_type]["name"] + (" + Face Restoration" if face_restore else "")
    }

    return output_buffer.getvalue(), mime_type, metadata