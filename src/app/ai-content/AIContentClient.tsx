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
import DOMPurify from "dompurify";

const DEFAULT_MODEL_LABEL = "Gemini 3.1 Flash";

function LoadingDots() {
  return (
    <span className="inline-flex items-end gap-1" aria-hidden="true">
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

interface GeneratedDoc {
  topic: string;
  content: string;
  generatedAt: string;
  model?: string;
  modelLabel?: string;
  modelName?: string;
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

const PRINT_HEADER_BRAND = "EXAMARCHIVE";
const PRINT_FOOTER_MESSAGE =
  "Thank you for generating your study notes with ExamArchive! If you found this helpful, please share it with your friends and classmates.";
const PRINT_FOOTER_URL = "https://www.examarchive.dev";

export default function AIContentClient({ userRole: _userRole }: AIContentClientProps) {
  const [topic, setTopic] = useState("");
  const [noteLength, setNoteLength] = useState<NoteLength>("standard");
  const [noteLengthOptions, setNoteLengthOptions] = useState<NoteLengthOption[]>(getNoteLengthOptions());
  const [generating, setGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState("Preparing");
  const [documents, setDocuments] = useState<GeneratedDoc[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isFounder, setIsFounder] = useState(_userRole === "founder");
  const [isAdminPlus, setIsAdminPlus] = useState(_userRole === "founder" || _userRole === "admin");
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<GeneratedDoc | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [paperSearch, setPaperSearch] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState<string>("");
  const [paperLoading, setPaperLoading] = useState(false);
  const [adminModelOverride, setAdminModelOverride] = useState("");
  const [applyOverrideGlobally, setApplyOverrideGlobally] = useState(false);
  const loadingIntervalRef = useRef<number | null>(null);
  const originalDocumentTitleRef = useRef<string>("");
  const activeDocHtml = useMemo(
    () => (activeDoc ? markdownToHtmlWithKatex(activeDoc.content) : ""),
    [activeDoc],
  );
  const sanitizedActiveDocHtml = useMemo(
    () => (activeDocHtml ? DOMPurify.sanitize(activeDocHtml) : ""),
    [activeDocHtml],
  );
  const lastUpdatedLabel = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    originalDocumentTitleRef.current = document.title;
    return () => {
      if (originalDocumentTitleRef.current) {
        document.title = originalDocumentTitleRef.current;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeDoc?.topic) {
      document.title = `${activeDoc.topic}_Notes`;
    }
  }, [activeDoc?.topic]);

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
    setLoadingStep(steps[0]);
    loadingIntervalRef.current = window.setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, steps.length - 1);
      setLoadingStep(steps[stepIndex]);
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
        modelLabel: data.model_label || data.model || DEFAULT_MODEL_LABEL,
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

  function handlePrint(event?: React.MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!activeDoc) return;
    window.print();
  }

  const canGenerate = isAdminPlus || remaining === null || remaining > 0;
  const modelDisplay = activeDoc
    ? activeDoc.modelLabel || activeDoc.model || activeDoc.modelName || DEFAULT_MODEL_LABEL
    : DEFAULT_MODEL_LABEL;

  return (
    <div className="relative min-h-screen bg-surface px-4 py-8 text-on-surface">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/0 to-transparent" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6">
        <header className="no-print flex flex-col gap-3 rounded-2xl bg-surface-container p-6 shadow-lift border border-outline-variant/30">
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
            <span className="rounded-full bg-surface-container-low px-3 py-1 text-on-surface">
              Last Updated: {lastUpdatedLabel}
            </span>
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
                      <div>
                        <p className="font-semibold">{DEFAULT_MODEL_LABEL}</p>
                        <p className="text-xs text-on-surface-variant">Active default model (auto-selected)</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                        Default
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      We prioritize Gemini 3.1 Flash for analysis and gracefully fall back to a curated pool if needed.
                    </p>
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
                    {generating ? (
                      <span className="flex items-center gap-2">
                        <span>AI is compiling your notes...</span>
                        <LoadingDots />
                      </span>
                    ) : (
                      "✨ Generate Notes"
                    )}
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
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{PRINT_HEADER_BRAND}</p>
                  <div className="no-print flex flex-col gap-2">
                    <p className="text-sm font-semibold text-on-surface">
                      {activeDoc.topic}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Generated {new Date(activeDoc.generatedAt).toLocaleString()}
                      {activeDoc.noteLength ? ` • ${activeDoc.noteLength} length` : ""}
                    </p>
                  </div>
                  <div className="print-action-controls no-print flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setShowDownloadModal(true)}
                      className="btn inline-flex items-center gap-2"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                        className="text-primary"
                      >
                        <path
                          fill="currentColor"
                          d="M12 16a1 1 0 0 1-.7-.29l-4-4 1.4-1.42L11 12.59V3h2v9.59l2.3-2.3 1.4 1.42-4 4a1 1 0 0 1-.7.29ZM5 19v-4h2v3h10v-3h2v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"
                        />
                      </svg>
                      Download PDF
                    </button>
                    <button onClick={(e) => handlePrint(e)} className="btn inline-flex items-center gap-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="text-primary">
                        <path fill="currentColor" d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5L13 3.5ZM8 13h3v6H8v-6Zm5 0h3v6h-3v-6Zm-5-4h8v2H8v-2Z" />
                      </svg>
                      Print Preview
                    </button>
                    {activeDoc.sources && activeDoc.sources.length > 0 && (
                      <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
                        Sources: {activeDoc.sources.slice(0, 3).join(", ")}
                      </div>
                    )}
                  </div>
                  <div
                    className="no-print print-ghost-preview max-h-[520px] overflow-auto rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 text-sm leading-7 text-on-surface shadow-inner"
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: sanitizedActiveDocHtml }} />
                  </div>
                  <div
                    id="printable-exam-notes"
                    className="pdf-export-source print-root-wrapper"
                    aria-hidden="true"
                  >
                    <div className="print-watermark" aria-hidden="true">
                      ExamArchive
                    </div>
                    <div className="print-root">
                      <div className="print-title-block avoid-break">
                        <h1>{activeDoc.topic}</h1>
                        <p>
                          Generated {new Date(activeDoc.generatedAt).toLocaleString()}
                          {modelDisplay ? ` • Model: ${modelDisplay}` : ""}
                          {activeDoc.noteLength ? ` • ${activeDoc.noteLength} length` : ""}
                        </p>
                      </div>
                      <div className="markdown-preview print-body" dangerouslySetInnerHTML={{ __html: sanitizedActiveDocHtml }} />
                      <footer className="print-footer avoid-break mt-10 text-center" aria-label="ExamArchive print footer">
                        <p className="mb-2">{PRINT_FOOTER_MESSAGE}</p>
                        <a
                          href={PRINT_FOOTER_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Visit ExamArchive website (opens in a new tab)"
                        >
                          Visit ExamArchive website
                        </a>
                      </footer>
                    </div>
                  </div>
                </div>
                {generating && (
                  <div className="mt-3 inline-flex flex-wrap items-center gap-2 text-sm text-on-surface-variant" aria-live="polite">
                    <span className="sr-only">{loadingStep}</span>
                    <LoadingDots />
                    <span>AI is compiling your notes...</span>
                    <span className="text-xs text-on-surface-variant">({loadingStep})</span>
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
      {showDownloadModal && (
        <div className="no-print fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-primary">Export helper</p>
                <h2 className="text-xl font-bold text-on-surface">How to Download your Notes</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDownloadModal(false)}
                aria-label="Close download instructions"
                className="rounded-full bg-surface-container-low px-2 py-1 text-sm text-on-surface-variant transition hover:text-on-surface"
              >
                ✕
              </button>
            </div>
            <ul className="mt-4 list-decimal space-y-2 pl-5 text-sm text-on-surface">
              <li>Change the destination to Save as PDF.</li>
              <li>Set Paper Size to ISO A4.</li>
              <li>Click Save.</li>
            </ul>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDownloadModal(false)}
                className="btn border border-outline-variant/40 bg-surface text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2"
                onClick={() => {
                  setShowDownloadModal(false);
                  // Small delay lets the modal close paint before the print dialog opens.
                  setTimeout(() => handlePrint(), 150);
                }}
              >
                Got it, let&apos;s go!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
