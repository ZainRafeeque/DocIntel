"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ask, type AskResponse, type Citation } from "@/lib/api";
import { cn } from "@/lib/utils";

type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; citations: Citation[] };

export function ChatPanel({
  docId,
  onCitationClick,
}: {
  docId: string;
  onCitationClick: (page: number) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const submit = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const resp: AskResponse = await ask(docId, q);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: resp.answer, citations: resp.citations },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted py-8 text-sm">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Ask anything about this document.</p>
            <p className="mt-2 text-xs">
              Try: <em className="text-accent">&ldquo;What is this document about?&rdquo;</em>
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} m={m} onCitationClick={onCitationClick} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Retrieving + reasoning…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
      <div className="border-t border-border p-3 bg-surface">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Ask a question about the document…"
            className="flex-1 resize-none rounded-lg bg-bg border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent transition"
          />
          <button
            onClick={submit}
            disabled={busy || !input.trim()}
            className={cn(
              "px-4 rounded-lg flex items-center gap-1.5 text-sm font-medium transition",
              busy || !input.trim()
                ? "bg-border text-muted cursor-not-allowed"
                : "bg-accent text-black hover:bg-cyan-300"
            )}
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted mt-2">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  onCitationClick,
}: {
  m: ChatMessage;
  onCitationClick: (page: number) => void;
}) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-accent text-black px-3.5 py-2 text-sm font-medium">
          {m.content}
        </div>
      </div>
    );
  }

  // Assistant: render markdown, then turn [pN#cM] tags into clickable chips
  return (
    <div className="space-y-2">
      <div className="rounded-2xl rounded-tl-sm bg-surface border border-border px-3.5 py-2.5 text-sm leading-relaxed">
        <CitationAwareMarkdown text={m.content} onCitationClick={onCitationClick} />
      </div>
      {m.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {m.citations.map((c, i) => (
            <button
              key={i}
              onClick={() => onCitationClick(c.page_number)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition"
              title={c.snippet}
            >
              p.{c.page_number}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CitationAwareMarkdown({
  text,
  onCitationClick,
}: {
  text: string;
  onCitationClick: (page: number) => void;
}) {
  // Split out inline [pN#cM] tags, render rest as markdown.
  const parts: (string | { page: number; key: string })[] = [];
  const re = /\[p(\d+)#c\d+\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ page: parseInt(m[1], 10), key: `c-${i++}-${m.index}` });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <>
      {parts.map((p, idx) =>
        typeof p === "string" ? (
          <span key={idx}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <span>{children}</span>,
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                    {children}
                  </a>
                ),
              }}
            >
              {p}
            </ReactMarkdown>
          </span>
        ) : (
          <button
            key={p.key}
            onClick={() => onCitationClick(p.page)}
            className="inline-flex items-center text-[10px] mx-0.5 px-1.5 py-0.5 rounded bg-accent/15 border border-accent/40 text-accent hover:bg-accent/30 transition cite-chip-active"
            title="Jump to source page"
          >
            p.{p.page}
          </button>
        )
      )}
    </>
  );
}
