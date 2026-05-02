"""In-memory document index with hybrid retrieval (dense + BM25)."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field

import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

from .config import settings


_model_lock = threading.Lock()
_embedder: SentenceTransformer | None = None


def get_embedder() -> SentenceTransformer:
    """Lazy-load and cache the embedding model."""
    global _embedder
    if _embedder is None:
        with _model_lock:
            if _embedder is None:
                _embedder = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _embedder


@dataclass
class DocumentIndex:
    doc_id: str
    filename: str
    chunks: list[dict]                                # see pdf_processor.chunk_pages
    embeddings: np.ndarray = field(default_factory=lambda: np.zeros((0, 0)))
    bm25: BM25Okapi | None = None
    page_count: int = 0

    def build(self) -> None:
        """Compute embeddings and BM25 index for the chunks."""
        if not self.chunks:
            self.embeddings = np.zeros((0, 384), dtype=np.float32)
            self.bm25 = None
            return
        embedder = get_embedder()
        texts = [c["text"] for c in self.chunks]
        emb = embedder.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        self.embeddings = np.asarray(emb, dtype=np.float32)
        # Tokenize for BM25 (simple lowercase whitespace split)
        tokenized = [t.lower().split() for t in texts]
        self.bm25 = BM25Okapi(tokenized)

    def query(self, question: str, top_k: int | None = None) -> list[dict]:
        """Hybrid retrieval: dense + BM25 fused with reciprocal rank fusion."""
        if not self.chunks:
            return []
        top_k = top_k or settings.TOP_K_FINAL

        embedder = get_embedder()
        q_emb = embedder.encode([question], normalize_embeddings=True)[0].astype(np.float32)

        # Dense scores: cosine similarity (vectors are already normalized)
        dense_scores = self.embeddings @ q_emb
        dense_top = np.argsort(-dense_scores)[: settings.TOP_K_DENSE]

        # BM25 scores
        bm25_scores = np.array(self.bm25.get_scores(question.lower().split())) if self.bm25 else np.zeros(len(self.chunks))
        bm25_top = np.argsort(-bm25_scores)[: settings.TOP_K_BM25]

        # Reciprocal rank fusion
        rrf_k = 60
        rrf: dict[int, float] = {}
        for rank, idx in enumerate(dense_top):
            rrf[idx] = rrf.get(idx, 0.0) + 1.0 / (rrf_k + rank + 1)
        for rank, idx in enumerate(bm25_top):
            rrf[idx] = rrf.get(idx, 0.0) + 1.0 / (rrf_k + rank + 1)

        ranked = sorted(rrf.items(), key=lambda kv: -kv[1])[:top_k]
        out = []
        for idx, score in ranked:
            c = self.chunks[idx]
            out.append({
                **c,
                "score": float(score),
                "dense_score": float(dense_scores[idx]),
                "bm25_score": float(bm25_scores[idx]),
            })
        return out


# Process-local store of indexes by doc_id (in-memory; lost on restart)
_INDEXES: dict[str, DocumentIndex] = {}
_index_lock = threading.Lock()


def store(idx: DocumentIndex) -> None:
    with _index_lock:
        _INDEXES[idx.doc_id] = idx


def get(doc_id: str) -> DocumentIndex | None:
    return _INDEXES.get(doc_id)


def list_docs() -> list[dict]:
    with _index_lock:
        return [
            {"doc_id": idx.doc_id, "filename": idx.filename,
             "chunks": len(idx.chunks), "pages": idx.page_count}
            for idx in _INDEXES.values()
        ]


def delete(doc_id: str) -> bool:
    with _index_lock:
        return _INDEXES.pop(doc_id, None) is not None
