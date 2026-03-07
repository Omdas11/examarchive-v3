"use client";

import { useState, useRef, useCallback } from "react";
import CustomSelect from "./CustomSelect";
import {
  uploadFileDirectly,
  MAX_UPLOAD_BYTES,
  type UploadProgress,
} from "@/lib/appwrite-client";
import { SYLLABUS_REGISTRY } from "@/data/syllabus-registry";

type MessageState = { type: "success" | "error"; text: string } | null;

const MAX_MB = MAX_UPLOAD_BYTES / (1024 * 1024); // 20

const semesterOptions = [
  { value: "1st", label: "1st Semester" },
  { value: "2nd", label: "2nd Semester" },
  { value: "3rd", label: "3rd Semester" },
  { value: "4th", label: "4th Semester" },
  { value: "5th", label: "5th Semester" },
  { value: "6th", label: "6th Semester" },
  { value: "7th", label: "7th Semester" },
  { value: "8th", label: "8th Semester" },
];

const examTypeOptions = [
  { value: "Theory", label: "Theory" },
  { value: "Practical", label: "Practical" },
];

const programmeOptions = [
  { value: "FYUGP", label: "FYUGP (NEP 2020)" },
  { value: "CBCS", label: "CBCS" },
  { value: "Other", label: "Other" },
];

/** Paper type options keyed by programme. */
const PAPER_TYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  FYUGP: [
    { value: "DSC", label: "DSC — Discipline Specific Core" },
    { value: "DSM", label: "DSM — Discipline Specific Minor" },
    { value: "SEC", label: "SEC — Skill Enhancement Course" },
    { value: "IDC", label: "IDC — Interdisciplinary Course" },
    { value: "GE",  label: "GE — Generic Elective" },
  ],
  CBCS: [
    { value: "CC",  label: "CC — Core Course (Honours)" },
    { value: "DSC", label: "DSC — Discipline Specific Core" },
    { value: "DSE", label: "DSE — Discipline Specific Elective" },
    { value: "GEC", label: "GEC — Generic Elective Course" },
    { value: "SEC", label: "SEC — Skill Enhancement Course" },
  ],
};

/** Interpolate between two hex colors by fraction 0..1. */
function lerpColor(from: string, to: string, t: number): string {
  const f = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [fr, fg, fb] = f(from);
  const [tr, tg, tb] = f(to);
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  return `rgb(${r},${g},${b})`;
}

