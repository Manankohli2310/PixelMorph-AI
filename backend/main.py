import os
import uuid
import threading
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from upscaler import enhance_image
from upscaler import enhance_image, detect_faces

app = FastAPI(title="PixelMorph Professional AI Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Execution-Time",
        "X-Original-Dims",
        "X-Enhanced-Dims",
        "X-Original-MP",
        "X-Enhanced-MP",
        "X-Model-Name"
    ]
)

# In-memory dictionary for real-time tracking
active_jobs = {}

def run_job(job_id, content, model_type, scale, quality_mode, clarity_boost, face_restore, output_format):
    def update_progress(current_tile, total_tiles, eta_seconds, stage_text):
        if job_id in active_jobs:
            percent = int((current_tile / total_tiles) * 100) if total_tiles > 0 else 0
            active_jobs[job_id].update({
                "status": "processing",
                "current_tile": current_tile,
                "total_tiles": total_tiles,
                "percent": percent,
                "eta_seconds": eta_seconds,
                "stage": stage_text
            })

    try:
        enhanced_bytes, mime_type, meta = enhance_image(
            image_bytes=content,
            model_type=model_type,
            target_scale=scale,
            quality_mode=quality_mode,
            clarity_boost=clarity_boost,
            face_restore=face_restore,
            output_format=output_format,
            progress_callback=update_progress
        )

        active_jobs[job_id] = {
            "status": "completed",
            "bytes": enhanced_bytes,
            "mime_type": mime_type,
            "meta": meta,
            "percent": 100,
            "eta_seconds": 0,
            "stage": "Completed!"
        }
    except Exception as e:
        active_jobs[job_id] = {
            "status": "failed",
            "error": str(e)
        }
@app.post("/api/detect-faces")
async def detect_faces_endpoint(image: UploadFile = File(...)):
    """Fast pre-scan to check for human faces right after upload."""
    content = await image.read()
    result = detect_faces(content)
    return result

@app.post("/api/enhance/start")
async def start_enhancement(
    image: UploadFile = File(...),
    model_type: str = Form("general"),
    scale: int = Form(4),
    quality_mode: str = Form("balanced"),
    clarity_boost: bool = Form(True),
    face_restore: bool = Form(False),
    output_format: str = Form("PNG")
):
    job_id = str(uuid.uuid4())
    content = await image.read()

    active_jobs[job_id] = {
        "status": "started",
        "current_tile": 0,
        "total_tiles": 1,
        "percent": 0,
        "eta_seconds": None,
        "stage": "Initializing model on CPU..."
    }

    # Run in background thread so HTTP response returns immediately
    thread = threading.Thread(
        target=run_job,
        args=(job_id, content, model_type, scale, quality_mode, clarity_boost, face_restore, output_format),
        daemon=True
    )
    thread.start()

    return {"job_id": job_id}

@app.get("/api/enhance/progress/{job_id}")
async def get_progress(job_id: str):
    job = active_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] == "failed":
        return JSONResponse({"status": "failed", "error": job.get("error", "Unknown error")})

    return {
        "status": job["status"],
        "current_tile": job.get("current_tile", 0),
        "total_tiles": job.get("total_tiles", 1),
        "percent": job.get("percent", 0),
        "eta_seconds": job.get("eta_seconds"),
        "stage": job.get("stage", "Processing...")
    }

@app.get("/api/enhance/result/{job_id}")
async def get_result(job_id: str):
    job = active_jobs.pop(job_id, None)
    if not job or job.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Result not ready")

    meta = job["meta"]
    headers = {
        "X-Execution-Time": f"{meta['exec_time']}s",
        "X-Original-Dims": f"{meta['orig_w']}×{meta['orig_h']}px",
        "X-Enhanced-Dims": f"{meta['out_w']}×{meta['out_h']}px",
        "X-Original-MP": f"{meta['orig_mp']} MP",
        "X-Enhanced-MP": f"{meta['out_mp']} MP",
        "X-Model-Name": meta['model_name']
    }

    return Response(content=job["bytes"], media_type=job["mime_type"], headers=headers)

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
app.mount("/", StaticFiles(directory=ROOT_DIR, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)