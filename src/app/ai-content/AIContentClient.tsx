"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CoursePrefsPayload } from "@/lib/pdf-rag";
import { markdownToHtmlWithKatex } from "@/lib/client-markdown";
import {
  getNoteLengthOptions,
  normalizeNoteLength,
  type NoteLength,
} from "@/lib/note-length";
import type { Paper } from "@/types";
import "katex/dist/katex.min.css";

interface GeneratedDoc {
  topic: string;
  content: string;
  generatedAt: string;
  model?: string;
  modelLabel?: string;
  sources?: string[];
  pageLength?: number;
  noteLength?: NoteLength;
}

interface AIContentClientProps {
  userRole: string;
}

interface NoteLengthOption {
  value: NoteLength;
  label: string;
  description: string;
}

type JsPdfInstance = {
  internal: { getNumberOfPages: () => number; pageSize: { getWidth: () => number; getHeight: () => number } };
  setPage: (page: number) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  text: (text: string, x: number, y: number, options?: { align?: "left" | "center" | "right" }) => void;
  output: (type: "blob" | string) => Blob;
  save: (filename: string) => void;
};

type Html2PdfWorker = {
  set: (options: Record<string, unknown>) => Html2PdfWorker;
  toPdf: () => Promise<Html2PdfWorker>;
  get: (key: "pdf") => Promise<JsPdfInstance>;
};

function isHtml2PdfFactory(value: unknown): value is (source: HTMLElement) => Html2PdfWorker {
  return typeof value === "function";
}

