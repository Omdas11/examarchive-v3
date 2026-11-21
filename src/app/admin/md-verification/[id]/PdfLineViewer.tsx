"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  findWordMatch,
  type PageWord,
} from "@/lib/md-verification-match";

/**
 * PDF viewer with line highlight. The browser's built-in viewer (the
 * old <iframe>) cannot be drawn on, so this renders pages itself with
 * pdfjs-dist and draws highlight boxes over the canvas.
 *
 * How a highlight works: hovering a question card gives us a page
 * number and the question text. The page is rendered, then OCR'd in
 * the browser with tesseract.js (English only, first time per page
 * only — results are cached in memory). The matcher finds the
 * question's distinctive words on that page and we draw a box over
 * them. Bengali / noisy scans usually do not match; the viewer then
 * says so plainly and just shows the page.
 *
 * pdf.js and tesseract.js are loaded lazily inside effects (dynamic
 * import), never at module level, so the server render never touches
 * them. The pdf.js worker file lives in public/ (no CDN worker URL).
 */

export interface HighlightTarget {
  /** Question key, to re-run when the card changes. */
  key: string | null;
  /** PDF page, or null when the card has no page number. */
  page: number | null;
  /** Question text to find on the page. */
  text: string | null;
}

type OcrState =
  | "idle"
  | "reading"
  | "found"
  | "notfound"
  | "nopage"
  | "unavailable";

interface TesseractWorker {
  recognize(
    image: HTMLCanvasElement,
  ): Promise<{ data: { words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] } }>;
  terminate(): Promise<void>;
}

const RENDER_SCALE = 1.6;

