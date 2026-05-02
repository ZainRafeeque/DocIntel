// API client for the DocIntel backend.

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export type UploadResponse = {
  doc_id: string;
  filename: string;
  page_count: number;
  chunk_count: number;
};

export type Citation = {
  page_number: number;
  char_start: number;
  snippet: string;
};

export type RetrievedChunk = {
  id: string;
  text: string;
  page_number: number;
  char_start: number;
  char_end: number;
  score: number;
  dense_score: number;
  bm25_score: number;
};

export type AskResponse = {
  answer: string;
  citations: Citation[];
  retrieved: RetrievedChunk[];
};

export type ExtractResponse = {
  rows: Record<string, unknown>[];
  error?: string | null;
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
  return handle<UploadResponse>(res);
}

export async function ask(
  doc_id: string,
  question: string,
  top_k?: number
): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_id, question, top_k }),
  });
  return handle<AskResponse>(res);
}

export async function extract(
  doc_id: string,
  request: string,
  top_k?: number
): Promise<ExtractResponse> {
  const res = await fetch(`${API_BASE}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_id, request, top_k }),
  });
  return handle<ExtractResponse>(res);
}

export async function health(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`);
  return handle(res);
}

export { API_BASE };
