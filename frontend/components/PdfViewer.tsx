"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

// react-pdf must be client-only
const Document = dynamic(() => import("react-pdf").then((m) => m.Document), { ssr: false });
const Page = dynamic(() => import("react-pdf").then((m) => m.Page), { ssr: false });

// Configure pdf.js worker once on the client
if (typeof window !== "undefined") {
  // Dynamic import to set workerSrc on the singleton
  import("react-pdf").then((m) => {
    // Use the official cdn worker matching the bundled version
    m.pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${m.pdfjs.version}/pdf.worker.min.mjs`;
  });
}

export function PdfViewer({
  file,
  highlightPage,
  onLoaded,
}: {
  file: File | null;
  highlightPage?: number | null;
  onLoaded?: (numPages: number) => void;
}) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightPage && highlightPage !== pageNumber) {
      setPageNumber(highlightPage);
    }
  }, [highlightPage]);

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        No PDF loaded
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="p-1.5 rounded hover:bg-border disabled:opacity-30 transition"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm tabular-nums text-muted px-2">
            Page <span className="text-white">{pageNumber}</span> / {numPages || "—"}
          </span>
          <button
            onClick={() => setPageNumber((p) => Math.min(numPages || p, p + 1))}
            disabled={pageNumber >= numPages}
            className="p-1.5 rounded hover:bg-border disabled:opacity-30 transition"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
            className="p-1.5 rounded hover:bg-border transition"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted tabular-nums w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
            className="p-1.5 rounded hover:bg-border transition"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto bg-black/40 p-4">
        <Document
          file={file}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n);
            onLoaded?.(n);
          }}
          loading={<div className="text-center text-muted py-12">Loading PDF…</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>
    </div>
  );
}
