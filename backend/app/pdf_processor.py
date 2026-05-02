"""PDF text extraction with page-level provenance."""

from __future__ import annotations

import fitz  # PyMuPDF
from typing import Iterator


def extract_pages(pdf_bytes: bytes) -> list[dict]:
    """Open a PDF and return one record per page.

    Returns:
        list of {"page_number": int (1-indexed), "text": str, "char_count": int}
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    out: list[dict] = []
    try:
        for i, page in enumerate(doc):
            text = page.get_text("text") or ""
            text = text.strip()
            out.append({
                "page_number": i + 1,
                "text": text,
                "char_count": len(text),
            })
    finally:
        doc.close()
    return out


def chunk_text(text: str, chunk_size: int, overlap: int) -> Iterator[tuple[int, int, str]]:
    """Sliding-window chunker on character boundaries with sentence-aware breaks.

    Yields (start_char, end_char, chunk_text). Tries to break on the nearest period
    or newline within the last 100 chars to avoid splitting mid-sentence.
    """
    if not text:
        return
    n = len(text)
    start = 0
    while start < n:
        end = min(start + chunk_size, n)
        # If we're not at the document end, try to break on a sentence boundary
        if end < n:
            window = text[max(end - 100, start): end]
            best = -1
            for sep in (". ", "?\n", "!\n", "\n\n", ". \n", "\n"):
                pos = window.rfind(sep)
                if pos > best:
                    best = pos + len(sep)
            if best > 0:
                end = max(end - 100, start) + best
        chunk = text[start:end].strip()
        if chunk:
            yield (start, end, chunk)
        if end >= n:
            break
        start = max(end - overlap, start + 1)


def chunk_pages(pages: list[dict], chunk_size: int, overlap: int) -> list[dict]:
    """Convert a list of pages into a list of chunks with page-level provenance.

    Each chunk: {"id": str, "text": str, "page_number": int, "char_start": int, "char_end": int}
    """
    chunks: list[dict] = []
    for page in pages:
        for s, e, ch in chunk_text(page["text"], chunk_size, overlap):
            cid = f"p{page['page_number']:04d}_c{s:06d}"
            chunks.append({
                "id": cid,
                "text": ch,
                "page_number": page["page_number"],
                "char_start": s,
                "char_end": e,
            })
    return chunks
