"use client";

import { useState } from "react";
import { FileText, Github, MessageSquare, Sparkles, X } from "lucide-react";
import { Uploader } from "@/components/Uploader";
import { PdfViewer } from "@/components/PdfViewer";
import { ChatPanel } from "@/components/ChatPanel";
import { ExtractPanel } from "@/components/ExtractPanel";
import { type UploadResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<UploadResponse | null>(null);
  const [tab, setTab] = useState<"chat" | "extract">("chat");
  const [highlightPage, setHighlightPage] = useState<number | null>(null);

  if (!file || !meta) {
    return <Landing onUploaded={(f, m) => { setFile(f); setMeta(m); }} />;
  }

  return (
    <main className="h-screen flex flex-col bg-bg text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">DocIntel</p>
            <p className="text-[10px] text-muted leading-tight">Multi-Modal Document Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted hidden md:block">
            <span className="text-white">{meta.filename}</span>
            <span className="mx-2">·</span>
            {meta.page_count} pages · {meta.chunk_count} chunks
          </div>
          <button
            onClick={() => { setFile(null); setMeta(null); setHighlightPage(null); }}
            className="text-xs px-2.5 py-1 rounded-md border border-border hover:border-accent/50 transition flex items-center gap-1.5"
          >
            <X className="w-3 h-3" />
            Close
          </button>
          <a
            href="https://github.com/ZainRafeeque/DocIntel"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-white transition"
            aria-label="GitHub"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Main split view */}
      <div className="flex-1 flex min-h-0">
        {/* Left: PDF viewer */}
        <section className="flex-1 min-w-0 border-r border-border">
          <PdfViewer file={file} highlightPage={highlightPage} />
        </section>

        {/* Right: tabs (chat / extract) */}
        <aside className="w-[420px] flex flex-col bg-bg shrink-0">
          <div className="flex border-b border-border bg-surface">
            <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
              <MessageSquare className="w-3.5 h-3.5" /> Chat
            </TabButton>
            <TabButton active={tab === "extract"} onClick={() => setTab("extract")}>
              <Sparkles className="w-3.5 h-3.5" /> Extract
            </TabButton>
          </div>
          <div className="flex-1 min-h-0">
            {tab === "chat" ? (
              <ChatPanel docId={meta.doc_id} onCitationClick={(p) => setHighlightPage(p)} />
            ) : (
              <ExtractPanel docId={meta.doc_id} />
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition border-b-2",
        active
          ? "text-accent border-accent bg-accent/5"
          : "text-muted border-transparent hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function Landing({ onUploaded }: { onUploaded: (f: File, m: UploadResponse) => void }) {
  return (
    <main className="min-h-screen bg-bg text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="font-semibold leading-tight">DocIntel</p>
              <p className="text-[11px] text-muted leading-tight">Multi-Modal Document Intelligence</p>
            </div>
          </div>
          <a
            href="https://github.com/ZainRafeeque/DocIntel"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-white transition flex items-center gap-1.5 text-sm"
          >
            <Github className="w-4 h-4" /> Code
          </a>
        </header>

        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Chat with any document.
            <br />
            <span className="text-accent">Get cited answers instantly.</span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-muted">
            Drop a PDF and DocIntel chunks, embeds, and indexes it with hybrid retrieval
            (dense + BM25). Ask questions and get answers grounded in the source — every
            claim is linked back to the page it came from.
          </p>
        </section>

        <Uploader onUploaded={onUploaded} />

        <div className="mt-16 grid md:grid-cols-3 gap-4">
          <Feature
            title="Hybrid retrieval"
            text="Dense semantic search (sentence-transformers) fused with lexical BM25 via reciprocal rank fusion. Catches both meaning and exact-match terms."
          />
          <Feature
            title="Citations that work"
            text="Every answer is tagged with the source page. Click a citation to jump straight to the page in the embedded viewer."
          />
          <Feature
            title="Structured extraction"
            text="One click turns a freeform request like 'extract all dates and amounts' into a downloadable CSV table."
          />
        </div>

        <footer className="mt-16 pt-8 border-t border-border text-center text-xs text-muted">
          Built by{" "}
          <a href="https://portfoliozain-cwg6.vercel.app/" className="text-accent hover:underline">
            Mohammed Zain Rafeeque
          </a>
          {" · "}
          <a href="https://github.com/ZainRafeeque/DocIntel" className="hover:text-white">
            GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted mt-2 leading-relaxed">{text}</p>
    </div>
  );
}