export default function PdfLineViewer({
  pdfUrl,
  target,
  title,
}: {
  pdfUrl: string;
  target: HighlightTarget;
  title: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const ocrCacheRef = useRef(new Map<number, PageWord[]>());
  const workerRef = useRef<TesseractWorker | null>(null);
  const workerFailedRef = useRef(false);
  const seqRef = useRef(0);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<
    { x0: number; y0: number; x1: number; y1: number }[]
  >([]);
  const [ocrState, setOcrState] = useState<OcrState>("idle");
  const [ocrPage, setOcrPage] = useState(0);

  // Load the document once.
  useEffect(() => {
    let cancelled = false;
    const seq = ++seqRef.current;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const res = await fetch(pdfUrl, { credentials: "include" });
        if (!res.ok) throw new Error("PDF download failed");
        const data = await res.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled || seq !== seqRef.current) {
          await loadingTask.destroy();
          return;
        }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      } catch {
        if (!cancelled && seq === seqRef.current) {
          setLoadError("Could not load this PDF. Open it in a new tab instead.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      const doc = docRef.current;
      docRef.current = null;
      void doc?.cleanup();
      const loadingTask = loadingTaskRef.current;
      loadingTaskRef.current = null;
      if (loadingTask) void loadingTask.destroy();
      const worker = workerRef.current;
      workerRef.current = null;
      if (worker) void worker.terminate();
    };
  }, [pdfUrl]);

  const renderAndHighlight = useCallback(
    async (pageNum: number, text: string | null) => {
      const doc = docRef.current;
      const canvas = canvasRef.current;
      if (!doc || !canvas) return;
      const seq = ++seqRef.current;
      setBoxes([]);
      try {
        const pdfPage = await doc.getPage(pageNum);
        const viewport = pdfPage.getViewport({ scale: RENDER_SCALE });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        // pdfjs-dist v6 renders into the canvas element itself.
        await pdfPage.render({ canvas, viewport }).promise;
        if (seq !== seqRef.current) return;
        setPage(pageNum);
        if (text === null) {
          setOcrState("idle");
          return;
        }
        // OCR this page (cached) and match the question's words.
        let words = ocrCacheRef.current.get(pageNum);
        if (!words) {
          if (workerFailedRef.current) {
            setOcrState("unavailable");
            return;
          }
          setOcrState("reading");
          setOcrPage(pageNum);
          try {
            if (!workerRef.current) {
              const mod = await import("tesseract.js");
              workerRef.current = await mod.createWorker("eng");
            }
            const worker = workerRef.current;
            if (!worker) throw new Error("no worker");
            const { data } = await worker.recognize(canvas);
            words = (data.words ?? [])
              .filter((w) => w.text.trim().length > 0)
              .map((w) => ({
                text: w.text,
                x0: w.bbox.x0 / canvas.width,
                y0: w.bbox.y0 / canvas.height,
                x1: w.bbox.x1 / canvas.width,
                y1: w.bbox.y1 / canvas.height,
              }));
            ocrCacheRef.current.set(pageNum, words);
          } catch {
            workerFailedRef.current = true;
            if (seq === seqRef.current) setOcrState("unavailable");
            return;
          }
        }
        if (seq !== seqRef.current) return;
        const match = findWordMatch(text, words);
        if (match) {
          setBoxes([match.box]);
          setOcrState("found");
          setOcrPage(pageNum);
        } else {
          setOcrState("notfound");
          setOcrPage(pageNum);
        }
      } catch {
        if (seq === seqRef.current) setLoadError("Could not render this page.");
      }
    },
    [],
  );

  // Re-render when the document is ready.
  useEffect(() => {
    if (!loading && !loadError && numPages > 0) {
      void renderAndHighlight(1, null);
    }
  }, [loading, loadError, numPages, renderAndHighlight]);

  // A new highlight target: go to its page and find the line.
  useEffect(() => {
    if (loading || loadError || numPages === 0) return;
    if (target.key === null) {
      setBoxes([]);
      setOcrState("idle");
      return;
    }
    if (target.page === null) {
      setBoxes([]);
      setOcrState("nopage");
      return;
    }
    const pageNum = Math.min(Math.max(1, target.page), numPages);
    void renderAndHighlight(pageNum, target.text);
  }, [target, loading, loadError, numPages, renderAndHighlight]);

  const gotoPage = useCallback(
    (next: number) => {
      if (numPages === 0) return;
      const pageNum = Math.min(Math.max(1, next), numPages);
      setBoxes([]);
      setOcrState("idle");
      void renderAndHighlight(pageNum, null);
    },
    [numPages, renderAndHighlight],
  );

  return (
    <div>
      <div className="relative w-full overflow-auto border border-[var(--color-border)] bg-[var(--color-input-bg)]">
        {loading && (
          <p className="p-4 text-sm text-on-surface-variant">Loading PDF…</p>
        )}
        {loadError && (
          <p className="p-4 text-sm text-red-600">
            {loadError}{" "}
            <a
              className="underline"
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open the PDF in a new tab
            </a>
          </p>
        )}
        <canvas
          ref={canvasRef}
          aria-label={`PDF for ${title}`}
          className="block h-auto w-full"
        />
        {boxes.map((box, i) => (
          <div
            key={i}
            aria-hidden
            className="pointer-events-none absolute rounded-sm border-2 border-emerald-500 bg-emerald-400/30"
            style={{
              left: `${box.x0 * 100}%`,
              top: `${box.y0 * 100}%`,
              width: `${(box.x1 - box.x0) * 100}%`,
              height: `${(box.y1 - box.y0) * 100}%`,
            }}
          />
        ))}
      </div>
      {numPages > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => gotoPage(page - 1)}
            disabled={page <= 1}
            className="border border-[var(--color-border)] px-2 py-1 disabled:opacity-50"
          >
            Prev page
          </button>
          <span className="text-on-surface-variant">
            Page {page} of {numPages}
          </span>
          <button
            type="button"
            onClick={() => gotoPage(page + 1)}
            disabled={page >= numPages}
            className="border border-[var(--color-border)] px-2 py-1 disabled:opacity-50"
          >
            Next page
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-on-surface-variant" role="status">
        {ocrState === "reading" &&
          `Reading page ${ocrPage}… first time only, a few seconds.`}
        {ocrState === "found" && `Line found on page ${ocrPage}.`}
        {ocrState === "notfound" &&
          `Could not find this line on page ${ocrPage} — check the page number on the card.`}
        {ocrState === "nopage" &&
          "Set the page number on the card to highlight the line."}
        {ocrState === "unavailable" &&
          "Text search is not available on this device — the PDF still works, use the page buttons."}
        {ocrState === "idle" &&
          "Hover a question card to highlight its line in the PDF."}
      </p>
    </div>
  );
}
