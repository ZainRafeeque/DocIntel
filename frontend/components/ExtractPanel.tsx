"use client";

import { useState } from "react";
import { Sparkles, Loader2, Download } from "lucide-react";
import { extract, type ExtractResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

const PRESETS = [
  "Extract all dates, parties, and amounts as a table",
  "Extract every key-value pair (e.g. invoice number, total, due date)",
  "Extract every named person with their role",
  "Extract every action item and the responsible party",
];

export function ExtractPanel({ docId }: { docId: string }) {
  const [request, setRequest] = useState(PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!request.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await extract(docId, request);
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = () => {
    if (!result?.rows?.length) return;
    const headers = Array.from(
      result.rows.reduce<Set<string>>((set, row) => {
        Object.keys(row).forEach((k) => set.add(k));
        return set;
      }, new Set())
    );
    const csv = [
      headers.join(","),
      ...result.rows.map((row) =>
        headers
          .map((h) => {
            const v = row[h];
            if (v == null) return "";
            const s = String(v).replace(/"/g, '""');
            return /[,\"\n]/.test(s) ? `"${s}"` : s;
          })
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "extracted.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted mb-2">Quick presets</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setRequest(p)}
              className="text-xs px-2.5 py-1 rounded-full bg-surface border border-border hover:border-accent/50 transition"
            >
              {p.split(",")[0].replace("Extract ", "")}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg bg-bg border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent transition"
        placeholder="Describe what you want to extract…"
      />
      <button
        onClick={run}
        disabled={busy || !request.trim()}
        className={cn(
          "w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition",
          busy || !request.trim()
            ? "bg-border text-muted cursor-not-allowed"
            : "bg-accent text-black hover:bg-cyan-300"
        )}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {busy ? "Extracting…" : "Extract"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && !error && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              {result.rows.length} {result.rows.length === 1 ? "row" : "rows"} extracted
            </p>
            {result.rows.length > 0 && (
              <button
                onClick={downloadCsv}
                className="text-xs flex items-center gap-1 text-accent hover:text-cyan-300 transition"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
            )}
          </div>
          {result.rows.length > 0 ? (
            <ResultTable rows={result.rows} />
          ) : (
            <p className="text-sm text-muted italic">
              No matches found. Try rephrasing the request.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const headers = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="bg-surface">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 font-medium text-muted uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border hover:bg-surface/50 transition">
              {headers.map((h) => (
                <td key={h} className="px-3 py-2 align-top">
                  {String(r[h] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
