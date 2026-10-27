"""
COOLPLAN floor visualizer: optional server-side vision API (design §4.2–4.3, phase 3).

The browser does everything by itself; this service exists for
  * devices too slow for in-browser inference (old phones without WebGPU),
  * higher-quality mattes (OneFormer / Mask2Former, MIT) than the browser model,
  * batch jobs (precomputing sample-room mattes, QA image sets).

Endpoints
  GET  /health
  POST /segment  (multipart "image")  -> { "mask": "<base64 PNG, 8-bit alpha>", "coverage": float, "width": int, "height": int, "model": str }
  POST /depth    (multipart "image")  -> { "depth": "<base64 PNG, 16-bit relative inverse depth>", "width": int, "height": int, "model": str }

Privacy: images are processed in memory and never written to disk or logged.
Runs on a 2–4 vCPU VPS (≈ 0.5–3 s per request at 512 px). GPU not required.

Run locally:
  pip install -r requirements.txt
  uvicorn app:app --host 0.0.0.0 --port 8000
Config (env): SEG_MODEL (default shi-labs/oneformer_ade20k_swin_tiny), DEPTH_MODEL
(default depth-anything/Depth-Anything-V2-Small-hf), ALLOWED_ORIGINS (comma list), MAX_EDGE (default 1024).

NOTE: written without a Python runtime available in the authoring environment; untested. Expect small
fixes on first run (model output key names differ slightly between transformers versions).
"""
from __future__ import annotations

import base64
import io
import os
from typing import Any

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps

SEG_MODEL = os.environ.get("SEG_MODEL", "shi-labs/oneformer_ade20k_swin_tiny")
DEPTH_MODEL = os.environ.get("DEPTH_MODEL", "depth-anything/Depth-Anything-V2-Small-hf")
MAX_EDGE = int(os.environ.get("MAX_EDGE", "1024"))
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
FLOOR_LABELS = {"floor", "floor, flooring", "rug", "rug, carpet, carpeting"}

app = FastAPI(title="COOLPLAN floor API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["POST", "GET"], allow_headers=["*"])

_pipelines: dict[str, Any] = {}


def pipeline(task: str, model: str) -> Any:
    """Lazy, cached transformers pipelines (CPU)."""
    key = f"{task}:{model}"
    if key not in _pipelines:
        from transformers import pipeline as hf_pipeline  # imported lazily so /health is instant

        _pipelines[key] = hf_pipeline(task, model=model, device=-1)
    return _pipelines[key]


async def read_image(upload: UploadFile) -> Image.Image:
    if upload.content_type not in {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}:
        raise HTTPException(415, "image must be JPEG, PNG, WebP or HEIC")
    data = await upload.read()
    if not data or len(data) > 20 * 1024 * 1024:
        raise HTTPException(413, "image must be 1 byte to 20 MB")
    try:
        image = Image.open(io.BytesIO(data))
        image = ImageOps.exif_transpose(image).convert("RGB")
    except Exception as error:  # noqa: BLE001
        raise HTTPException(400, f"cannot decode image: {error}") from error
    scale = min(1.0, MAX_EDGE / max(image.size))
    if scale < 1.0:
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    return image


def png_base64(array: np.ndarray, mode: str) -> str:
    buffer = io.BytesIO()
    Image.fromarray(array, mode=mode).save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "segModel": SEG_MODEL, "depthModel": DEPTH_MODEL}


@app.post("/segment")
async def segment(image: UploadFile = File(...)) -> dict[str, Any]:
    picture = await read_image(image)
    segmenter = pipeline("image-segmentation", SEG_MODEL)
    results = segmenter(picture)  # list of {label, score, mask(PIL L)}
    alpha = np.zeros((picture.height, picture.width), dtype=np.float32)
    for item in results:
        label = str(item.get("label", "")).lower()
        if label in FLOOR_LABELS or label.split(",")[0] in {"floor", "rug"}:
            mask = np.asarray(item["mask"].resize(picture.size), dtype=np.float32) / 255.0
            alpha = np.maximum(alpha, mask)
    # Soft edges: a cheap bilateral-ish refinement is left to the client (guided filter); return the raw matte.
    return {
        "mask": png_base64((alpha * 255).astype(np.uint8), "L"),
        "coverage": float(alpha.mean()),
        "width": picture.width,
        "height": picture.height,
        "model": SEG_MODEL,
    }


@app.post("/depth")
async def depth(image: UploadFile = File(...)) -> dict[str, Any]:
    picture = await read_image(image)
    estimator = pipeline("depth-estimation", DEPTH_MODEL)
    result = estimator(picture)
    tensor = result["predicted_depth"]
    array = tensor.squeeze().float().cpu().numpy() if hasattr(tensor, "cpu") else np.asarray(tensor, dtype=np.float32)
    low, high = float(array.min()), float(array.max())
    normalized = (array - low) / max(1e-6, high - low)
    depth16 = Image.fromarray((normalized * 65535).astype(np.uint16), mode="I;16").resize(picture.size, Image.BILINEAR)
    buffer = io.BytesIO()
    depth16.save(buffer, format="PNG")
    return {
        "depth": base64.b64encode(buffer.getvalue()).decode("ascii"),
        "width": picture.width,
        "height": picture.height,
        "range": [low, high],
        "model": DEPTH_MODEL,
    }
