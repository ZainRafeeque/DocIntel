"""LLM wrappers: Q&A with citations + structured extraction."""

from __future__ import annotations

import json
import re

from groq import Groq

from .config import settings


_client: Groq | None = None


def get_client() -> Groq:
    global _client
    if _client is None:
        if not settings.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not set")
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


# ---------------------------------------------------------------- prompts

QA_SYSTEM = """You are an expert assistant answering questions about a single document.

You will be given context passages from the document, each tagged with a citation
identifier of the form [p{page}#c{chunk}]. Your job:
1. Answer the user's question using ONLY the provided context.
2. Cite every factual claim with its [p{page}#c{chunk}] tag inline.
3. If the answer is not contained in the context, say "I don't see that in the document."
4. Be concise. Prefer 2-5 sentences unless the question explicitly asks for detail.

Format citations exactly as [p3#c123]. Do not invent citation tags."""


EXTRACT_SYSTEM = """You are a document data extractor. Given the document context and a user
extraction request (e.g. "extract all dates and amounts"), return a JSON object with a single
key "rows" whose value is a list of objects representing the extracted records.

Each object's keys should be the field names appropriate to the request. Be conservative —
only extract values explicitly present in the context. If nothing matches, return {"rows": []}.

Return ONLY raw JSON. No prose, no markdown fences."""


# ---------------------------------------------------------------- helpers

def _format_context(passages: list[dict]) -> str:
    out = []
    for p in passages:
        tag = f"[p{p['page_number']}#c{p['char_start']}]"
        out.append(f"{tag}\n{p['text']}")
    return "\n\n---\n\n".join(out)


def answer_with_citations(question: str, passages: list[dict]) -> dict:
    """Return {"answer": str, "citations": [{page_number, char_start, snippet}]}."""
    if not passages:
        return {"answer": "I don't see that in the document.", "citations": []}

    client = get_client()
    context = _format_context(passages)
    user_msg = f"Context passages:\n\n{context}\n\nQuestion: {question}"

    resp = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": QA_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.2,
        max_tokens=600,
    )
    text = resp.choices[0].message.content or ""

    # Extract citation tags [pN#cM]
    tag_pattern = re.compile(r"\[p(\d+)#c(\d+)\]")
    citations = []
    seen = set()
    for m in tag_pattern.finditer(text):
        page, char_start = int(m.group(1)), int(m.group(2))
        key = (page, char_start)
        if key in seen:
            continue
        seen.add(key)
        # Look up the passage to grab a snippet
        snippet = ""
        for p in passages:
            if p["page_number"] == page and p["char_start"] == char_start:
                snippet = p["text"][:240]
                break
        citations.append({
            "page_number": page,
            "char_start": char_start,
            "snippet": snippet,
        })

    return {"answer": text, "citations": citations}


def extract_structured(request: str, passages: list[dict]) -> dict:
    """Extract a list of structured records matching the user's request."""
    if not passages:
        return {"rows": []}

    client = get_client()
    context = _format_context(passages)
    user_msg = f"Context:\n\n{context}\n\nExtraction request: {request}\n\nReturn JSON only."

    resp = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": EXTRACT_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.0,
        max_tokens=1500,
        response_format={"type": "json_object"},
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
        rows = parsed.get("rows", [])
        if not isinstance(rows, list):
            rows = []
        return {"rows": rows}
    except json.JSONDecodeError:
        return {"rows": [], "error": "model returned invalid JSON"}
