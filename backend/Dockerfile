FROM python:3.11-slim

WORKDIR /app

# System deps for PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (much smaller than the default GPU build) so the
# free-tier build doesn't OOM downloading 800MB of CUDA wheels we don't use.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PORT=8000
ENV TRANSFORMERS_OFFLINE=0
EXPOSE 8000

# Embedding model is downloaded lazily on first request — keeps the image small
# and the build under the free-tier memory limit. First /upload call is ~10s
# slower as it warms.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
