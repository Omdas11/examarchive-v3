"use client";

import { useEffect, useRef, useState } from "react";
import "katex/dist/katex.min.css";
import PrintableNotesDocument from "./PrintableNotesDocument";
import PrintInstructionsModal from "./PrintInstructionsModal";
import MarkdownNotesRenderer from "./MarkdownNotesRenderer";

const COURSE_TYPES: Record<string, string[]> = {
  FYUG: ["DSC", "DSM", "SEC", "AEC", "VAC", "IDC"],
  CBCS: ["DSC", "SEC"],
};
const UNIT_OPTIONS = [1, 2, 3, 4, 5];

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
  const [university] = useState("Assam University");
  const [course, setCourse] = useState("FYUG");
  const [type, setType] = useState("DSC");
  const [paperCode, setPaperCode] = useState("");
  const [unitNumber, setUnitNumber] = useState(1);
  const [paperCodeOptions, setPaperCodeOptions] = useState<string[]>([]);
  const [paperCodeLoading, setPaperCodeLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [model, setModel] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paperNameMap, setPaperNameMap] = useState<Record<string, string>>({});
  const [printInstructionsOpen, setPrintInstructionsOpen] = useState(false);
  const [generatedAtLabel, setGeneratedAtLabel] = useState("");
  const [progressStatus, setProgressStatus] = useState("");
  const [progressTopic, setProgressTopic] = useState("");
  const [progressIndex, setProgressIndex] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedPaperName = paperNameMap[paperCode] || paperCode;
  const progressPercent = progressTotal > 0 ? Math.min(100, Math.round((progressIndex / progressTotal) * 100)) : 0;

  function formatElapsedTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }

  function closeEventSource() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }

  async function generate() {
    if (generating) return;
    closeEventSource();
    setGenerating(true);
    setError(null);
    setProgressStatus("Starting chunked generation...");
    setProgressTopic("");
    setProgressIndex(0);
    setProgressTotal(0);
    startTimer();
    const params = new URLSearchParams({
      university,
      course,
      type,
      paperCode,
      unitNumber: String(unitNumber),
    });
    const source = new EventSource(`/api/generate-notes-stream?${params.toString()}`);
    eventSourceRef.current = source;
    let finished = false;

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
        setProgressTopic(typeof data.topic === "string" ? data.topic : "");
        setProgressIndex(typeof data.index === "number" ? data.index : 0);
        setProgressTotal(typeof data.total === "number" ? data.total : 0);
        return;
      }

      if (eventType === "done") {
        finished = true;
        setMarkdown(typeof data.markdown === "string" ? data.markdown : "");
        setGeneratedAtLabel(new Date().toLocaleString());
        setModel(typeof data.model === "string" ? data.model : "");
        if (typeof data.remaining === "number" || data.remaining === null) {
          setRemaining(data.remaining);
        }
        setGenerating(false);
        setProgressStatus("");
        setProgressTopic("");
        setProgressIndex(0);
        setProgressTotal(0);
        stopTimer();
        closeEventSource();
        return;
      }

      if (eventType === "error") {
        finished = true;
        setError(typeof data.error === "string" ? data.error : "Generation failed.");
        setGenerating(false);
        setProgressStatus("");
        setProgressTopic("");
        setProgressIndex(0);
        setProgressTotal(0);
        stopTimer();
        closeEventSource();
      }
    };

    source.onerror = () => {
      if (finished) return;
      setError("Network error. Please try again.");
      setGenerating(false);
      setProgressStatus("");
      setProgressTopic("");
      setProgressIndex(0);
      setProgressTotal(0);
      stopTimer();
      closeEventSource();
    };
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
      })
      .catch(() => {})
      .finally(() => setPaperCodeLoading(false));
  }, [university, course, type]);

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

  const canGenerate = generating ? false : remaining === null || remaining > 0;

  return (
    <div className="relative min-h-screen bg-surface px-4 py-8 text-on-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-outline-variant/30 bg-surface-container p-6 shadow-lift">
          <h1 className="text-3xl font-bold">AI Unit Notes Generation</h1>
          <p className="mt-2 text-on-surface-variant">
            Generate full unit notes from database-backed syllabus and question context.
          </p>
          <div className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {remaining === null ? "Quota: Unlimited" : `Remaining generations: ${remaining}${typeof limit === "number" ? ` / ${limit}` : ""}`}
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
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={generate}
              disabled={!paperCode.trim() || !canGenerate}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating ? (
                <>
                  Generating Unit Notes <LoadingDots />
                </>
              ) : (
                "Generate Unit Notes"
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
          <div className="print-root markdown-preview rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
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
        paperName={selectedPaperName}
        paperCode={paperCode}
        generatedAt={generatedAtLabel}
        model={model || "gemini-3.1-flash-lite-preview"}
      />
    </div>
  );
}
