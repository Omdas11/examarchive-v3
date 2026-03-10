"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import CustomSelect from "./CustomSelect";
import { useToast } from "./ToastContext";
import {
  uploadFileDirectly,
  MAX_UPLOAD_BYTES,
  type UploadProgress,
} from "@/lib/appwrite-client";
import { SYLLABUS_REGISTRY, getAllUniversities } from "@/data/syllabus-registry";
import type { SyllabusRegistryEntry } from "@/data/syllabus-registry";

type MessageState = { type: "success" | "error"; text: string } | null;

const MAX_MB = MAX_UPLOAD_BYTES / (1024 * 1024); // 20

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

/** Derive exam type from the last character of the paper code. */
function examTypeFromCode(code: string): string | undefined {
  const last = code.trim().toUpperCase().slice(-1);
  if (last === "T") return "Theory";
  if (last === "P") return "Practical";
  return undefined;
}

const KNOWN_UNIVERSITIES = getAllUniversities();
const universityOptions = KNOWN_UNIVERSITIES.map((u) => ({ value: u, label: u }));

export default function UploadForm() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [eta, setEta] = useState(0);
  const [message, setMessage] = useState<MessageState>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [university, setUniversity] = useState("");
  const [registryEntry, setRegistryEntry] = useState<SyllabusRegistryEntry | null>(null);
  const [derivedExamType, setDerivedExamType] = useState<string | undefined>(undefined);
  const [noRegistryMatch, setNoRegistryMatch] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const router = useRouter();
  const { showToast } = useToast();

  /** When paper code changes, auto-resolve metadata from the registry. */
  const handlePaperCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const code = e.target.value.trim().toUpperCase();
      if (!code) {
        setRegistryEntry(null);
        setDerivedExamType(undefined);
        setNoRegistryMatch(false);
        return;
      }
      // Derive exam type from the paper code suffix regardless of registry match
      setDerivedExamType(examTypeFromCode(code));
      const entry = SYLLABUS_REGISTRY.find((r) => {
        const codeMatch = r.paper_code.toUpperCase() === code;
        if (!codeMatch) return false;
        if (university) return r.university.toLowerCase() === university.toLowerCase();
        return true;
      });
      if (entry) {
        setRegistryEntry(entry);
        setNoRegistryMatch(false);
      } else {
        setRegistryEntry(null);
        setNoRegistryMatch(true);
      }
    },
    [university],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const formEl = e.currentTarget;
    const data = new FormData(formEl);

    const paperCode = (data.get("paper_code") as string).trim().toUpperCase();
    const year = data.get("year") as string;
    const file = data.get("file") as File | null;

    if (file && file.size > MAX_UPLOAD_BYTES) {
      setMessage({
        type: "error",
        text: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_MB} MB.`,
      });
      return;
    }

    if (!university) {
      setMessage({ type: "error", text: "Please select a university." });
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
          file_name: file.name,
          paper_code: paperCode,
          university: university || undefined,
          year,
        }),
      });

      const metaJson = await metaRes.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!metaRes.ok || !metaJson?.success) {
        throw new Error(metaJson?.error ?? "Failed to save paper metadata");
      }

      setMessage({ type: "success", text: "Upload successful — awaiting admin approval." });
      setFileName("");
      setUniversity("");
      setRegistryEntry(null);
      setDerivedExamType(undefined);
      setNoRegistryMatch(false);
      formRef.current?.reset();

      // Show success toast and redirect to profile
      showToast("Upload successful! Redirecting to your profile…", "success");
      setTimeout(() => router.push("/profile"), 1500);
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
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Enter the university, paper code, and exam year. All other metadata (paper name, semester, department, paper type) is auto-resolved from the syllabus registry. The paper code suffix determines exam type: <strong>T</strong> = Theory, <strong>P</strong> = Practical.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* University */}
          <CustomSelect
            name="university"
            options={universityOptions}
            placeholder="University"
            value={university}
            onChange={(v) => { setUniversity(v); setRegistryEntry(null); setNoRegistryMatch(false); }}
            className="sm:col-span-2"
          />
          {/* Paper Code — triggers registry auto-resolve */}
          <input
            name="paper_code"
            placeholder="Paper Code (e.g. PHYDSC101T)"
            required
            className="input-field"
            onChange={handlePaperCodeChange}
          />
          {/* Year */}
          <input
            name="year"
            type="number"
            placeholder="Exam Year (e.g. 2024)"
            required
            className="input-field"
          />
        </div>

        {/* Registry match panel */}
        {registryEntry && (
          <div
            className="mt-4 rounded-lg p-4 text-sm space-y-1"
            style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-primary)" }}
          >
            <p className="font-semibold" style={{ color: "var(--color-primary)" }}>
              ✓ Registry match found — metadata auto-resolved
            </p>
            <p style={{ color: "var(--color-text-muted)" }}>
              <span className="font-medium">Paper:</span> {registryEntry.paper_name}
            </p>
            <p style={{ color: "var(--color-text-muted)" }}>
              <span className="font-medium">Department:</span> {registryEntry.subject} &nbsp;|&nbsp;
              <span className="font-medium">Semester:</span> {registryEntry.semester} &nbsp;|&nbsp;
              <span className="font-medium">Category:</span> {registryEntry.category ?? "—"} &nbsp;|&nbsp;
              <span className="font-medium">Programme:</span> {registryEntry.programme}
            </p>
            {derivedExamType && (
              <p style={{ color: "var(--color-text-muted)" }}>
                <span className="font-medium">Exam Type:</span> {derivedExamType} (from code suffix)
              </p>
            )}
          </div>
        )}
        {!registryEntry && derivedExamType && (
          <p className="mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Exam type auto-detected: <strong>{derivedExamType}</strong> (from code suffix).
            {noRegistryMatch && " Paper code not found in registry — other metadata cannot be auto-resolved."}
          </p>
        )}
        {noRegistryMatch && !derivedExamType && (
          <p className="mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
            ⚠ Paper code not found in registry. Metadata will not be auto-resolved — please verify the code.
          </p>
        )}
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
                const dt = new DataTransfer();
                dt.items.add(file);
                if (fileInputRef.current) {
                  fileInputRef.current.files = dt.files;
                }
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
            ref={fileInputRef}
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