export default function AIContentClient({ userRole: _userRole }: AIContentClientProps) {
  const [topic, setTopic] = useState("");
  const [noteLength, setNoteLength] = useState<NoteLength>("standard");
  const [noteLengthOptions, setNoteLengthOptions] = useState<NoteLengthOption[]>(getNoteLengthOptions());
  const [generating, setGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState("Preparing");
  const [documents, setDocuments] = useState<GeneratedDoc[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isFounder, setIsFounder] = useState(_userRole === "founder");
  const [isAdminPlus, setIsAdminPlus] = useState(_userRole === "founder" || _userRole === "admin");
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<GeneratedDoc | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [paperSearch, setPaperSearch] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState<string>("");
  const [paperLoading, setPaperLoading] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [adminModelOverride, setAdminModelOverride] = useState("");
  const [applyOverrideGlobally, setApplyOverrideGlobally] = useState(false);
  const loadingIntervalRef = useRef<number | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [loadingSteps, setLoadingSteps] = useState<string[]>([]);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const activeDocHtml = useMemo(
    () => (activeDoc ? markdownToHtmlWithKatex(activeDoc.content) : ""),
    [activeDoc],
  );

  const DAILY_LIMIT = 5;

  // Fetch remaining quota and defaults on load
  useEffect(() => {
    fetch("/api/ai/generate")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.remaining === "number" || d.remaining === null) {
          setRemaining(d.remaining);
        }
        setIsFounder(d.isFounder ?? false);
        setIsAdminPlus(d.isAdminPlus ?? false);
        if (Array.isArray(d.noteLengthOptions)) {
          const normalized = d.noteLengthOptions
            .map((opt: NoteLengthOption) => ({
              value: normalizeNoteLength(opt.value),
              label: opt.label || opt.value,
              description: opt.description || "",
            }))
            .filter((opt: NoteLengthOption) => Boolean(opt.value));
          if (normalized.length > 0) {
            setNoteLengthOptions(normalized);
            setNoteLength((current) => {
              const currentNormalized = normalizeNoteLength(current);
              const hasCurrent = normalized.some((opt: NoteLengthOption) => opt.value === currentNormalized);
              const standardOption = normalized.find((opt: NoteLengthOption) => opt.value === "standard");
              return hasCurrent ? currentNormalized : (standardOption?.value ?? normalized[0].value);
            });
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch archive papers for selection
  useEffect(() => {
    setPaperLoading(true);
    fetch("/api/papers")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPapers(data as Paper[]);
          const firstWithFile = (data as Paper[]).find((p) => p.file_id);
          if (firstWithFile?.id) {
            setSelectedPaperId(firstWithFile.id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setPaperLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (loadingIntervalRef.current) {
        window.clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  const selectedPaper = useMemo(
    () => papers.find((paper) => paper.id === selectedPaperId) ?? null,
    [papers, selectedPaperId],
  );

  const filteredPapers = useMemo(() => {
    const q = paperSearch.trim().toLowerCase();
    const base = !q
      ? papers
      : papers.filter((p) => {
          const haystack = `${p.title} ${p.course_code ?? ""} ${p.course_name} ${p.department}`.toLowerCase();
          return haystack.includes(q);
        });

    const limited = base.slice(0, 40);

    if (selectedPaper) {
      const isInLimited = limited.some((p) => p.id === selectedPaper.id);
      const isInBase = base.some((p) => p.id === selectedPaper.id);
      if (!isInLimited && isInBase) {
        const withSelected = [selectedPaper, ...limited.filter((p) => p.id !== selectedPaper.id)];
        return withSelected.slice(0, 40);
      }
    }

    return limited;
  }, [paperSearch, papers, selectedPaper]);

  async function generate() {
    const trimmed = topic.trim();
    if (!trimmed || generating) return;
    setGenerating(true);
    if (loadingIntervalRef.current) {
      window.clearInterval(loadingIntervalRef.current);
    }
    const steps = [
      "Preparing",
      "Retrieving archive context",
      ...(useWebSearch ? ["Checking latest web updates"] : []),
      "Generating notes",
      "Finalizing PDF-ready output",
    ];
    let stepIndex = 0;
    setLoadingSteps(steps);
    setLoadingStepIndex(0);
    setLoadingStep(steps[0]);
    loadingIntervalRef.current = window.setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, steps.length - 1);
      setLoadingStep(steps[stepIndex]);
      setLoadingStepIndex(stepIndex);
    }, 900);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        topic: trimmed,
        noteLength,
        useWebSearch,
        coursePrefs: loadCoursePrefsFromStorage(),
        referenceFileId: selectedPaper?.file_id,
        referenceLabel: selectedPaper?.title,
      };

      if (isAdminPlus && adminModelOverride.trim()) {
        payload.model = adminModelOverride.trim();
        payload.applyGlobally = applyOverrideGlobally;
      }

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
        return;
      }

      const doc: GeneratedDoc = {
        topic: data.topic,
        content: data.content,
        generatedAt: data.generatedAt,
        model: data.model,
        modelLabel: data.model,
        sources: Array.isArray(data.sources) ? data.sources : [],
        pageLength: typeof data.pageLength === "number" ? data.pageLength : undefined,
        noteLength: normalizeNoteLength(data.noteLength ?? noteLength),
      };

      setDocuments((prev) => [doc, ...prev]);
      setActiveDoc(doc);
      setTopic("");
      if (data.remaining !== undefined && data.remaining !== null) {
        setRemaining(data.remaining);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      if (loadingIntervalRef.current) {
        window.clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      setGenerating(false);
    }
  }

  /**
   * Reads course preference payload from localStorage key `ea_course_prefs`.
   * Fields map to programme buckets:
   * dsc=Discipline Specific Core, dsm1/dsm2=Discipline Specific Minor,
   * sec=Skill Enhancement Course, idc=Interdisciplinary Course,
   * aec=Ability Enhancement Course, vac=Value Added Course.
   */
  function loadCoursePrefsFromStorage(): CoursePrefsPayload | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("ea_course_prefs");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CoursePrefsPayload>;
      return {
        dsc: parsed.dsc ?? "",
        dsm1: parsed.dsm1 ?? "",
        dsm2: parsed.dsm2 ?? "",
        sec: parsed.sec ?? "",
        idc: parsed.idc ?? "",
        aec: parsed.aec ?? "",
        vac: parsed.vac ?? "",
      };
    } catch {
      return null;
    }
  }

  async function handlePrint(event?: React.MouseEvent, mode: "download" | "preview" = "download") {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!activeDoc) return;
    if (!exportRef.current) return;

    try {
      const html2pdfModule = await import("html2pdf.js");
      const candidate = (html2pdfModule as { default?: unknown }).default;
      if (!isHtml2PdfFactory(candidate)) {
        throw new Error("html2pdf.js module is unavailable or has an unexpected export shape.");
      }
      const html2pdf = candidate;

      await new Promise((resolve) => setTimeout(resolve, 500));

      const filename = `${activeDoc.topic.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const topicTitle = activeDoc.topic || "ExamArchive Notes";
      const worker: Html2PdfWorker = html2pdf(exportRef.current).set({
        margin: [15, 15, 15, 15],
        filename,
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"], avoid: [".equation-block", "table", "pre", "blockquote"] },
      });

      await worker.toPdf();
      const pdf = await worker.get("pdf");
      const totalPages = pdf.internal.getNumberOfPages();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      for (let i = 1; i <= totalPages; i += 1) {
        pdf.setPage(i);
        pdf.setFontSize(11);
        pdf.setTextColor(20, 39, 82);
        pdf.text(`ExamArchive — ${topicTitle}`, 20, 12);
        pdf.setFontSize(9);
        pdf.setTextColor(90, 96, 111);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: "right" });
      }

      if (mode === "preview") {
        const arrayBuffer = pdf.output("arraybuffer");
        const blob = new Blob([arrayBuffer], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        if (pdfPreviewUrl) {
          window.URL.revokeObjectURL(pdfPreviewUrl);
        }
        setPdfPreviewUrl(url);
        return;
      }

      pdf.save(filename);
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }
      setPdfPreviewUrl(null);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  }

  const canGenerate = isAdminPlus || remaining === null || remaining > 0;

  return (
    <div className="relative min-h-screen bg-surface px-4 py-8 text-on-surface">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/0 to-transparent" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-2xl bg-surface-container p-6 shadow-lift border border-outline-variant/30">
          <div className="flex items-center gap-2 text-on-surface">
            <span className="text-2xl">📘</span>
            <h1 className="text-3xl font-bold">AI Notes Generator</h1>
          </div>
          <p className="max-w-3xl text-base text-on-surface-variant">
            Transform your exam papers and textbooks into concise, high-yield study notes using archive context and live updates.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
              {isFounder
                ? "Founder • Unlimited generations"
                : remaining === null
                ? "Loading quota…"
                : `${remaining}/${DAILY_LIMIT} generations left today`}
            </span>
            {useWebSearch && (
              <span className="rounded-full bg-secondary/20 px-3 py-1 text-secondary">
                Web updates on
              </span>
            )}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.45fr_0.9fr]">
          <div className="space-y-5">
            {/* PDF selection */}
            <div className="card border border-outline-variant/30">
              <div className="flex flex-col gap-3 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Reference PDF
                </p>
                <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface shadow-md ring-1 ring-primary/20">
                      <span className="text-2xl text-primary">📄</span>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-on-surface">
                        {selectedPaper ? selectedPaper.title : "Drop your PDF here"}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {selectedPaper
                          ? `${selectedPaper.course_name} • ${selectedPaper.year ?? "Year N/A"}`
                          : "Use archive PDFs (max 50MB) from the website bucket"}
                      </p>
                    </div>
                    <div className="grid w-full gap-2 sm:grid-cols-[1fr,auto] sm:items-center">
                      <input
                        className="input-field w-full"
                        placeholder="Search archive by title, course, department..."
                        value={paperSearch}
                        onChange={(e) => setPaperSearch(e.target.value)}
                        disabled={paperLoading}
                      />
                      <select
                        className="input-field w-full sm:w-52"
                        value={selectedPaperId}
                        onChange={(e) => setSelectedPaperId(e.target.value)}
                        disabled={paperLoading}
                      >
                        {paperLoading && <option>Loading PDFs…</option>}
                        {!paperLoading && filteredPapers.length === 0 && <option>No matching PDFs</option>}
                        {filteredPapers.map((paper) => (
                          <option key={paper.id} value={paper.id} disabled={!paper.file_id}>
                            {paper.title} {paper.course_code ? `• ${paper.course_code}` : ""} {paper.year ? `(${paper.year})` : ""}
                            {!paper.file_id ? " (unavailable)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!selectedPaper?.file_id && (
                      <p className="text-xs text-tertiary">
                        Pick a PDF with a stored file ID to prioritize it in context.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Generator */}
            <div className="card border border-outline-variant/30">
              <div className="flex flex-col gap-4 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Prompt
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface">
                    What should we generate notes for?
                  </label>
                  <input
                    id="ai-topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && canGenerate && generate()}
                    placeholder="e.g. Derive lens-maker formula with ray diagram steps"
                    maxLength={500}
                    disabled={generating || !canGenerate}
                    className="input-field"
                  />
                  <div className="flex flex-wrap gap-2 text-xs text-on-surface-variant">
                    {["Photosynthesis summary", "Ohm's Law derivation", "Federalism case study", "Organic mechanisms", "Data structures overview"].map(
                      (suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setTopic(suggestion)}
                          disabled={generating || !canGenerate}
                          className="rounded-full border border-outline-variant/30 px-3 py-1 transition hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {suggestion}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                      Note length
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {noteLengthOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNoteLength(opt.value)}
                          className={`flex flex-col rounded-xl border px-3 py-3 text-left shadow-sm transition ${
                            noteLength === opt.value
                              ? "border-primary/60 bg-primary/10 text-primary"
                              : "border-outline-variant/30 bg-surface text-on-surface hover:border-primary/40"
                          }`}
                          disabled={generating}
                        >
                          <span className="text-sm font-semibold">{opt.label}</span>
                          <span className="text-xs text-on-surface-variant">{opt.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                      AI Analysis Model
                    </p>
                    <div className="rounded-xl border border-outline-variant/30 bg-surface p-3 text-sm text-on-surface flex items-center justify-between">
                      <span className="font-semibold">Auto-select best free model</span>
                      <span className="text-xs text-on-surface-variant">Fallback across curated pool</span>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <input
                        type="checkbox"
                        checked={useWebSearch}
                        onChange={(e) => setUseWebSearch(e.target.checked)}
                        disabled={generating}
                      />
                      Include live web updates
                    </label>
                    {isAdminPlus && (
                      <div className="space-y-2 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                            Admin override
                          </p>
                          <span className="text-[10px] font-medium text-primary">Admin+</span>
                        </div>
                        <input
                          type="text"
                          placeholder="gemini:gemini-3.1-flash-lite-preview or openrouter:model-id"
                          value={adminModelOverride}
                          onChange={(e) => setAdminModelOverride(e.target.value)}
                          disabled={generating}
                          className="input-field text-xs"
                        />
                        <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                          <input
                            type="checkbox"
                            checked={applyOverrideGlobally}
                            onChange={(e) => setApplyOverrideGlobally(e.target.checked)}
                            disabled={generating}
                          />
                          Apply for everyone until server restart
                        </label>
                        <p className="text-[11px] text-tertiary">
                          Prefix with <code className="rounded bg-surface px-1">gemini:</code> to force Gemini or{" "}
                          <code className="rounded bg-surface px-1">openrouter:</code> for OpenRouter IDs.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-xs text-on-surface-variant">
                    {selectedPaper?.title ? (
                      <>
                        Using <strong>{selectedPaper.title}</strong> as the primary PDF context.
                      </>
                    ) : (
                      "Select a PDF above to prioritize its content in your notes."
                    )}
                  </div>
                  <button
                     onClick={generate}
                     disabled={generating || !topic.trim() || !canGenerate}
                    className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {generating ? `Generating… (${loadingStep})` : "✨ Generate Notes"}
                  </button>
                </div>

                {error && (
                  <p className="text-sm text-error">
                    ⚠ {error}
                  </p>
                )}
                {remaining === 0 && !isAdminPlus && (
                  <p className="text-sm text-error">
                    Daily limit reached. Come back tomorrow for {DAILY_LIMIT} more generations.
                  </p>
                )}
              </div>
            </div>

            {/* Export */}
            {activeDoc && (
              <div className="card border border-outline-variant/30 print-visible">
                <div className="flex flex-col gap-4 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    Export
                  </p>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-on-surface">
                      {activeDoc.topic}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Generated {new Date(activeDoc.generatedAt).toLocaleString()}
                      {activeDoc.noteLength ? ` • ${activeDoc.noteLength} length` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={(e) => handlePrint(e, "download")} className="btn inline-flex items-center gap-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="text-primary"><path fill="currentColor" d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5L13 3.5ZM8 13h3v6H8v-6Zm5 0h3v6h-3v-6Zm-5-4h8v2H8v-2Z"/></svg>
                      Export as PDF
                    </button>
                    <button
                      onClick={(e) => handlePrint(e, "preview")}
                      className="btn inline-flex items-center gap-2"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="text-primary"><path fill="currentColor" d="M12 5c5 0 9 4 10 7-1 3-5 7-10 7s-9-4-10-7c1-3 5-7 10-7Zm0 2c-3.53 0-6.43 2.61-7.62 5C5.57 14.39 8.47 17 12 17s6.43-2.61 7.62-5C18.43 9.61 15.53 7 12 7Zm0 2a3 3 0 1 1 0 6a3 3 0 0 1 0-6Zm0 2a1 1 0 1 0 0 2a1 1 0 0 0 0-2Z"/></svg>
                      Preview PDF
                    </button>
                    {activeDoc.sources && activeDoc.sources.length > 0 && (
                      <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
                        Sources: {activeDoc.sources.slice(0, 3).join(", ")}
                      </div>
                    )}
                  </div>
                  {pdfPreviewUrl && (
                    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                      <div className="flex items-center justify-between text-xs text-on-surface-variant mb-2">
                        <span>PDF Preview</span>
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            window.open(pdfPreviewUrl, "_blank");
                          }}
                        >
                          Open in new tab
                        </button>
                      </div>
                      <iframe title="PDF preview" src={pdfPreviewUrl} className="h-96 w-full rounded-lg border border-outline-variant/30" />
                    </div>
                  )}
                  <div
                    className="max-h-[520px] overflow-auto rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 text-sm leading-7 text-on-surface shadow-inner"
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: activeDocHtml }} />
                  </div>
                  <div className="pdf-export-source print-root-wrapper" aria-hidden="true">
                    <div ref={exportRef} className="print-root">
                      <div className="print-title-block avoid-break">
                        <h1>{activeDoc.topic}</h1>
                        <p>
                          Generated {new Date(activeDoc.generatedAt).toLocaleString()}
                          {activeDoc.noteLength ? ` • ${activeDoc.noteLength} length` : ""}
                        </p>
                      </div>
                      <div className="markdown-preview print-body" dangerouslySetInnerHTML={{ __html: activeDocHtml }} />
                    </div>
                  </div>
                </div>
                {generating && loadingSteps.length > 0 && (
                  <div className="mt-3 flex flex-col items-start gap-2">
                    {loadingSteps.map((step, idx) => (
                      <div key={step} className="flex items-start gap-2 text-xs text-on-surface-variant">
                        <span
                          className={`mt-[2px] inline-flex h-3 w-3 rounded-full ${
                            idx < loadingStepIndex ? "bg-primary" : idx === loadingStepIndex ? "bg-primary/70 animate-pulse" : "bg-outline-variant/60"
                          }`}
                          aria-hidden="true"
                        />
                        <span className={idx === loadingStepIndex ? "text-on-surface font-medium" : ""}>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <div className="card border border-outline-variant/30">
              <div className="flex flex-col gap-3 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Early Access
                </p>
                <p className="text-sm text-on-surface-variant">
                  Pro users can extract diagrams and equations with 99% accuracy using our updated vision engine.
                </p>
                <div className="flex items-center gap-2 text-xs text-primary">
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                    Vision Beta
                  </span>
                  <Link href="/browse" className="text-primary underline">
                    Browse archive
                  </Link>
                </div>
              </div>
            </div>

            <div className="card border border-outline-variant/30">
              <div className="flex gap-3 p-5">
                <div className="text-xl">💡</div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-on-surface">Quick Tip</p>
                  <p className="text-sm text-on-surface-variant">
                    For best results, pick a single chapter or exam section PDF instead of a full 500-page textbook.
                    Ask focused questions like “summarize circuits unit with key derivations”.
                  </p>
                </div>
              </div>
            </div>

            <div className="card border border-outline-variant/30">
              <div className="flex flex-col gap-4 p-5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-on-surface">Recently Generated</p>
                  <span className="rounded-full bg-surface-container-low px-2 py-1 text-xs text-on-surface-variant">
                    {documents.length} docs
                  </span>
                </div>
                {documents.length === 0 && (
                  <p className="text-sm text-on-surface-variant">
                    No documents yet. Generate your first notes above to see them here.
                  </p>
                )}
                <div className="space-y-3">
                  {documents.map((doc, idx) => (
                    <button
                      key={`${doc.topic}-${idx}`}
                      onClick={() => setActiveDoc(doc)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        activeDoc === doc
                          ? "border-primary/60 bg-primary/10 text-primary shadow-sm"
                          : "border-outline-variant/30 bg-surface hover:border-primary/40"
                      }`}
                    >
                      <p className="text-sm font-semibold">{doc.topic}</p>
                      <p className="text-xs text-on-surface-variant">
                        {new Date(doc.generatedAt).toLocaleString()}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
