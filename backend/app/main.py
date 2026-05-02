"""FastAPI entry point for the Document Intelligence backend."""

from __future__ import annotations

import uuid

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import index as docindex
from .config import settings
from .llm import answer_with_citations, extract_structured
from .pdf_processor import chunk_pages, extract_pages

app = FastAPI(
    title="DocIntel — Multi-Modal Document Intelligence API",
    version="0.1.0",
    description="Upload a PDF, chat with it, and extract structured data. Hybrid retrieval (dense + BM25) over per-page chunks with citations.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


# ---------------------------------------------------------------- schemas

class UploadResponse(BaseModel):
    doc_id: str
    filename: str
    page_count: int
    chunk_count: int


class DocumentSummary(BaseModel):
    doc_id: str
    filename: str
    chunks: int
    pages: int


class AskRequest(BaseModel):
    doc_id: str
    question: str = Field(..., min_length=1, max_length=2000)
    top_k: int | None = None


class Citation(BaseModel):
    page_number: int
    char_start: int
    snippet: str


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    retrieved: list[dict]   # for transparency / debug UI


class ExtractRequest(BaseModel):
    doc_id: str
    request: str = Field(..., min_length=1, max_length=2000)
    top_k: int | None = None


class ExtractResponse(BaseModel):
    rows: list[dict]
    error: str | None = None


# ---------------------------------------------------------------- routes

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "embedding_model": settings.EMBEDDING_MODEL, "llm_model": settings.LLM_MODEL}


@app.get("/documents", response_model=list[DocumentSummary])
def list_documents() -> list[dict]:
    return docindex.list_docs()


@app.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)) -> UploadResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are accepted")
    raw = await file.read()
    size_mb = len(raw) / (1024 * 1024)
    if size_mb > settings.MAX_PDF_MB:
        raise HTTPException(status_code=413, detail=f"PDF exceeds max size {settings.MAX_PDF_MB} MB")

    pages = extract_pages(raw)
    if not any(p["text"].strip() for p in pages):
        raise HTTPException(
            status_code=422,
            detail="No extractable text in PDF (scanned image PDF). OCR fallback is not enabled in this build.",
        )

    chunks = chunk_pages(pages, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)
    if not chunks:
        raise HTTPException(status_code=422, detail="PDF parsed but no chunks were produced")

    doc_id = uuid.uuid4().hex[:12]
    idx = docindex.DocumentIndex(
        doc_id=doc_id,
        filename=file.filename,
        chunks=chunks,
        page_count=len(pages),
    )
    idx.build()
    docindex.store(idx)

    return UploadResponse(
        doc_id=doc_id,
        filename=file.filename,
        page_count=len(pages),
        chunk_count=len(chunks),
    )


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest) -> AskResponse:
    idx = docindex.get(req.doc_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="document not found (was it uploaded this session?)")
    passages = idx.query(req.question, top_k=req.top_k)
    result = answer_with_citations(req.question, passages)
    return AskResponse(
        answer=result["answer"],
        citations=[Citation(**c) for c in result["citations"]],
        retrieved=passages,
    )


@app.post("/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest) -> ExtractResponse:
    idx = docindex.get(req.doc_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="document not found (was it uploaded this session?)")
    # For extraction, retrieve more passages so we don't miss values
    passages = idx.query(req.request, top_k=req.top_k or 12)
    result = extract_structured(req.request, passages)
    return ExtractResponse(rows=result.get("rows", []), error=result.get("error"))


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str) -> dict:
    ok = docindex.delete(doc_id)
    if not ok:
        raise HTTPException(status_code=404, detail="document not found")
    return {"deleted": doc_id}


@app.get("/")
def root() -> dict:
    return {
        "service": "DocIntel",
        "docs": "/docs",
        "health": "/health",
    }
