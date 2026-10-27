# CPU-only image for a €5–7/month VPS (Hetzner CX/CPX, Contabo, OVH). ~2.5 GB with torch-cpu.
FROM python:3.11-slim
ENV PIP_NO_CACHE_DIR=1 HF_HOME=/models TRANSFORMERS_OFFLINE=0 OMP_NUM_THREADS=2
WORKDIR /app
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt
COPY app.py .
# Pre-download weights at build time so the first request is not slow.
RUN python -c "from transformers import pipeline; pipeline('image-segmentation', model='shi-labs/oneformer_ade20k_swin_tiny'); pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf')"
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
