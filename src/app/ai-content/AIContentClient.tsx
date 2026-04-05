"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import "katex/dist/katex.min.css";
import MarkdownNotesRenderer from "./MarkdownNotesRenderer";
import LiveLogsConsole from "./LiveLogsConsole";
import { useToast } from "@/components/ToastContext";
import CustomDropdown, { type CustomDropdownOption } from "@/components/CustomDropdown";

const COURSE_TYPES: Record<string, string[]> = {
  FYUG: ["DSC", "DSM", "SEC", "AEC", "VAC", "IDC"],
  CBCS: ["DSC", "SEC"],
};
const STREAM_TYPES: Record<string, string[]> = {
  Arts: ["DSC", "DSM", "SEC", "AEC", "VAC", "IDC"],
  Science: ["DSC", "DSM", "SEC", "AEC", "VAC", "IDC"],
  Commerce: ["DSC", "DSM", "SEC", "AEC", "VAC", "IDC"],
};
const UNIT_OPTIONS = [1, 2, 3, 4, 5];
const BACKEND_PAPERS_MAX_DURATION_SECONDS = 300;
const RESUME_TIMEOUT_BUFFER_SECONDS = 5;
const TIMEOUT_THRESHOLD_SECONDS = BACKEND_PAPERS_MAX_DURATION_SECONDS - RESUME_TIMEOUT_BUFFER_SECONDS;
const SOLVED_PAPER_PART_SIZE = 10;

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
  const [stream, setStream] = useState("Arts");
  const [type, setType] = useState("DSC");
  const [paperCode, setPaperCode] = useState("");
  const [unitNumber, setUnitNumber] = useState(1);
  const [selectedYear, setSelectedYear] = useState<number | "">("");
  const [notesPaperCodes, setNotesPaperCodes] = useState<string[]>([]);
  const [papersPaperCodes, setPapersPaperCodes] = useState<string[]>([]);
  const [unitsByPaperCode, setUnitsByPaperCode] = useState<Record<string, number[]>>({});
  const [yearsByPaperCode, setYearsByPaperCode] = useState<Record<string, number[]>>({});
  const [paperCodeLoading, setPaperCodeLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [usedModel, setUsedModel] = useState("");
  const [notesPdfResult, setNotesPdfResult] = useState<{ key: string; url: string } | null>(null);
  const [papersPdfResult, setPapersPdfResult] = useState<{ key: string; url: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [notesRemaining, setNotesRemaining] = useState<number | null>(null);
  const [papersRemaining, setPapersRemaining] = useState<number | null>(null);
  const [notesDailyLimit, setNotesDailyLimit] = useState<number | null>(null);
  const [papersDailyLimit, setPapersDailyLimit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const [showLogs, setShowLogs] = useState(false);
  const elapsedSecondsRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasPaperCode = paperCode.trim().length > 0;
  const availableUnits = useMemo(() => {
    const units = unitsByPaperCode[paperCode];
    return Array.isArray(units) && units.length > 0 ? units : (hasPaperCode ? [] : UNIT_OPTIONS);
  }, [unitsByPaperCode, paperCode, hasPaperCode]);
  const availableYears = useMemo(() => yearsByPaperCode[paperCode] || [], [yearsByPaperCode, paperCode]);
  const courseOptions: CustomDropdownOption[] = useMemo(
    () => [
      { label: "FYUG", value: "FYUG" },
      { label: "CBCS", value: "CBCS" },
    ],
    [],
  );
  const streamOptions: CustomDropdownOption[] = useMemo(
    () => Object.keys(STREAM_TYPES).map((entry) => ({ label: entry, value: entry })),
    [],
  );
  const typeOptions: CustomDropdownOption[] = useMemo(
    () => {
      const allowedByCourse = COURSE_TYPES[course] || COURSE_TYPES.FYUG;
      const allowedByStream = STREAM_TYPES[stream] || STREAM_TYPES.Arts;
      return allowedByCourse
        .filter((entry) => allowedByStream.includes(entry))
        .map((entry) => ({ label: entry, value: entry }));
    },
    [course, stream],
  );
  const mergedPaperCodesForSolvedTab = useMemo(
    () => [...new Set([...notesPaperCodes, ...papersPaperCodes])].sort((a, b) => a.localeCompare(b)),
    [notesPaperCodes, papersPaperCodes],
  );
  const visiblePaperCodes = useMemo(
    () => (activeTab === "notes" ? notesPaperCodes : mergedPaperCodesForSolvedTab),
    [activeTab, notesPaperCodes, mergedPaperCodesForSolvedTab],
  );
  const paperCodeDropdownOptions: CustomDropdownOption[] = useMemo(
    () => visiblePaperCodes.map((code) => ({ label: code, value: code })),
    [visiblePaperCodes],
  );
  const unitOptions: CustomDropdownOption[] = useMemo(
    () => availableUnits.map((unit) => ({ label: String(unit), value: String(unit) })),
    [availableUnits],
  );
  const yearOptions: CustomDropdownOption[] = useMemo(
    () => availableYears.map((year) => ({ label: String(year), value: String(year) })),
    [availableYears],
  );
  const progressPercent = progressTotal > 0 ? Math.min(100, Math.round((progressIndex / progressTotal) * 100)) : 0;
  const notesSelectionKey = useMemo(
    () => [university, course, stream, type, paperCode.trim(), String(unitNumber)].join("|"),
    [university, course, stream, type, paperCode, unitNumber],
  );
  const papersSelectionKey = useMemo(
    () => [university, course, stream, type, paperCode.trim(), String(selectedYear)].join("|"),
    [university, course, stream, type, paperCode, selectedYear],
  );
  const activePdfUrl =
    activeTab === "notes"
      ? (notesPdfResult?.key === notesSelectionKey ? notesPdfResult.url : "")
      : (papersPdfResult?.key === papersSelectionKey ? papersPdfResult.url : "");
  const estimatedMinutesRemaining = useMemo(() => {
    if (activeTab !== "papers") return null;
    const fallbackByQuestions = Math.max(1, Math.ceil((Math.max(0, progressTotal || 0) * 16) / 60));
    if (etaMinutes === null) return fallbackByQuestions;
    const elapsedMinutes = elapsedSeconds / 60;
    const remainingMinutes = Math.max(0, etaMinutes - elapsedMinutes);
    return Math.max(1, Math.ceil(remainingMinutes));
  }, [activeTab, etaMinutes, elapsedSeconds, progressTotal]);

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

  function closeEventSource() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }

  function abortGeneration() {
    if (!generating) return;
    closeEventSource();
    setError("Generation aborted.");
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Generation aborted by user.`]);
    resetProgressState();
  }

  function resetProgressState() {
    setGenerating(false);
    setProgressStatus("");
    setProgressTopic("");
    setProgressIndex(0);
    setProgressTotal(0);
    setStreamingTextActive(false);
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
    const safeTotalQuestions = totalQuestions || 0;
    const computedEta =
      typeof data.etaMinutes === "number" && data.etaMinutes > 0
        ? data.etaMinutes
        : Math.ceil((safeTotalQuestions * 16) / 60);
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

      if (typeof data.log === "string" && data.log.trim().length > 0) {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${data.log}`]);
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
        setShowLogs(false);
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
        setUsedModel(typeof data.model === "string" ? data.model : "");
        if (typeof data.pdf_url === "string" && data.pdf_url.trim().length > 0) {
          if (activeTab === "notes") {
            setNotesPdfResult({ key: notesSelectionKey, url: data.pdf_url });
          } else {
            setPapersPdfResult({ key: papersSelectionKey, url: data.pdf_url });
          }
        }
        if (typeof data.remaining === "number" || data.remaining === null) {
          setRemaining(data.remaining);
        }
        if (typeof data.totalParts === "number") setTotalParts(data.totalParts);
        if (typeof data.part === "number") setCurrentPart(data.part);
        const isCached = typeof data.cached === "boolean" && data.cached;
        if ("Notification" in window && Notification.permission === "granted") {
          const title = "ExamArchive: Generation Complete!";
          const body =
            activeTab === "notes"
              ? "Your unit notes are ready. Return to ExamArchive to view and render your PDF."
              : "Your solved paper is ready. Return to ExamArchive to view and render your PDF.";
          new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: `examarchive-generation-${activeTab}`,
          });
        }
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
        return;
      }

      if (data.action === "error") {
        finished = true;
        setError(typeof data.error === "string" ? data.error : "Generation failed.");
        resetProgressState();
        return;
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
    if ("Notification" in window && Notification.permission !== "granted") {
      void Notification.requestPermission();
    }
    // True when user is explicitly resuming after a timeout prompt; keep existing stitched markdown.
    const isResumeAttempt = activeTab === "papers" && canResumeGeneration;
    closeEventSource();
    setLogs([]);
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
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setUsedModel("");
    if (activeTab === "notes") {
      setNotesPdfResult(null);
    } else {
      setPapersPdfResult(null);
    }
    setShowLogs(true);
    const params = new URLSearchParams({
      university,
      course,
      stream,
      type,
      paperCode,
      ...(activeTab === "notes"
        ? { unitNumber: String(unitNumber) }
        : { year: String(selectedYear) }),
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

  function handleDownloadPdfClick(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!activePdfUrl) return;
    setError(null);
    let downloadUrl = activePdfUrl;
    try {
      const parsed = new URL(activePdfUrl, window.location.origin);
      if (parsed.searchParams.get("download") !== "1") {
        parsed.searchParams.set("download", "1");
      }
      downloadUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      downloadUrl = `${activePdfUrl}${activePdfUrl.includes("?") ? "&" : "?"}download=1`;
    }
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  function handlePreviewPdfClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!activePdfUrl) return;
    setError(null);
    const previewUrl = activePdfUrl.replace(/\?download=1$/, "");
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  function handleGenerateClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    void generate();
  }

  function handleAbortClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    abortGeneration();
  }

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (generating) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          elapsedSecondsRef.current = next;
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [generating]);

  useEffect(() => {
    setPaperCodeLoading(true);
    const params = new URLSearchParams({
      university,
      course,
      stream,
      type,
    });
    fetch(`/api/generate-notes?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.remaining === "number" || data.remaining === null) setRemaining(data.remaining);
        if (typeof data.limit === "number" || data.limit === null) setLimit(data.limit);
        if (typeof data.notesRemaining === "number") setNotesRemaining(data.notesRemaining);
        if (typeof data.papersRemaining === "number") setPapersRemaining(data.papersRemaining);
        if (typeof data.notesDailyLimit === "number") setNotesDailyLimit(data.notesDailyLimit);
        if (typeof data.papersDailyLimit === "number") setPapersDailyLimit(data.papersDailyLimit);
        if (Array.isArray(data.notesPaperCodes)) {
          const options = data.notesPaperCodes.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0);
          setNotesPaperCodes(options);
        } else {
          setNotesPaperCodes([]);
        }
        if (Array.isArray(data.papersPaperCodes)) {
          const options = data.papersPaperCodes.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0);
          setPapersPaperCodes(options);
        } else {
          setPapersPaperCodes([]);
        }
        if (data.unitsByPaperCode && typeof data.unitsByPaperCode === "object") {
          const map: Record<string, number[]> = {};
          for (const [code, units] of Object.entries(data.unitsByPaperCode as Record<string, unknown>)) {
            if (Array.isArray(units)) {
              map[code] = units
                .map((unit) => (typeof unit === "number" ? unit : Number(unit)))
                .filter((unit) => Number.isInteger(unit) && unit > 0);
            }
          }
          setUnitsByPaperCode(map);
        } else {
          setUnitsByPaperCode({});
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
      })
      .catch(() => {
        setNotesPaperCodes([]);
        setPapersPaperCodes([]);
        setUnitsByPaperCode({});
        setPaperCode("");
        setYearsByPaperCode({});
        setSelectedYear("");
      })
      .finally(() => setPaperCodeLoading(false));
  }, [university, course, stream, type]);

  useEffect(() => {
    const fallbackCode = visiblePaperCodes[0] || "";
    setPaperCode((current) => {
      if (current && visiblePaperCodes.includes(current)) return current;
      return fallbackCode;
    });
  }, [visiblePaperCodes]);

  useEffect(() => {
    const defaultUnit = UNIT_OPTIONS[0] ?? 1;
    if (availableUnits.length === 0) {
      if (!hasPaperCode) setUnitNumber(defaultUnit);
      return;
    }
    const fallbackUnit = availableUnits[0] ?? defaultUnit;
    setUnitNumber((current) => (availableUnits.includes(current) ? current : fallbackUnit));
  }, [availableUnits, hasPaperCode]);

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
    const allowedByCourse = COURSE_TYPES[course] || COURSE_TYPES.FYUG;
    const allowedByStream = STREAM_TYPES[stream] || STREAM_TYPES.Arts;
    const allowed = allowedByCourse.filter((entry) => allowedByStream.includes(entry));
    if (!allowed.includes(type)) {
      setType(allowed[0]);
    }
  }, [course, stream, type]);

  useEffect(() => {
    return () => {
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
  const hasAvailableUnitsForPaper = availableUnits.length > 0;
  const hasAvailableYearsForPaper = availableYears.length > 0;
  const isGenerationDisabled =
    !hasPaperCode ||
    !canGenerate ||
    (activeTab === "papers" && selectedYear === "") ||
    (activeTab === "notes" && !hasAvailableUnitsForPaper);
  const isNotesGenerationFinished = activeTab === "notes" && !generating && Boolean(activePdfUrl);
  const isPapersGenerationFinished = activeTab === "papers" && !generating && Boolean(activePdfUrl);

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
              onClick={(event) => {
                event.preventDefault();
                setActiveTab("notes");
              }}
              disabled={generating}
              type="button"
            >
              Unit Notes
            </button>
            <button
              className={`rounded-lg px-3 py-1 text-sm ${activeTab === "papers" ? "bg-primary text-white" : "text-on-surface"}`}
              onClick={(event) => {
                event.preventDefault();
                setActiveTab("papers");
              }}
              disabled={generating}
              type="button"
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
              <CustomDropdown options={courseOptions} value={course} onChange={setCourse} disabled={generating} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Type</label>
              <CustomDropdown options={typeOptions} value={type} onChange={setType} disabled={generating} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Stream</label>
              <CustomDropdown options={streamOptions} value={stream} onChange={setStream} disabled={generating} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Paper Code</label>
              <CustomDropdown
                options={paperCodeDropdownOptions}
                value={paperCode}
                onChange={setPaperCode}
                placeholder={paperCodeLoading ? "Loading..." : "Select paper code"}
                disabled={generating || paperCodeLoading || visiblePaperCodes.length === 0}
              />
            </div>
            {activeTab === "notes" ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Unit Number</label>
                  <CustomDropdown
                    options={unitOptions}
                    value={String(unitNumber)}
                    onChange={(nextValue) => setUnitNumber(Number(nextValue))}
                    placeholder="Select unit"
                    disabled={generating || !hasAvailableUnitsForPaper}
                  />
                  {paperCode && !hasAvailableUnitsForPaper ? (
                    <p className="mt-2 text-sm text-red-600">No syllabus units found for this paper code.</p>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Year</label>
                  <CustomDropdown
                    options={yearOptions}
                    value={selectedYear === "" ? "" : String(selectedYear)}
                    onChange={(nextValue) => setSelectedYear(Number(nextValue))}
                    placeholder={availableYears.length > 0 ? "Select year" : "No years available for selected paper"}
                    disabled={generating || availableYears.length === 0}
                  />
                </div>
              </>
            )}
          </div>
          <div className="mt-4">
            {activeTab === "notes" ? (
              <div className="space-y-3">
                {!generating && !isNotesGenerationFinished && (
                  <button
                    onClick={handleGenerateClick}
                    disabled={isGenerationDisabled}
                    aria-busy={generating}
                    aria-live="polite"
                    className="btn-primary relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:content-[''] hover:before:animate-[shimmer_1.4s_ease-in-out_infinite] disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                  >
                    Generate Unit Notes
                  </button>
                )}
                {generating && (
                  <div className="space-y-2">
                    <button
                      disabled
                      aria-busy="true"
                      aria-live="polite"
                      className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold animate-pulse"
                      type="button"
                    >
                      Generating...
                      <LoadingDots />
                    </button>
                    <button
                      onClick={handleAbortClick}
                      className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                      type="button"
                    >
                      Abort Generation
                    </button>
                  </div>
                )}
                {!generating && isNotesGenerationFinished && (
                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <button onClick={handlePreviewPdfClick} className="btn w-full" type="button">
                        Preview
                      </button>
                      <button onClick={handleDownloadPdfClick} className="btn w-full" type="button">
                        Download
                      </button>
                    </div>
                    <button
                      onClick={handleGenerateClick}
                      disabled={isGenerationDisabled}
                      className="btn-primary w-full rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                    >
                      Generate Again
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {!hasAvailableYearsForPaper && hasPaperCode ? (
                  <div className="w-full rounded-xl border border-outline-variant/40 bg-surface-container px-4 py-3 text-sm text-on-surface-variant opacity-70">
                    Solved paper generation is unavailable for this paper code because no questions are ingested yet.
                  </div>
                ) : null}
                {isPapersGenerationFinished && !generating ? (
                  <div className="w-full space-y-2">
                    <div className="flex gap-3">
                      <button onClick={handlePreviewPdfClick} className="btn w-full" type="button">
                        Preview
                      </button>
                      <button onClick={handleDownloadPdfClick} className="btn w-full" type="button">
                        Download
                      </button>
                    </div>
                    <button
                      onClick={handleGenerateClick}
                      disabled={isGenerationDisabled}
                      className="btn-primary w-full rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                    >
                      {canResumeGeneration ? "Resume Generation" : "Generate Solved Paper"}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleGenerateClick}
                      disabled={isGenerationDisabled}
                      aria-busy={generating}
                      aria-live="polite"
                      className="btn-primary relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:content-[''] hover:before:animate-[shimmer_1.4s_ease-in-out_infinite] disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                    >
                      {generating ? (
                        <>
                          Generating Solved Paper <LoadingDots />
                        </>
                      ) : canResumeGeneration ? (
                        "Resume Generation"
                      ) : (
                        "Generate Solved Paper"
                      )}
                    </button>
                    {generating && (
                      <button
                        onClick={handleAbortClick}
                        className="btn rounded-xl px-4 py-3 text-sm font-semibold"
                        type="button"
                      >
                        Abort Generation
                      </button>
                    )}
                    {generating && <span className="text-xs text-on-surface-variant">Generation in progress — please wait.</span>}
                  </>
                )}
              </div>
            )}
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

        {markdown && (
          <section className="card border border-outline-variant/30 p-5">
            {usedModel && <p className="mb-2 text-xs text-on-surface-variant">Model: {usedModel}</p>}
            <div
              className={`print-root markdown-preview rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 ${streamingTextActive ? "ai-streaming-text" : ""}`}
            >
              <MarkdownNotesRenderer markdown={markdown} />
            </div>
          </section>
        )}
        <section className="card border border-outline-variant/30 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Generation Logs</h2>
            <button
              className="btn"
              onClick={() => setShowLogs((prev) => !prev)}
              aria-label={showLogs ? "Hide generation logs" : "Show generation logs"}
              type="button"
            >
              {showLogs ? "Hide Logs" : "Show Logs"}
            </button>
          </div>
          {showLogs ? (
            <LiveLogsConsole logs={logs} />
          ) : (
            <p className="text-sm text-on-surface-variant">Logs are hidden. Use “Show Logs” to inspect stream output.</p>
          )}
        </section>
      </div>
    </div>
  );
}
