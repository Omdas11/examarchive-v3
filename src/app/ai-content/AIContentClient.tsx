"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "katex/dist/katex.min.css";
import PrintableNotesDocument from "./PrintableNotesDocument";
import PrintInstructionsModal from "./PrintInstructionsModal";
import MarkdownNotesRenderer from "./MarkdownNotesRenderer";
import { useToast } from "@/components/ToastContext";

const COURSE_TYPES: Record<string, string[]> = {
  FYUG: ["DSC", "DSM", "SEC", "AEC", "VAC", "IDC"],
  CBCS: ["DSC", "SEC"],
};
const UNIT_OPTIONS = [1, 2, 3, 4, 5];
const BACKEND_PAPERS_MAX_DURATION_SECONDS = 300;
const RESUME_TIMEOUT_BUFFER_SECONDS = 5;
const TIMEOUT_THRESHOLD_SECONDS = BACKEND_PAPERS_MAX_DURATION_SECONDS - RESUME_TIMEOUT_BUFFER_SECONDS;
const SOLVED_PAPER_PART_SIZE = 10;
const ESTIMATED_MINUTES_PER_PART = 5;

function LoadingDots() {
  return (
    <span className="inline-flex items-end gap-1" aria-hidden="true">
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

export default function AIContentClient() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"notes" | "papers">("notes");
  const [university] = useState("Assam University");
  const [course, setCourse] = useState("FYUG");
  const [type, setType] = useState("DSC");
  const [paperCode, setPaperCode] = useState("");
  const [unitNumber, setUnitNumber] = useState(1);
  const [selectedYear, setSelectedYear] = useState<number | "">("");
  const [paperCodeOptions, setPaperCodeOptions] = useState<string[]>([]);
  const [yearsByPaperCode, setYearsByPaperCode] = useState<Record<string, number[]>>({});
  const [paperCodeLoading, setPaperCodeLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [model, setModel] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [notesRemaining, setNotesRemaining] = useState<number | null>(null);
  const [papersRemaining, setPapersRemaining] = useState<number | null>(null);
  const [notesDailyLimit, setNotesDailyLimit] = useState<number | null>(null);
  const [papersDailyLimit, setPapersDailyLimit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paperNameMap, setPaperNameMap] = useState<Record<string, string>>({});
  const [printInstructionsOpen, setPrintInstructionsOpen] = useState(false);
  const [generatedAtLabel, setGeneratedAtLabel] = useState("");
  const [syllabusContent, setSyllabusContent] = useState("");
  const [progressStatus, setProgressStatus] = useState("");
  const [progressTopic, setProgressTopic] = useState("");
  const [progressIndex, setProgressIndex] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [canResumeGeneration, setCanResumeGeneration] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [currentPart, setCurrentPart] = useState(1);
  const [totalParts, setTotalParts] = useState(1);
  const [streamingTextActive, setStreamingTextActive] = useState(false);
  const elapsedSecondsRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedPaperName = paperNameMap[paperCode] || paperCode;
  const availableYears = useMemo(() => yearsByPaperCode[paperCode] || [], [yearsByPaperCode, paperCode]);
  const progressPercent = progressTotal > 0 ? Math.min(100, Math.round((progressIndex / progressTotal) * 100)) : 0;
  const estimatedMinutesRemaining = useMemo(() => {
    if (activeTab !== "papers") return null;
    const safeCurrentPart = Math.max(1, currentPart);
    const fallbackByParts = Math.max(1, totalParts - safeCurrentPart + 1) * ESTIMATED_MINUTES_PER_PART;
    if (etaMinutes === null) return fallbackByParts;
    const elapsedMinutes = elapsedSeconds / 60;
    const remainingMinutes = Math.max(0, etaMinutes - elapsedMinutes);
    return Math.max(1, Math.ceil(remainingMinutes));
  }, [activeTab, etaMinutes, elapsedSeconds, totalParts, currentPart]);

  function formatElapsedTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function getQuotaSummaryLabel(): string {
    // Prefer strict per-feature quotas when available; fallback to legacy aggregate quota response.
    if (notesDailyLimit !== null && papersDailyLimit !== null) {
      return `Daily Limit: ${notesUsedToday ?? 0}/${notesDailyLimit} Notes | ${papersUsedToday ?? 0}/${papersDailyLimit} Solved Papers`;
    }
    if (remaining === null) return "Quota: Unlimited";
    return `Remaining generations: ${remaining}${typeof limit === "number" ? ` / ${limit}` : ""}`;
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    stopTimer();
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        elapsedSecondsRef.current = next;
        return next;
      });
    }, 1000);
  }

  function closeEventSource() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }

  function resetProgressState() {
    setGenerating(false);
    setProgressStatus("");
    setProgressTopic("");
    setProgressIndex(0);
    setProgressTotal(0);
    setStreamingTextActive(false);
    stopTimer();
    closeEventSource();
  }

  async function fetchSolvedPaperMeta(params: URLSearchParams): Promise<{ totalQuestions: number; totalParts: number; etaMinutes: number }> {
    const res = await fetch(`/api/generate-solved-paper-stream?${params.toString()}&meta=1`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to calculate ETA (status ${res.status}).`);
    const data = await res.json();
    const totalQuestions = typeof data.totalQuestions === "number" ? data.totalQuestions : 0;
    const computedParts =
      typeof data.totalParts === "number" && data.totalParts > 0
        ? data.totalParts
        : Math.max(1, Math.ceil(totalQuestions / SOLVED_PAPER_PART_SIZE));
    const computedEta =
      typeof data.etaMinutes === "number" && data.etaMinutes > 0
        ? data.etaMinutes
        : computedParts * ESTIMATED_MINUTES_PER_PART;
    return { totalQuestions, totalParts: computedParts, etaMinutes: computedEta };
  }

  function startGenerationStream(baseParams: URLSearchParams, part: number, resetOnFirstPart: boolean) {
    if (part === 1 && resetOnFirstPart) {
      setMarkdown("");
    }
    setCurrentPart(part);
    const streamParams = new URLSearchParams(baseParams.toString());
    streamParams.set("part", String(part));
    const source = new EventSource(
      activeTab === "notes"
        ? `/api/generate-notes-stream?${streamParams.toString()}`
        : `/api/generate-solved-paper-stream?${streamParams.toString()}`,
    );
    eventSourceRef.current = source;
    let finished = false;
    setStreamingTextActive(true);

    source.onmessage = (event) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      const eventType = typeof data.event === "string" ? data.event : "";
      if (eventType === "progress") {
        setProgressStatus(typeof data.status === "string" ? data.status : "Generating...");
        const topic = typeof data.topic === "string" ? data.topic : "";
        const question = typeof data.question === "string" ? data.question : "";
        setProgressTopic(topic.length > 0 ? topic : question);
        setProgressIndex(typeof data.index === "number" ? data.index : 0);
        setProgressTotal(typeof data.total === "number" ? data.total : 0);
        if (typeof data.part === "number") setCurrentPart(data.part);
        if (typeof data.totalParts === "number") setTotalParts(data.totalParts);
        return;
      }

      if (eventType === "handoff" && data.action === "auto_continue") {
        const sequentialNextPart = part + 1;
        let nextPart = sequentialNextPart;
        if (typeof data.nextPart === "number") {
          if (data.nextPart > part) {
            nextPart = data.nextPart;
          } else {
            console.warn("[ai-content] Invalid nextPart in auto_continue event. Falling back to sequential chaining.");
          }
        }
        if (typeof data.totalParts === "number") setTotalParts(data.totalParts);
        setStreamingTextActive(false);
        closeEventSource();
        startGenerationStream(baseParams, nextPart, false);
        return;
      }

      if (eventType === "done") {
        finished = true;
        setStreamingTextActive(false);
        const incomingMarkdown = typeof data.markdown === "string" ? data.markdown : "";
        setMarkdown((prevMarkdown) => {
          if (incomingMarkdown.trim().length === 0) return prevMarkdown;
          if (incomingMarkdown === prevMarkdown) return prevMarkdown;
          const shouldAppendToExisting = activeTab === "papers" && part > 1;
          if (
            shouldAppendToExisting &&
            incomingMarkdown.length >= prevMarkdown.length &&
            incomingMarkdown.startsWith(prevMarkdown)
          ) {
            return incomingMarkdown;
          }
          if (shouldAppendToExisting && prevMarkdown.includes(incomingMarkdown)) return prevMarkdown;
          const separator = prevMarkdown.trim().length > 0 ? "\n\n" : "";
          return prevMarkdown + separator + incomingMarkdown;
        });
        setSyllabusContent(typeof data.syllabus_content === "string" ? data.syllabus_content : "");
        setGeneratedAtLabel(new Date().toLocaleString());
        setModel(typeof data.model === "string" ? data.model : "");
        if (typeof data.remaining === "number" || data.remaining === null) {
          setRemaining(data.remaining);
        }
        if (typeof data.totalParts === "number") setTotalParts(data.totalParts);
        if (typeof data.part === "number") setCurrentPart(data.part);
        const isCached = typeof data.cached === "boolean" && data.cached;
        if (!isCached && activeTab === "notes") {
          setNotesRemaining((prev) => (typeof prev === "number" ? Math.max(0, prev - 1) : prev));
        } else if (!isCached) {
          setPapersRemaining((prev) => (typeof prev === "number" ? Math.max(0, prev - 1) : prev));
        }
        resetProgressState();
        return;
      }

      if (eventType === "error") {
        finished = true;
        const errorMessage = typeof data.error === "string" ? data.error : "Generation failed.";
        const shouldOfferResume = activeTab === "papers" && /timeout/i.test(errorMessage);
        setError(errorMessage);
        if (shouldOfferResume) {
          setCanResumeGeneration(true);
          showToast("Server timeout reached. Click Resume to continue from where it left off.", "warning");
        }
        resetProgressState();
      }
    };

    source.onerror = () => {
      if (finished) return;
      const timeoutError = activeTab === "papers" && elapsedSecondsRef.current >= TIMEOUT_THRESHOLD_SECONDS;
      setError(
        timeoutError
          ? "Server timeout reached. Click Resume to continue from where it left off."
          : "Network error. Please try again.",
      );
      if (timeoutError) {
        setCanResumeGeneration(true);
        showToast("Server timeout reached. Click Resume to continue from where it left off.", "warning");
      }
      resetProgressState();
    };
  }

  async function generate() {
    if (generating) return;
    // True when user is explicitly resuming after a timeout prompt; keep existing stitched markdown.
    const isResumeAttempt = activeTab === "papers" && canResumeGeneration;
    closeEventSource();
    setGenerating(true);
    setError(null);
    setProgressStatus("Starting chunked generation...");
    setProgressTopic("");
    setProgressIndex(0);
    setProgressTotal(0);
    setCanResumeGeneration(false);
    setCurrentPart(1);
    setTotalParts(1);
    setEtaMinutes(null);
    setStreamingTextActive(false);
    startTimer();
    setModel("");
    const params = new URLSearchParams({
      university,
      course,
      type,
      paperCode,
      ...(activeTab === "notes" ? { unitNumber: String(unitNumber) } : { year: String(selectedYear) }),
    });
    try {
      if (activeTab === "papers") {
        const meta = await fetchSolvedPaperMeta(params);
        setTotalParts(meta.totalParts);
        setEtaMinutes(meta.etaMinutes);
      }
      startGenerationStream(params, 1, !isResumeAttempt);
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : "Generation failed.");
      resetProgressState();
    }
  }

  function handleDownloadPdfClick() {
    if (!markdown) return;
    setPrintInstructionsOpen(true);
  }

  function proceedToPrint() {
    setPrintInstructionsOpen(false);
    window.print();
  }

  useEffect(() => {
    setPaperCodeLoading(true);
    fetch(`/api/generate-notes?university=${encodeURIComponent(university)}&course=${encodeURIComponent(course)}&type=${encodeURIComponent(type)}`)
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.remaining === "number" || data.remaining === null) setRemaining(data.remaining);
        if (typeof data.limit === "number" || data.limit === null) setLimit(data.limit);
        if (typeof data.notesRemaining === "number") setNotesRemaining(data.notesRemaining);
        if (typeof data.papersRemaining === "number") setPapersRemaining(data.papersRemaining);
        if (typeof data.notesDailyLimit === "number") setNotesDailyLimit(data.notesDailyLimit);
        if (typeof data.papersDailyLimit === "number") setPapersDailyLimit(data.papersDailyLimit);
        if (Array.isArray(data.paperCodes)) {
          const options = data.paperCodes.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0);
          setPaperCodeOptions(options);
          const resolvedMap: Record<string, string> = {};
          if (Array.isArray(data.papers)) {
            for (const paper of data.papers) {
              const code = typeof paper?.code === "string" ? paper.code.trim() : "";
              if (!code) continue;
              const name = typeof paper?.name === "string" ? paper.name.trim() : "";
              resolvedMap[code] = name || code;
            }
          }
          for (const code of options) {
            if (!resolvedMap[code]) resolvedMap[code] = code;
          }
          setPaperNameMap(resolvedMap);
          setPaperCode((current) => {
            if (current && options.includes(current)) return current;
            return options[0] || current;
          });
        }
        if (data.yearsByPaperCode && typeof data.yearsByPaperCode === "object") {
          const map: Record<string, number[]> = {};
          for (const [code, years] of Object.entries(data.yearsByPaperCode as Record<string, unknown>)) {
            if (Array.isArray(years)) {
              map[code] = years
                .map((year) => (typeof year === "number" ? year : Number(year)))
                .filter((year) => Number.isInteger(year));
            }
          }
          setYearsByPaperCode(map);
        }
        if (typeof data.syllabusContent === "string") {
          setSyllabusContent(data.syllabusContent);
        }
      })
      .catch(() => {})
      .finally(() => setPaperCodeLoading(false));
  }, [university, course, type]);

  useEffect(() => {
    if (availableYears.length === 0) {
      setSelectedYear("");
      return;
    }
    setSelectedYear((current) => {
      if (typeof current === "number" && availableYears.includes(current)) return current;
      return availableYears[0] ?? "";
    });
  }, [paperCode, availableYears]);

  useEffect(() => {
    const allowed = COURSE_TYPES[course] || COURSE_TYPES.FYUG;
    if (!allowed.includes(type)) {
      setType(allowed[0]);
    }
  }, [course, type]);

  useEffect(() => {
    return () => {
      stopTimer();
      closeEventSource();
    };
  }, []);

  const canGenerateByLegacyLimit = generating ? false : remaining === null || remaining > 0;
  const notesQuotaAllowed = notesRemaining === null || notesRemaining > 0;
  const papersQuotaAllowed = papersRemaining === null || papersRemaining > 0;
  const notesUsedToday =
    notesDailyLimit !== null && notesRemaining !== null
      ? Math.max(0, notesDailyLimit - notesRemaining)
      : null;
  const papersUsedToday =
    papersDailyLimit !== null && papersRemaining !== null
      ? Math.max(0, papersDailyLimit - papersRemaining)
      : null;
  const canGenerate =
    activeTab === "notes"
      ? canGenerateByLegacyLimit && notesQuotaAllowed
      : canGenerateByLegacyLimit && papersQuotaAllowed;

  return (
    <div className="relative min-h-screen bg-surface px-4 py-8 text-on-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-outline-variant/30 bg-surface-container p-6 shadow-lift">
          <h1 className="text-3xl font-bold">AI Content Generation</h1>
          <p className="mt-2 text-on-surface-variant">
            Generate full unit notes or solved papers from database-backed syllabus and question context.
          </p>
          <div className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {getQuotaSummaryLabel()}
          </div>
          <div className="mt-4 inline-flex rounded-xl border border-outline-variant/40 p-1">
            <button
              className={`rounded-lg px-3 py-1 text-sm ${activeTab === "notes" ? "bg-primary text-white" : "text-on-surface"}`}
              onClick={() => setActiveTab("notes")}
              disabled={generating}
            >
              Unit Notes
            </button>
            <button
              className={`rounded-lg px-3 py-1 text-sm ${activeTab === "papers" ? "bg-primary text-white" : "text-on-surface"}`}
              onClick={() => setActiveTab("papers")}
              disabled={generating}
            >
              Solved Papers
            </button>
          </div>
        </header>

        <section className="card border border-outline-variant/30 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold">University</label>
              <input className="input-field" value={university} disabled />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Course</label>
              <select className="input-field" value={course} onChange={(e) => setCourse(e.target.value)} disabled={generating}>
                <option value="FYUG">FYUG</option>
                <option value="CBCS">CBCS</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Type</label>
              <select className="input-field" value={type} onChange={(e) => setType(e.target.value)} disabled={generating}>
                {(COURSE_TYPES[course] || []).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Paper Code</label>
              <div className="flex gap-2">
                <select
                  className="input-field"
                  value={paperCode}
                  onChange={(e) => setPaperCode(e.target.value)}
                  disabled={generating || paperCodeLoading || paperCodeOptions.length === 0}
                >
                  <option value="">{paperCodeLoading ? "Loading..." : "Select paper code"}</option>
                  {paperCodeOptions.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <input
                  className="input-field"
                  value={paperCode}
                  onChange={(e) => setPaperCode(e.target.value)}
                  placeholder="Or type paper code"
                  disabled={generating}
                />
              </div>
            </div>
            {activeTab === "notes" ? (
              <div>
                <label className="mb-1 block text-sm font-semibold">Unit Number</label>
                <select
                  className="input-field"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(Number(e.target.value))}
                  disabled={generating}
                >
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-semibold">Year</label>
                <select
                  className="input-field"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  disabled={generating || availableYears.length === 0}
                >
                  <option value="">
                    {availableYears.length > 0 ? "Select year" : "No years available for selected paper"}
                  </option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={generate}
              disabled={!paperCode.trim() || !canGenerate || (activeTab === "papers" && selectedYear === "")}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating ? (
                <>
                  {activeTab === "notes" ? "Generating Unit Notes " : "Generating Solved Paper "}
                  <LoadingDots />
                </>
              ) : (
                activeTab === "notes"
                  ? "Generate Unit Notes"
                  : canResumeGeneration
                    ? "Resume Generation"
                    : "Generate Solved Paper"
              )}
            </button>
            {generating && <span className="text-xs text-on-surface-variant">Generation in progress — please wait.</span>}
          </div>
          {generating && (
            <div className="mt-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
              <p className="text-sm font-medium">{progressStatus || "Generating..."}</p>
              {progressTopic && <p className="mt-1 text-xs text-on-surface-variant">Current topic: {progressTopic}</p>}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-outline-variant/30">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">
                {progressTotal > 0 ? `Progress: ${progressIndex} / ${progressTotal}` : "Preparing generation chunks..."}
              </p>
              {activeTab === "papers" && (
                <p className="mt-1 text-xs text-on-surface-variant">
                  Part: {currentPart} / {Math.max(1, totalParts)}
                </p>
              )}
              {activeTab === "papers" && estimatedMinutesRemaining !== null && (
                <p className="mt-1 text-xs text-on-surface-variant">
                  Estimated time remaining: ~{estimatedMinutesRemaining} minutes.
                </p>
              )}
              <p className="mt-1 text-xs text-on-surface-variant">⏱️ Elapsed Time: {formatElapsedTime(elapsedSeconds)}</p>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-error">⚠ {error}</p>}
        </section>

        <section className="card border border-outline-variant/30 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Generated Markdown</h2>
            <button onClick={handleDownloadPdfClick} disabled={!markdown} className="btn">
              Download PDF
            </button>
          </div>
          <p className="mb-3 text-xs text-on-surface-variant">
            For richer client-side export, use <strong>jsPDF + html2canvas</strong> or <strong>react-to-print</strong>.
          </p>
          {model && <p className="mb-2 text-xs text-on-surface-variant">Model: {model}</p>}
          <div className={`print-root markdown-preview rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 ${streamingTextActive ? "ai-streaming-text" : ""}`}>
            <MarkdownNotesRenderer
              markdown={markdown}
              emptyFallback={<p className="text-on-surface-variant">No output yet. Generate notes to preview them here.</p>}
            />
          </div>
        </section>
      </div>
      <PrintInstructionsModal
        open={printInstructionsOpen}
        onClose={() => setPrintInstructionsOpen(false)}
        onProceed={proceedToPrint}
      />
      <PrintableNotesDocument
        markdown={markdown}
        syllabusContent={syllabusContent}
        paperName={selectedPaperName}
        paperCode={paperCode}
        generatedAt={generatedAtLabel}
        model={model || "gemini-3.1-flash-lite-preview"}
      />
    </div>
  );
}
