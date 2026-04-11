"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import "katex/dist/katex.min.css";
import { useToast } from "@/components/ToastContext";
import CustomDropdown, { type CustomDropdownOption } from "@/components/CustomDropdown";
import { formatIstTime } from "@/lib/datetime";

const COURSE_TYPES: Record<string, string[]> = {
  FYUG: ["DSC", "DSM", "SEC", "AEC", "VAC", "IDC"],
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
// Intentionally avoid 100% until backend confirms completion to keep the simulation believable.
const NOTES_RERENDER_PROGRESS_CAP = 93;
const NOTES_RERENDER_BASE_INCREMENT = 3;
const NOTES_RERENDER_INCREMENT_VARIANCE = 5;
const NOTES_RERENDER_STATUS_STEPS = [
  "Rehydrating cached notes payload...",
  "Applying personalized watermark...",
  "Composing personalized footer...",
  "Rendering pages in print-safe mode...",
  "Uploading personalized PDF...",
];
type StepStatus = "pending" | "loading" | "success" | "error";
type TimelineStep = {
  key: string;
  title: string;
  status: StepStatus;
  detail: string;
  logs: string[];
  expanded: boolean;
};

function getTimelineStepStyles(status: StepStatus): { badgeClass: string; iconClass: string; icon: string; label: string } {
  switch (status) {
    case "success":
      return {
        badgeClass: "bg-green-50 text-green-700 border border-green-200",
        iconClass: "bg-green-600 text-white",
        icon: "✓",
        label: "Success",
      };
    case "error":
      return {
        badgeClass: "bg-red-50 text-red-700 border border-red-200",
        iconClass: "bg-red-600 text-white",
        icon: "✕",
        label: "Error",
      };
    case "loading":
      return {
        badgeClass: "bg-primary/10 text-primary border border-primary/20",
        iconClass: "bg-primary text-white animate-pulse",
        icon: "…",
        label: "Loading",
      };
    default:
      return {
        badgeClass: "bg-surface-container text-on-surface-variant border border-outline-variant/50",
        iconClass: "bg-outline-variant text-on-surface",
        icon: "•",
        label: "Pending",
      };
  }
}

function initialNotesTimelineSteps(): TimelineStep[] {
  return [
    {
      key: "cache_lookup",
      title: "Searching existing PDF and markdown cache",
      status: "loading",
      detail: "Searching Appwrite bucket and cache records...",
      logs: [],
      expanded: true,
    },
    {
      key: "cache_decision",
      title: "Cache result decision",
      status: "pending",
      detail: "Waiting for cache lookup result...",
      logs: [],
      expanded: false,
    },
    {
      key: "ai_generation",
      title: "AI generation",
      status: "pending",
      detail: "Will start only if cache cannot serve PDF directly.",
      logs: [],
      expanded: false,
    },
    {
      key: "pdf_render",
      title: "PDF rendering and upload",
      status: "pending",
      detail: "Will render and upload when markdown is available.",
      logs: [],
      expanded: false,
    },
    {
      key: "completed",
      title: "Completion",
      status: "pending",
      detail: "Waiting for final done event.",
      logs: [],
      expanded: false,
    },
  ];
}

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
  const [semester, setSemester] = useState<number | "">("");
  const [unitNumber, setUnitNumber] = useState(1);
  const [selectedYear, setSelectedYear] = useState<number | "">("");
  const [notesPaperCodes, setNotesPaperCodes] = useState<string[]>([]);
  const [papersPaperCodes, setPapersPaperCodes] = useState<string[]>([]);
  const [unitsByPaperCode, setUnitsByPaperCode] = useState<Record<string, number[]>>({});
  const [yearsByPaperCode, setYearsByPaperCode] = useState<Record<string, number[]>>({});
  const [semestersByPaperCode, setSemestersByPaperCode] = useState<Record<string, number[]>>({});
  const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
  const [paperCodeLoading, setPaperCodeLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notesPdfResult, setNotesPdfResult] = useState<{
    key: string;
    url: string;
    cacheSource: "pdf" | "markdown" | null;
    canRerenderFromMarkdown: boolean;
  } | null>(null);
  const [papersPdfResult, setPapersPdfResult] = useState<{ key: string; url: string } | null>(null);
  const [notesTimelineSteps, setNotesTimelineSteps] = useState<TimelineStep[]>([]);
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
  const [notesRerenderSimActive, setNotesRerenderSimActive] = useState(false);
  const [notesRerenderProgress, setNotesRerenderProgress] = useState(0);
  const generationRunIdRef = useRef(0);
  const elapsedSecondsRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasPaperCode = paperCode.trim().length > 0;
  const availableUnits = useMemo(() => {
    const units = unitsByPaperCode[paperCode];
    return Array.isArray(units) && units.length > 0 ? units : (hasPaperCode ? [] : UNIT_OPTIONS);
  }, [unitsByPaperCode, paperCode, hasPaperCode]);
  const availableYears = useMemo(() => yearsByPaperCode[paperCode] || [], [yearsByPaperCode, paperCode]);
  const availableSemestersForSelection = useMemo(() => {
    const mapped = semestersByPaperCode[paperCode];
    if (Array.isArray(mapped) && mapped.length > 0) return mapped;
    return availableSemesters;
  }, [semestersByPaperCode, paperCode, availableSemesters]);
  const courseOptions: CustomDropdownOption[] = useMemo(
    () => [{ label: "FYUG", value: "FYUG" }],
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
  const visiblePaperCodes = useMemo(() => {
    const baseCodes = activeTab === "notes" ? notesPaperCodes : mergedPaperCodesForSolvedTab;
    if (semester === "") return baseCodes;
    return baseCodes.filter((code) => {
      const semesters = semestersByPaperCode[code];
      if (!Array.isArray(semesters) || semesters.length === 0) return true;
      return semesters.includes(semester);
    });
  }, [activeTab, notesPaperCodes, mergedPaperCodesForSolvedTab, semester, semestersByPaperCode]);
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
  const semesterOptions: CustomDropdownOption[] = useMemo(
    () => availableSemestersForSelection.map((entry) => ({ label: `SEMESTER ${entry}`, value: String(entry) })),
    [availableSemestersForSelection],
  );
  const progressPercent = progressTotal > 0 ? Math.min(100, Math.round((progressIndex / progressTotal) * 100)) : 0;
  const notesSelectionKey = useMemo(
    () => [university, course, stream, type, String(semester), paperCode.trim(), String(unitNumber)].join("|"),
    [university, course, stream, type, semester, paperCode, unitNumber],
  );
  const papersSelectionKey = useMemo(
    () => [university, course, stream, type, String(semester), paperCode.trim(), String(selectedYear)].join("|"),
    [university, course, stream, type, semester, paperCode, selectedYear],
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
  const notesRerenderStatus = useMemo(() => {
    const stepIndex = Math.min(
      NOTES_RERENDER_STATUS_STEPS.length - 1,
      Math.floor((notesRerenderProgress / 100) * NOTES_RERENDER_STATUS_STEPS.length),
    );
    return NOTES_RERENDER_STATUS_STEPS[Math.max(0, stepIndex)] || NOTES_RERENDER_STATUS_STEPS[0];
  }, [notesRerenderProgress]);

  function formatElapsedTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function upsertTimelineStep(
    key: string,
    updater: (step: TimelineStep) => TimelineStep,
  ) {
    setNotesTimelineSteps((prev) => {
      const index = prev.findIndex((step) => step.key === key);
      if (index < 0) return prev;
      const next = [...prev];
      next[index] = updater(next[index]);
      return next;
    });
  }

  function appendTimelineLog(key: string, message: string) {
    upsertTimelineStep(key, (step) => ({
      ...step,
      logs: [...step.logs, `[${formatIstTime()} IST] ${message}`],
    }));
  }

  function setTimelineStatus(key: string, status: StepStatus, detail: string) {
    upsertTimelineStep(key, (step) => ({
      ...step,
      status,
      detail,
      expanded: status === "error" ? true : step.expanded,
    }));
  }

  function classifyNotesLog(message: string) {
    const normalized = message.toLowerCase();
    if (
      normalized.includes("cache") &&
      (normalized.includes("search") || normalized.includes("lookup") || normalized.includes("bucket"))
    ) return "cache_lookup";
    if (
      normalized.includes("cache pdf found") ||
      normalized.includes("cache markdown found") ||
      normalized.includes("cache pdf reference missing") ||
      normalized.includes("re-render requested")
    ) return "cache_decision";
    if (normalized.includes("ai generation") || normalized.includes("topic") || normalized.includes("gemini")) return "ai_generation";
    if (
      normalized.includes("azure") ||
      normalized.includes("gotenberg") ||
      normalized.includes("pdf rendered") ||
      normalized.includes("watermark") ||
      normalized.includes("footer")
    ) return "pdf_render";
    return "cache_lookup";
  }

  function startNotesRerenderSimulation() {
    setNotesRerenderSimActive(true);
    setNotesRerenderProgress((prev) => (prev > 0 ? prev : 6));
  }

  function stopNotesRerenderSimulation(markAsComplete: boolean) {
    setNotesRerenderSimActive(false);
    setNotesRerenderProgress(markAsComplete ? 100 : 0);
  }

  async function copyTimelineLogs(step: TimelineStep) {
    const content = step.logs.join("\n");
    if (!content) {
      showToast("No logs available for this step yet.", "warning");
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      showToast("Logs copied to clipboard.", "success");
    } catch {
      showToast("Failed to copy logs.", "error");
    }
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
    generationRunIdRef.current += 1;
    closeEventSource();
    setNotesPdfResult(null);
    setPapersPdfResult(null);
    setCanResumeGeneration(false);
    setError("Generation aborted.");
    setTimelineStatus("completed", "error", "Generation aborted by user.");
    resetProgressState();
  }

  function resetProgressState() {
    setGenerating(false);
    setProgressStatus("");
    setProgressTopic("");
    setProgressIndex(0);
    setProgressTotal(0);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setNotesRerenderSimActive(false);
    setNotesRerenderProgress(0);
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

  function startGenerationStream(baseParams: URLSearchParams, part: number, runId: number) {
    if (runId !== generationRunIdRef.current) return;
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

    source.onmessage = (event) => {
      if (runId !== generationRunIdRef.current) return;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (typeof data.log === "string" && data.log.trim().length > 0) {
        if (activeTab === "notes") {
          const stepKey = classifyNotesLog(data.log);
          appendTimelineLog(stepKey, data.log);
          if (stepKey === "cache_lookup") {
            setTimelineStatus("cache_lookup", "loading", "Searching Appwrite bucket and cache records...");
          }
          if (data.log.includes("Cache PDF found")) {
            setTimelineStatus("cache_lookup", "success", "Cache lookup completed.");
            setTimelineStatus("cache_decision", "success", "Existing PDF found in cache.");
            setTimelineStatus("ai_generation", "success", "Skipped: cached PDF path does not require AI generation.");
            setTimelineStatus("pdf_render", "success", "Skipped: reusing existing cached PDF.");
          }
          if (data.log.includes("Cache PDF reference missing")) {
            setTimelineStatus("cache_lookup", "success", "Cache lookup completed.");
            setTimelineStatus("cache_decision", "success", "No reusable PDF found. Will continue with markdown.");
            setTimelineStatus("ai_generation", "loading", "Preparing generation from markdown cache.");
            startNotesRerenderSimulation();
          }
          if (data.log.includes("Cache markdown found") || data.log.includes("Re-render requested")) {
            setTimelineStatus("cache_lookup", "success", "Cache lookup completed.");
            setTimelineStatus("cache_decision", "success", "Using cached markdown path.");
            setTimelineStatus("ai_generation", "success", "Skipped: rendering directly from cached markdown.");
            setTimelineStatus("pdf_render", "loading", "Rendering PDF from markdown...");
            startNotesRerenderSimulation();
          }
          if (data.log.includes("Applying personalized watermark") || data.log.includes("Compositing personalized footer")) {
            startNotesRerenderSimulation();
          }
          if (data.log.includes("AI generation complete")) {
            setTimelineStatus("ai_generation", "success", "AI generation completed.");
            setTimelineStatus("pdf_render", "loading", "Sending HTML payload for PDF rendering...");
          }
          if (data.log.includes("Sending HTML payload")) {
            setTimelineStatus("pdf_render", "loading", "Sending HTML payload for PDF rendering...");
          }
          if (data.log.includes("PDF rendered and uploaded successfully") || data.log.includes("PDF rendered successfully from cached markdown")) {
            setTimelineStatus("pdf_render", "success", "PDF rendered and uploaded successfully.");
            stopNotesRerenderSimulation(true);
          }
        }
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
        if (activeTab === "notes") {
          setTimelineStatus("cache_lookup", "success", "Cache lookup completed.");
          setTimelineStatus("cache_decision", "success", "No reusable cache hit. Continuing generation.");
          setTimelineStatus("ai_generation", "loading", typeof data.status === "string" ? data.status : "Generating notes with AI...");
        }
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
        closeEventSource();
        startGenerationStream(baseParams, nextPart, runId);
        return;
      }

      if (eventType === "done") {
        const incomingPdfUrl = typeof data.pdf_url === "string" ? data.pdf_url.trim() : "";
        if (!incomingPdfUrl) {
          finished = true;
          setError("PDF generation failed. Please try again.");
          if (activeTab === "notes") {
            setTimelineStatus("completed", "error", "Done event received without a PDF URL.");
          }
          resetProgressState();
          return;
        }
        finished = true;
        if (activeTab === "notes") {
          const rawCacheSource = typeof data.cache_source === "string" ? data.cache_source : "";
          const cacheSource = rawCacheSource === "pdf" || rawCacheSource === "markdown"
            ? rawCacheSource
            : null;
          const canRerenderFromMarkdown = typeof data.can_rerender_from_markdown === "boolean"
            ? data.can_rerender_from_markdown
            : false;
          setNotesPdfResult({
            key: notesSelectionKey,
            url: incomingPdfUrl,
            cacheSource,
            canRerenderFromMarkdown,
          });
          setTimelineStatus("cache_lookup", "success", "Cache lookup completed.");
          if (cacheSource === "pdf") {
            setTimelineStatus("cache_decision", "success", "Existing PDF found in cache.");
            setTimelineStatus("ai_generation", "success", "Skipped: cached PDF path does not require AI generation.");
            setTimelineStatus("pdf_render", "success", "Skipped: reusing existing cached PDF.");
            stopNotesRerenderSimulation(false);
          } else if (cacheSource === "markdown") {
            setTimelineStatus("cache_decision", "success", "Using cached markdown path.");
            setTimelineStatus("ai_generation", "success", "Skipped: rendering directly from cached markdown.");
            setTimelineStatus("pdf_render", "success", "PDF rendered successfully from cached markdown.");
            stopNotesRerenderSimulation(true);
          } else {
            setTimelineStatus("cache_decision", "success", "No reusable cache hit. Continuing generation.");
            setTimelineStatus("ai_generation", "success", "AI generation completed.");
            setTimelineStatus("pdf_render", "success", "PDF rendered and uploaded successfully.");
            stopNotesRerenderSimulation(false);
          }
          setTimelineStatus("completed", "success", cacheSource === "pdf"
            ? "Existing cached PDF is ready."
            : "PDF ready from markdown rendering.");
        } else {
          setPapersPdfResult({ key: papersSelectionKey, url: incomingPdfUrl });
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
        if (activeTab === "notes") {
          setTimelineStatus("completed", "error", errorMessage);
          stopNotesRerenderSimulation(false);
        }
        if (shouldOfferResume) {
          setCanResumeGeneration(true);
          showToast("Server timeout reached. Click Resume to continue from where it left off.", "warning");
        }
        resetProgressState();
        return;
      }

      if (data.action === "error") {
        finished = true;
        const failureMessage = typeof data.error === "string" ? data.error : "Generation failed.";
        setError(failureMessage);
        if (activeTab === "notes") {
          setTimelineStatus("completed", "error", failureMessage);
          stopNotesRerenderSimulation(false);
        }
        resetProgressState();
        return;
      }
    };

    source.onerror = () => {
      if (runId !== generationRunIdRef.current) return;
      if (finished) return;
      const timeoutError = activeTab === "papers" && elapsedSecondsRef.current >= TIMEOUT_THRESHOLD_SECONDS;
      setError(
        timeoutError
          ? "Server timeout reached. Click Resume to continue from where it left off."
          : "Network error. Please try again.",
      );
      if (activeTab === "notes") {
        setTimelineStatus("completed", "error", timeoutError
          ? "Server timeout reached."
          : "Network error while receiving stream events.");
      }
      if (timeoutError) {
        setCanResumeGeneration(true);
        showToast("Server timeout reached. Click Resume to continue from where it left off.", "warning");
      }
      resetProgressState();
    };
  }

  async function generate(options?: { forceMarkdownRerender?: boolean }) {
    if (generating) return;
    if ("Notification" in window && Notification.permission !== "granted") {
      void Notification.requestPermission();
    }
    closeEventSource();
    const runId = generationRunIdRef.current + 1;
    generationRunIdRef.current = runId;
    setGenerating(true);
    setError(null);
    setProgressStatus(activeTab === "notes" ? "Searching existing PDF and markdown cache..." : "Starting chunked generation...");
    setProgressTopic("");
    setProgressIndex(0);
    setProgressTotal(0);
    setCanResumeGeneration(false);
    setCurrentPart(1);
    setTotalParts(1);
    setEtaMinutes(null);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setNotesRerenderSimActive(false);
    setNotesRerenderProgress(0);
    if (activeTab === "notes") {
      setNotesPdfResult(null);
      const steps = initialNotesTimelineSteps();
      if (options?.forceMarkdownRerender) {
        steps[0] = { ...steps[0], status: "success", detail: "Skipped cache PDF reuse by user choice." };
        steps[1] = { ...steps[1], status: "success", detail: "Forced re-render from existing markdown." };
        steps[3] = { ...steps[3], status: "loading", detail: "Rendering PDF from cached markdown..." };
      }
      setNotesTimelineSteps(steps);
    } else {
      setPapersPdfResult(null);
    }
    const params = new URLSearchParams({
      university,
      course,
      stream,
      type,
      paperCode,
      ...(activeTab === "notes"
        ? { unitNumber: String(unitNumber) }
        : { year: String(selectedYear) }),
      ...(semester !== "" ? { semester: String(semester) } : {}),
    });
    if (options?.forceMarkdownRerender) {
      params.set("rerender", "1");
    }
    try {
      if (activeTab === "papers") {
        const meta = await fetchSolvedPaperMeta(params);
        setTotalParts(meta.totalParts);
        setEtaMinutes(meta.etaMinutes);
      }
      startGenerationStream(params, 1, runId);
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

  function handleRerenderFromMarkdownClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (generating) return;
    void generate({ forceMarkdownRerender: true });
  }

  function handleAbortClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    abortGeneration();
  }

  useEffect(() => {
    if (!notesRerenderSimActive) return;
    const interval = setInterval(() => {
      setNotesRerenderProgress((prev) => {
        if (prev >= NOTES_RERENDER_PROGRESS_CAP) return NOTES_RERENDER_PROGRESS_CAP;
        const increment = NOTES_RERENDER_BASE_INCREMENT + (prev % NOTES_RERENDER_INCREMENT_VARIANCE);
        return Math.min(NOTES_RERENDER_PROGRESS_CAP, prev + increment);
      });
    }, 850);
    return () => clearInterval(interval);
  }, [notesRerenderSimActive]);

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
        } else {
          setYearsByPaperCode({});
        }
        if (data.semestersByPaperCode && typeof data.semestersByPaperCode === "object") {
          const map: Record<string, number[]> = {};
          for (const [code, semesters] of Object.entries(data.semestersByPaperCode as Record<string, unknown>)) {
            if (Array.isArray(semesters)) {
              map[code] = semesters
                .map((entry) => (typeof entry === "number" ? entry : Number(entry)))
                .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 8);
            }
          }
          setSemestersByPaperCode(map);
        } else {
          setSemestersByPaperCode({});
        }
        if (Array.isArray(data.availableSemesters)) {
          setAvailableSemesters(
            data.availableSemesters
              .map((entry: unknown) => (typeof entry === "number" ? entry : Number(entry)))
              .filter((entry: number) => Number.isInteger(entry) && entry >= 1 && entry <= 8),
          );
        } else {
          setAvailableSemesters([]);
        }
      })
      .catch(() => {
        setNotesPaperCodes([]);
        setPapersPaperCodes([]);
        setUnitsByPaperCode({});
        setPaperCode("");
        setYearsByPaperCode({});
        setSemestersByPaperCode({});
        setAvailableSemesters([]);
        setSemester("");
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
    if (availableSemestersForSelection.length === 0) {
      setSemester("");
      return;
    }
    setSemester((current) => {
      if (typeof current === "number" && availableSemestersForSelection.includes(current)) return current;
      return availableSemestersForSelection[0] ?? "";
    });
  }, [paperCode, availableSemestersForSelection]);

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
  const hasAvailableSemesters = semesterOptions.length > 0;
  const isGenerationDisabled =
    !hasPaperCode ||
    !hasAvailableSemesters ||
    !canGenerate ||
    (activeTab === "papers" && selectedYear === "") ||
    (activeTab === "notes" && !hasAvailableUnitsForPaper);
  const isNotesGenerationFinished = activeTab === "notes" && !generating && Boolean(activePdfUrl);
  const isPapersGenerationFinished = activeTab === "papers" && !generating && Boolean(activePdfUrl);
  const isCachedPdfReuseResult =
    notesPdfResult?.key === notesSelectionKey &&
    notesPdfResult.cacheSource === "pdf";
  const canRerenderFromMarkdown =
    notesPdfResult?.key === notesSelectionKey &&
    notesPdfResult.canRerenderFromMarkdown === true;

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
              <label className="mb-1 block text-sm font-semibold">Stream</label>
              <CustomDropdown options={streamOptions} value={stream} onChange={setStream} disabled={generating} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Semester</label>
              <CustomDropdown
                options={semesterOptions}
                value={semester === "" ? "" : String(semester)}
                onChange={(nextValue) => setSemester(Number(nextValue))}
                placeholder="Select semester"
                disabled={generating || semesterOptions.length === 0}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Type</label>
              <CustomDropdown options={typeOptions} value={type} onChange={setType} disabled={generating} />
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
                    {isCachedPdfReuseResult && canRerenderFromMarkdown ? (
                      <div className="flex gap-3">
                        <button onClick={handleDownloadPdfClick} className="btn w-full" type="button">
                          Download PDF
                        </button>
                        <button onClick={handleRerenderFromMarkdownClick} className="btn w-full" type="button">
                          Re-render PDF
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button onClick={handlePreviewPdfClick} className="btn w-full" type="button">
                          Preview
                        </button>
                        <button onClick={handleDownloadPdfClick} className="btn w-full" type="button">
                          Download
                        </button>
                      </div>
                    )}
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
          {generating && activeTab === "papers" && (
            <div className="mt-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
              <p className="text-sm font-medium">{progressStatus || "Generating..."}</p>
              {progressTopic && <p className="mt-1 text-xs text-on-surface-variant">Current topic: {progressTopic}</p>}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-outline-variant/30">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">
                {progressTotal > 0
                  ? `Progress: ${progressIndex} / ${progressTotal}`
                  : "Preparing generation chunks..."}
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
          {generating && activeTab === "notes" && notesRerenderSimActive && (
            <div className="mt-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
              <p className="text-sm font-medium">{notesRerenderStatus}</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Personalizing your cached notes PDF for this account before delivery.
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-outline-variant/30">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${notesRerenderProgress}%` }} />
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">Finalization progress: {notesRerenderProgress}%</p>
              <p className="mt-1 text-xs text-on-surface-variant">⏱️ Elapsed Time: {formatElapsedTime(elapsedSeconds)}</p>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-error">⚠ {error}</p>}
        </section>

        {activeTab === "notes" ? (
          <section className="card border border-outline-variant/30 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Generation Process Timeline</h2>
              {notesTimelineSteps.length > 0 ? (
                <span className="text-xs text-on-surface-variant">Expand a step to view detailed logs.</span>
              ) : null}
            </div>
            {notesTimelineSteps.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                Start generation to see cache search, decision, rendering, and completion steps.
              </p>
            ) : (
              <div className="space-y-4">
                {notesTimelineSteps.map((step, index) => {
                  const visuals = getTimelineStepStyles(step.status);
                  return (
                    <div key={step.key} className="relative pl-8">
                      {index < notesTimelineSteps.length - 1 ? (
                        <span className="absolute left-[11px] top-6 h-[calc(100%+6px)] w-[2px] bg-outline-variant/60" />
                      ) : null}
                      <span className={`absolute left-0 top-2 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-surface-container text-xs font-bold ${visuals.iconClass}`}>
                        {visuals.icon}
                      </span>
                      <div className="py-1">
                        <button
                          className="flex w-full items-start justify-between gap-3 text-left"
                          aria-expanded={step.expanded}
                          onClick={() => {
                            setNotesTimelineSteps((prev) =>
                              prev.map((entry) =>
                                entry.key === step.key ? { ...entry, expanded: !entry.expanded } : entry));
                          }}
                          type="button"
                        >
                          <div>
                            <p className="text-sm font-semibold">{step.title}</p>
                            <p className="mt-1 text-xs text-on-surface-variant">{step.detail}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${visuals.badgeClass}`}
                                title={`Step status: ${visuals.label}`}
                              >
                                {visuals.label}
                              </span>
                              <span className="text-[11px] text-on-surface-variant">{step.logs.length} log entries</span>
                            </div>
                          </div>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            aria-hidden="true"
                            className="mt-0.5 flex-shrink-0 text-on-surface-variant transition-transform"
                            style={{ transform: step.expanded ? "rotate(180deg)" : "rotate(0deg)" }}
                          >
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {step.expanded ? (
                          <div className="mt-2 space-y-2 pt-1">
                            <div className="flex justify-between">
                              <span className="text-xs text-on-surface-variant">Deep console output</span>
                              <button className="btn text-xs" onClick={() => void copyTimelineLogs(step)} type="button">
                                Copy step logs
                              </button>
                            </div>
                            <div className="max-h-44 overflow-auto px-1 py-1 text-xs">
                              {step.logs.length > 0 ? (
                                <pre className="whitespace-pre-wrap break-words text-on-surface-variant">{step.logs.join("\n")}</pre>
                              ) : (
                                <p className="text-on-surface-variant">No detailed logs for this step yet.</p>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
