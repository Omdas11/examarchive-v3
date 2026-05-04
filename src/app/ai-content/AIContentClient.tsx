"use client";

import { useEffect, useMemo, useState } from "react";
import "katex/dist/katex.min.css";
import { useToast } from "@/components/ToastContext";
import CustomDropdown, { type CustomDropdownOption } from "@/components/CustomDropdown";
import { ELECTRON_SYMBOL, GENERATION_COST_ELECTRONS } from "@/lib/economy";
import { dispatchProfileRefreshEvent } from "@/lib/profile-events";

const COURSE_TYPES: Record<string, string[]> = {
  FYUG: ["DSC", "DSM", "SEC", "AEC", "VAC", "IDC"],
};
const STREAM_TYPES: Record<string, string[]> = {
  Arts: ["DSC", "DSM", "SEC", "AEC", "VAC", "IDC"],
  Science: ["DSC", "DSM", "SEC", "AEC", "VAC", "IDC"],
  Commerce: ["DSC", "DSM", "SEC", "AEC", "VAC", "IDC"],
};
const UNIT_OPTIONS = [1, 2, 3, 4, 5];
const GENERATION_REQUEST_TIMEOUT_MS = 60_000;
const MODEL_OPTIONS: CustomDropdownOption[] = [
  { label: "Gemini 3.1 Flash Lite", value: "gemini-3.1-flash-lite" },
  { label: "Gemma 4 31B", value: "gemma-4-31b" },
];

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
  const [model, setModel] = useState("gemini-3.1-flash-lite");
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
  const [namesByPaperCode, setNamesByPaperCode] = useState<Record<string, string>>({});
  const [paperCodeLoading, setPaperCodeLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [notesRemaining, setNotesRemaining] = useState<number | null>(null);
  const [papersRemaining, setPapersRemaining] = useState<number | null>(null);
  const [notesDailyLimit, setNotesDailyLimit] = useState<number | null>(null);
  const [papersDailyLimit, setPapersDailyLimit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const hasPaperCode = paperCode.trim().length > 0;
  const availableUnits = useMemo(() => {
    const units = unitsByPaperCode[paperCode];
    return Array.isArray(units) && units.length > 0 ? units : (hasPaperCode ? [] : UNIT_OPTIONS);
  }, [unitsByPaperCode, paperCode, hasPaperCode]);
  const availableYears = useMemo(() => yearsByPaperCode[paperCode] || [], [yearsByPaperCode, paperCode]);
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
    () =>
      visiblePaperCodes.map((code) => {
        const name = namesByPaperCode[code];
        const label = name && name !== code ? `${code} — ${name}` : code;
        return { label, value: code };
      }),
    [visiblePaperCodes, namesByPaperCode],
  );
  const unitOptions: CustomDropdownOption[] = useMemo(
    () => availableUnits.map((unit) => ({ label: String(unit), value: String(unit) })),
    [availableUnits],
  );
  const yearOptions: CustomDropdownOption[] = useMemo(
    () => availableYears.map((year) => ({ label: String(year), value: String(year) })),
    [availableYears],
  );
  // Semester options always use the full global list so the dropdown never
  // flickers when the selected paper code changes.
  const semesterOptions: CustomDropdownOption[] = useMemo(
    () => availableSemesters.map((entry) => ({ label: `Semester ${entry}`, value: String(entry) })),
    [availableSemesters],
  );
  function getQuotaSummaryLabel(): string {
    // Prefer strict per-feature quotas when available; fallback to legacy aggregate quota response.
    if (notesDailyLimit !== null && papersDailyLimit !== null) {
      return `Daily Limit: ${notesUsedToday ?? 0}/${notesDailyLimit} Notes | ${papersUsedToday ?? 0}/${papersDailyLimit} Solved Papers`;
    }
    if (remaining === null) return "Quota: Unlimited";
    return `Remaining generations: ${remaining}${typeof limit === "number" ? ` / ${limit}` : ""}`;
  }

  async function generate() {
    if (generating) return;
    setError(null);
    setGenerationStatus({
      tone: "info",
      message: "Submitting your generation request. Please wait…",
    });
    setGenerating(true);

    const body =
      activeTab === "notes"
        ? {
            jobType: "notes",
            university,
            course,
            stream,
            type,
            paperCode,
            unitNumber,
            semester: semester === "" ? null : semester,
            model,
          }
        : {
            jobType: "solved-paper",
            university,
            course,
            stream,
            type,
            paperCode,
            year: selectedYear === "" ? null : selectedYear,
            semester: semester === "" ? null : semester,
            model,
          };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), GENERATION_REQUEST_TIMEOUT_MS);
      const response = await fetch("/api/ai/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      let data: { ok?: boolean; message?: string; error?: string };
      try {
        data = await response.json();
      } catch {
        data = {};
      }
      if (!response.ok) {
        const failureMessage = typeof data?.error === "string" ? data.error : "Failed to start generation.";
        setError(failureMessage);
        setGenerationStatus({ tone: "error", message: failureMessage });
      } else {
        const successMessage = typeof data.message === "string" && data.message
          ? data.message
          : "Your PDF is being generated. We'll email it to you when ready.";
        dispatchProfileRefreshEvent();
        setGenerationStatus({
          tone: "success",
          message: "Generation started successfully. A confirmation email has been sent, and you will receive another email when generation succeeds or fails.",
        });
        showToast(successMessage, "success");
      }
    } catch (err) {
      const failureMessage = err instanceof DOMException && err.name === "AbortError"
        ? "Request timed out while starting generation. Please try again."
        : (err instanceof Error ? err.message : "Network error. Please try again.");
      setError(failureMessage);
      setGenerationStatus({ tone: "error", message: failureMessage });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setGenerating(false);
    }
  }

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
        if (Array.isArray(data.papers)) {
          const map: Record<string, string> = {};
          for (const item of data.papers as unknown[]) {
            if (item && typeof item === "object") {
              const { code, name } = item as { code?: unknown; name?: unknown };
              if (typeof code === "string" && typeof name === "string" && name && name !== code) {
                map[code] = name;
              }
            }
          }
          setNamesByPaperCode(map);
        } else {
          setNamesByPaperCode({});
        }
      })
      .catch(() => {
        setNotesPaperCodes([]);
        setPapersPaperCodes([]);
        setUnitsByPaperCode({});
        setPaperCode("");
        setYearsByPaperCode({});
        setSemestersByPaperCode({});
        setNamesByPaperCode({});
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
    if (availableSemesters.length === 0) {
      setSemester("");
      return;
    }
    setSemester((current) => {
      if (typeof current === "number" && availableSemesters.includes(current)) return current;
      return availableSemesters[0] ?? "";
    });
  }, [availableSemesters]);

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

  return (
    <div className="relative min-h-screen bg-surface px-4 py-8 text-on-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-outline-variant/30 bg-surface-container p-6 shadow-lift">
          <h1 className="text-3xl font-bold">AI Content Generation</h1>
          <p className="mt-2 text-on-surface-variant">
            Generate full unit notes or solved papers from database-backed syllabus and question context.
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Each generation costs {GENERATION_COST_ELECTRONS}{ELECTRON_SYMBOL}.
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
              <label className="mb-1 block text-sm font-semibold">AI Model</label>
              <CustomDropdown options={MODEL_OPTIONS} value={model} onChange={setModel} disabled={generating} />
              <p className="mt-2 text-xs text-on-surface/70">
                Tip: choose Gemma 4 31B for high-throughput generation.
              </p>
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
                <button
                  onClick={() => void generate()}
                  disabled={isGenerationDisabled}
                  aria-busy={generating}
                  aria-live="polite"
                  className="btn-primary relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:content-[''] hover:before:animate-[shimmer_1.4s_ease-in-out_infinite] disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                >
                  {generating ? (<>Starting generation...<LoadingDots /></>) : "Generate Unit Notes"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {!hasAvailableYearsForPaper && hasPaperCode ? (
                  <div className="w-full rounded-xl border border-outline-variant/40 bg-surface-container px-4 py-3 text-sm text-on-surface-variant opacity-70">
                    Solved paper generation is unavailable for this paper code because no questions are ingested yet.
                  </div>
                ) : (
                  <button
                    onClick={() => void generate()}
                    disabled={isGenerationDisabled}
                    aria-busy={generating}
                    aria-live="polite"
                     className="btn-primary relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:content-[''] hover:before:animate-[shimmer_1.4s_ease-in-out_infinite] disabled:cursor-not-allowed disabled:opacity-60"
                     type="button"
                   >
                     {generating ? (<>Starting generation...<LoadingDots /></>) : "Generate Solved Paper"}
                   </button>
                 )}
               </div>
             )}
           </div>
          {generationStatus ? (
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={`mt-3 text-sm ${
                generationStatus.tone === "success"
                  ? "text-green-700"
                  : generationStatus.tone === "error"
                    ? "text-error"
                    : "text-on-surface-variant"
              }`}
            >
              {generationStatus.message}
            </p>
          ) : null}
          {error && generationStatus?.tone !== "error" ? <p className="mt-3 text-sm text-error">⚠ {error}</p> : null}
        </section>
      </div>
    </div>
  );
}
