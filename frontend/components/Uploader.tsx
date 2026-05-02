"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { uploadPdf, type UploadResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Uploader({
  onUploaded,
}: {
  onUploaded: (file: File, resp: UploadResponse) => void;
}) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      setProgress("Reading PDF…");
      try {
        setProgress("Uploading and indexing…");
        const resp = await uploadPdf(file);
        setProgress("Done.");
        onUploaded(file, resp);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [onUploaded]
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={cn(
          "block cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all",
          drag
            ? "border-accent bg-accent/5"
            : "border-border bg-surface hover:border-accent/50",
          busy && "pointer-events-none opacity-60"
        )}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <div className="flex flex-col items-center gap-3">
          {busy ? (
            <>
              <Loader2 className="w-12 h-12 text-accent animate-spin" />
              <p className="text-lg font-medium">{progress}</p>
              <p className="text-sm text-muted">
                Embedding ~600-char chunks · building hybrid index
              </p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-accent" />
              </div>
              <div>
                <p className="text-lg font-medium">
                  Drop a PDF here, or click to choose one
                </p>
                <p className="text-sm text-muted mt-1">
                  Up to 25 MB · text-based PDFs supported
                </p>
              </div>
            </>
          )}
        </div>
      </label>
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <strong className="font-semibold">Error:</strong> {error}
        </div>
      )}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
        <FileText className="w-4 h-4" />
        <span>Your file is held in memory only while you use the app — not stored on disk.</span>
      </div>
    </div>
  );
}
