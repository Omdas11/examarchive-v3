"use client";

import { useState, useRef } from "react";
import CustomSelect from "./CustomSelect";

type MessageState = { type: "success" | "error"; text: string } | null;

const semesterOptions = [
  { value: "1st", label: "1st" },
  { value: "2nd", label: "2nd" },
  { value: "3rd", label: "3rd" },
  { value: "4th", label: "4th" },
  { value: "5th", label: "5th" },
  { value: "6th", label: "6th" },
];

const examTypeOptions = [
  { value: "Midterm", label: "Midterm" },
  { value: "Final", label: "Final" },
  { value: "Quiz", label: "Quiz" },
];

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

function formatBytes(bps: number): string {
  if (bps > 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
  if (bps > 1_000) return `${(bps / 1_000).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
}

export default function UploadForm() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0–100
  const [uploadSpeed, setUploadSpeed] = useState(0); // bytes/s
  const [eta, setEta] = useState(0); // seconds remaining
  const [message, setMessage] = useState<MessageState>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [semester, setSemester] = useState("");
  const [examType, setExamType] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const startTimeRef = useRef<number>(0);
  const lastLoadedRef = useRef<number>(0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setProgress(0);
    setUploadSpeed(0);
    setEta(0);
    setMessage(null);

    const form = new FormData(e.currentTarget);

    const xhr = new XMLHttpRequest();
    startTimeRef.current = Date.now();
    lastLoadedRef.current = 0;

    xhr.upload.addEventListener("progress", (ev) => {
      if (!ev.lengthComputable) return;
      const pct = Math.round((ev.loaded / ev.total) * 100);
      setProgress(pct);

      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      if (elapsed > 0) {
        const bps = ev.loaded / elapsed;
        setUploadSpeed(bps);
        const remaining = ev.total - ev.loaded;
        setEta(bps > 0 ? remaining / bps : 0);
      }
    });

    xhr.addEventListener("load", () => {
      setLoading(false);
      setProgress(100);
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && json.success) {
          setMessage({ type: "success", text: "Upload successful — awaiting admin approval." });
          setFileName("");
          setSemester("");
          setExamType("");
          formRef.current?.reset();
        } else {
          setMessage({ type: "error", text: json.error ?? "Upload failed" });
        }
      } catch {
        setMessage({ type: "error", text: `Server error (status ${xhr.status})` });
      }
    });

    xhr.addEventListener("error", () => {
      setLoading(false);
      setMessage({ type: "error", text: "Network error – please check your connection." });
    });

    xhr.addEventListener("abort", () => {
      setLoading(false);
      setMessage({ type: "error", text: "Upload was cancelled." });
    });

    xhr.open("POST", "/api/upload");
    xhr.send(form);
  }

  // Button color: transitions from red (0%) → amber (50%) → green (100%)
  const btnColor = progress === 0 || !loading
    ? "var(--color-primary)"
    : progress < 50
    ? lerpColor("#d32f2f", "#f59e0b", progress / 50)
    : lerpColor("#f59e0b", "#16a34a", (progress - 50) / 50);

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1: Paper details */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
          Step 1: Paper Details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="title" placeholder="Subject / Paper Name" required className="input-field" />
          <input name="course_code" placeholder="Paper Code" required className="input-field" />
          <input name="course_name" placeholder="Course Name" required className="input-field" />
          <input name="department" placeholder="Stream / Department" required className="input-field" />
          <input name="year" type="number" placeholder="Year" required className="input-field" />

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

      {/* Step 2: Upload PDF */}
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
            if (file) setFileName(file.name);
          }}
        >
          <svg className="h-10 w-10 mb-2 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
          </svg>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {fileName || "Drag & drop a PDF here or click to browse"}
          </p>
          <input
            name="file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            required
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setFileName(file.name);
            }}
          />
        </label>
      </div>

      {/* Step 3: Submit */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
          Step 3: Submit
        </h3>

        {/* Progress bar */}
        {loading && (
          <div className="mb-3 space-y-1">
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: "var(--color-border)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: btnColor }}
              />
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
          style={{
            background: btnColor,
            borderColor: btnColor,
          }}
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
          style={{
            color: message.type === "success" ? "#16a34a" : "var(--color-primary)",
          }}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}