function formatBytes(bytes: number): string {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB/s`;
  if (bytes > 1_000) return `${(bytes / 1_000).toFixed(0)} KB/s`;
  return `${bytes.toFixed(0)} B/s`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
}

export default function UploadForm() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [eta, setEta] = useState(0);
  const [message, setMessage] = useState<MessageState>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [semester, setSemester] = useState("");
  const [examType, setExamType] = useState("");
  const [programme, setProgramme] = useState("");
  const [paperType, setPaperType] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const startTimeRef = useRef<number>(0);

  /** When the paper code changes, try to auto-fill from the registry. */
  const handlePaperCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const code = e.target.value.trim().toUpperCase();
      if (!code) return;
      const entry = SYLLABUS_REGISTRY.find(
        (r) => r.paper_code.toUpperCase() === code,
      );
      if (!entry) return;
      // Auto-fill programme if blank
      if (!programme && entry.programme) setProgramme(entry.programme);
      // Auto-fill paper type if blank
      if (!paperType && entry.category) setPaperType(entry.category);
      // Auto-fill semester
      if (!semester) {
        const n = entry.semester;
        const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
        setSemester(`${n}${suffix}`);
      }
    },
    [programme, paperType, semester],
  );

  const paperTypeOptions =
    PAPER_TYPE_OPTIONS[programme] ?? [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const formEl = e.currentTarget;
    const data = new FormData(formEl);

    const title = data.get("title") as string;
    const course_code = data.get("course_code") as string;
    const course_name = data.get("course_name") as string;
    const department = data.get("department") as string;
    const year = data.get("year") as string;
    const institution = data.get("institution") as string | null;
    const file = data.get("file") as File | null;

    if (file && file.size > MAX_UPLOAD_BYTES) {
      setMessage({
        type: "error",
        text: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_MB} MB.`,
      });
      return;
    }

    if (!file || file.size === 0) {
      setMessage({ type: "error", text: "Please select a file to upload." });
      return;
    }

    setLoading(true);
    setProgress(0);
    setUploadSpeed(0);
    setEta(0);
    startTimeRef.current = Date.now();

    try {
      const tokenRes = await fetch("/api/upload/token");
      const tokenJson = await tokenRes.json().catch(() => null) as { jwt?: string; error?: string } | null;
      if (!tokenRes.ok || !tokenJson?.jwt) {
        throw new Error(tokenJson?.error ?? "Failed to get upload token");
      }
      const { jwt } = tokenJson;

      const fileId = await uploadFileDirectly(jwt, file, (evt: UploadProgress) => {
        setProgress(evt.progress);
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        if (elapsed > 0 && evt.loaded > 0) {
          const bps = evt.loaded / elapsed;
          setUploadSpeed(bps);
          const remaining = evt.total - evt.loaded;
          setEta(bps > 0 ? remaining / bps : 0);
        }
      });

      setProgress(100);

      const metaRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId,
          title,
          course_code,
          course_name,
          department,
          year,
          semester,
          exam_type: examType,
          institution: institution || undefined,
          programme: programme || undefined,
          paper_type: paperType || undefined,
        }),
      });

      const metaJson = await metaRes.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!metaRes.ok || !metaJson?.success) {
        throw new Error(metaJson?.error ?? "Failed to save paper metadata");
      }

      setMessage({ type: "success", text: "Upload successful — awaiting admin approval." });
      setFileName("");
      setSemester("");
      setExamType("");
      setProgramme("");
      setPaperType("");
      formRef.current?.reset();
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  }

  const btnColor = progress === 0 || !loading
    ? "var(--color-primary)"
    : progress < 50
    ? lerpColor("#d32f2f", "#f59e0b", progress / 50)
    : lerpColor("#f59e0b", "#16a34a", (progress - 50) / 50);

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
          Step 1: Paper Details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            name="institution"
            placeholder="University / Institution"
            className="input-field sm:col-span-2"
          />
          <CustomSelect
            name="programme"
            options={programmeOptions}
            placeholder="Programme"
            value={programme}
            onChange={(v) => { setProgramme(v); setPaperType(""); }}
          />
          {/* Paper Type — shown when programme is FYUGP or CBCS */}
          {paperTypeOptions.length > 0 ? (
            <CustomSelect
              name="paper_type"
              options={paperTypeOptions}
              placeholder="Paper Type (e.g. DSC)"
              value={paperType}
              onChange={setPaperType}
            />
          ) : (
            <input
              name="paper_type"
              placeholder="Paper Type (e.g. DSC, CC)"
              className="input-field"
              value={paperType}
              onChange={(e) => setPaperType(e.target.value)}
            />
          )}
          <input name="department" placeholder="Department / Stream" required className="input-field" />
          <input
            name="course_code"
            placeholder="Paper Code (e.g. PHYDSC101T)"
            required
            className="input-field"
            onChange={handlePaperCodeChange}
          />
          <input name="course_name" placeholder="Course Name" required className="input-field" />
          <input name="title" placeholder="Subject / Paper Name" required className="input-field sm:col-span-2" />
          <input name="year" type="number" placeholder="Year (e.g. 2024)" required className="input-field" />
          <CustomSelect
            name="semester"
            options={semesterOptions}
            placeholder="Semester"
            required
            value={semester}
            onChange={setSemester}
          />
          <CustomSelect
            name="exam_type"
            options={examTypeOptions}
            placeholder="Exam Type"
            required
            value={examType}
            onChange={setExamType}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
          Step 2: Upload PDF
        </h3>
        <label
          className="card flex cursor-pointer flex-col items-center justify-center p-8 text-center transition-colors"
          style={{
            borderStyle: "dashed",
            borderWidth: "2px",
            background: dragOver ? "var(--color-accent-soft)" : undefined,
          }}
          onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) {
              if (file.size > MAX_UPLOAD_BYTES) {
                setMessage({ type: "error", text: `File too large. Max ${MAX_MB} MB.` });
              } else {
                setMessage(null);
                setFileName(file.name);
              }
            }
          }}
        >
          <svg className="h-10 w-10 mb-2 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
          </svg>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {fileName || "Drag & drop a PDF here or click to browse"}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Maximum file size: {MAX_MB} MB
          </p>
          <input
            name="file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            required
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > MAX_UPLOAD_BYTES) {
                  setMessage({ type: "error", text: `File too large. Max ${MAX_MB} MB.` });
                  e.target.value = "";
                  setFileName("");
                } else {
                  setMessage(null);
                  setFileName(file.name);
                }
              }
            }}
          />
        </label>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
          Step 3: Submit
        </h3>

        {loading && (
          <div className="mb-3 space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--color-border)" }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: btnColor }} />
            </div>
            <div className="flex items-center justify-between text-xs" style={{ color: "var(--color-text-muted)" }}>
              <span>{progress}%</span>
              <span>
                {uploadSpeed > 0 && `${formatBytes(uploadSpeed)}`}
                {eta > 0 && ` · ${formatTime(eta)} left`}
              </span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50 transition-colors duration-300"
          style={{ background: btnColor, borderColor: btnColor }}
        >
          {loading ? `Uploading… ${progress}%` : "Upload Paper"}
        </button>
        <p className="mt-2 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
          Your upload will be reviewed by an admin before publishing.
        </p>
      </div>

      {message && (
        <p
          className="text-sm text-center font-medium"
          style={{ color: message.type === "success" ? "#16a34a" : "var(--color-primary)" }}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
