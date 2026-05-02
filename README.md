# DocIntel — Multi-Modal Document Intelligence Platform

> Drop a PDF and **chat with it**. Get answers grounded in the source — every sentence is cited back to the page it came from. Or ask for **structured extraction** ("extract all dates and amounts as a table") and download the result as CSV.

A full-stack RAG application demonstrating production-grade techniques: **hybrid retrieval (dense + BM25 fused with reciprocal rank fusion)**, **page-level citation tracking**, and **structured JSON extraction** — wrapped in a polished Next.js 14 + Tailwind UI.

## :sparkles: Live demo

> _(Vercel + Render URLs go here once deployed)_

## :clapper: What it does

| Feature | How it works |
|---|---|
| **PDF ingest** | PyMuPDF extracts text per page; sliding-window chunker breaks it into ~600-char passages on sentence boundaries with 100-char overlap. |
| **Hybrid index** | `sentence-transformers/all-MiniLM-L6-v2` produces 384-dim normalized embeddings; `rank-bm25` builds a parallel lexical index. Both run in-memory per document. |
| **Hybrid retrieval** | Top-10 from dense + top-10 from BM25, fused with **reciprocal rank fusion** (k=60), final top-5 returned. |
| **Cited Q&A** | Groq Llama-3.1-70B receives the passages tagged `[p{page}#c{chunk}]` and is instructed to cite every claim. The frontend regex-extracts citations and turns them into clickable chips that scroll the embedded PDF viewer. |
| **Structured extraction** | A second prompt + `response_format=json_object` returns a list of typed records, rendered as a sortable table with one-click CSV download. |

## :triangular_ruler: Architecture

```
                  ┌──────────────────────┐
   user PDF  ───► │  Next.js 14 frontend │
                  │  · drag-drop upload  │
                  │  · react-pdf viewer  │
                  │  · chat + extract UI │
                  └──────────┬───────────┘
                             │ HTTPS / JSON
                             ▼
                  ┌──────────────────────┐
                  │  FastAPI backend     │
                  │  ┌────────────────┐  │
                  │  │ PyMuPDF        │  │  text + page numbers
                  │  │ chunker        │  │  sentence-aware sliding window
                  │  │ MiniLM-L6-v2   │  │  384-d dense embeddings
                  │  │ BM25Okapi      │  │  lexical index
                  │  │ RRF fusion     │  │  top-K hybrid retrieval
                  │  │ Groq LLM       │  │  cited answers + JSON extract
                  │  └────────────────┘  │
                  └──────────────────────┘
```

## :rocket: Run locally

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows
# source venv/bin/activate       # macOS / Linux
pip install -r requirements.txt

# Copy env template and add your free Groq API key
copy .env.example .env           # Windows
# cp .env.example .env           # macOS / Linux
# Then edit .env and set GROQ_API_KEY=gsk_...

uvicorn app.main:app --reload --port 8000
```

Backend is now at <http://localhost:8000>. Try `/docs` for Swagger UI.

> **Get a Groq key:** <https://console.groq.com/keys> — free tier, blazing fast Llama 3.1 70B.

### 2. Frontend (Next.js)

In a separate terminal:

```bash
cd frontend
npm install
copy .env.local.example .env.local       # Windows
# cp .env.local.example .env.local       # macOS / Linux
npm run dev
```

Frontend is now at <http://localhost:3000>. Drop a PDF and start chatting.

## :package: Repo layout

```
DocIntel/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app: /upload /ask /extract /documents
│   │   ├── pdf_processor.py   # PyMuPDF text extraction + sentence-aware chunking
│   │   ├── index.py           # DocumentIndex: dense + BM25 + RRF retrieval
│   │   ├── llm.py             # Groq prompt templates: cited Q&A + JSON extract
│   │   └── config.py          # pydantic-settings for env vars
│   ├── requirements.txt
│   ├── Dockerfile             # for Render deploy
│   ├── render.yaml            # Render blueprint (one-click deploy)
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Landing + main split-view layout
│   │   ├── layout.tsx
│   │   └── globals.css        # Tailwind + dark theme
│   ├── components/
│   │   ├── Uploader.tsx       # drag-drop PDF uploader
│   │   ├── PdfViewer.tsx      # react-pdf viewer with page nav + zoom
│   │   ├── ChatPanel.tsx      # chat with citation-aware markdown rendering
│   │   └── ExtractPanel.tsx   # structured extraction with table + CSV download
│   ├── lib/
│   │   ├── api.ts             # backend client
│   │   └── utils.ts
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── next.config.js
│   └── .env.local.example
├── .gitignore
├── LICENSE
└── README.md
```

## :wrench: Tech stack

**Backend** — Python 3.10+, FastAPI, PyMuPDF, sentence-transformers, rank-bm25, NumPy, Groq SDK, Pydantic v2

**Frontend** — Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, react-pdf, react-markdown, lucide-react

**Deployment** — Render (backend, Docker free tier) + Vercel (frontend, free tier)

## :cloud: Deploy

### Backend → Render

1. Push this repo to GitHub
2. Sign in at <https://render.com>
3. **New** → **Blueprint** → point at this repo, Render auto-detects `backend/render.yaml`
4. Set the env var **`GROQ_API_KEY`** in the Render dashboard
5. Wait ~3 min for the Docker build (downloads the embedding model into the image)
6. You'll get a URL like `https://docintel-backend.onrender.com`

> :warning: Render free tier sleeps after 15 min idle. First request after sleep takes ~30 s to wake. Embedding model is baked into the Docker image so the wake doesn't re-download it.

### Frontend → Vercel

1. Sign in at <https://vercel.com>
2. **Add New** → **Project** → import this repo
3. **Root directory:** `frontend`
4. **Environment variable:** `NEXT_PUBLIC_API_BASE = https://docintel-backend.onrender.com`
5. Deploy

## :bulb: Why these choices?

- **Hybrid retrieval over pure dense.** Pure semantic search misses exact-match terms (model numbers, names, IDs). Pure BM25 misses paraphrase. RRF fuses both with no parameter tuning.
- **In-memory index per document, no DB.** Keeps the free-tier deploy lean. Each PDF is a self-contained `DocumentIndex`. Trade-off: documents are lost on backend restart — acceptable for a demo.
- **Citations as a contract.** Tagging passages `[p{N}#c{M}]` and asking the model to echo them lets the frontend reliably extract page references with a regex. No tool-calling overhead.
- **Groq + Llama 3.1 70B.** Free, ~700 tokens/sec inference, smart enough for both Q&A and JSON extraction. Removes any cold-start API cost concern.

## :clipboard: Roadmap

- [ ] OCR fallback for scanned PDFs via Gemini Vision (env var already wired)
- [ ] Persistent vector store (Qdrant Cloud free tier) for multi-session documents
- [ ] Cross-encoder reranking before final top-K
- [ ] Streaming chat responses
- [ ] Multi-document chat (cite which doc + page)
- [ ] Auth + user-scoped documents

## :busts_in_silhouette: Author

**Mohammed Zain Rafeeque** — AI Engineer
- GitHub: [@ZainRafeeque](https://github.com/ZainRafeeque)
- LinkedIn: [zain-rafeeque](https://linkedin.com/in/zain-rafeeque/)
- Portfolio: <https://portfoliozain-cwg6.vercel.app/>

## :scroll: License

MIT — see [LICENSE](LICENSE).
