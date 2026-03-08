"use client";

import { useState, useRef } from "react";
import CustomSelect from "./CustomSelect";
import {
  uploadSyllabusFileDirectly,
  MAX_UPLOAD_BYTES,
  type UploadProgress,
} from "@/lib/appwrite-client";

type MessageState = { type: "success" | "error"; text: string } | null;

const MAX_MB = MAX_UPLOAD_BYTES / (1024 * 1024); // 20

const programmeOptions = [
  { value: "FYUG", label: "FYUG (NEP 2020)" },
  { value: "CBCS", label: "CBCS" },
  { value: "Other", label: "Other" },
];

export default function DeptSyllabusUploadForm() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<MessageState>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [programme, setProgramme] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const formEl = e.currentTarget;
    const data = new FormData(formEl);

    const university = (data.get("university") as string).trim();
    const department = (data.get("department") as string).trim();
    const year = (data.get("year") as string).trim();
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

    try {
      const tokenRes = await fetch("/api/upload/token");
      const tokenJson = await tokenRes.json().catch(() => null) as { jwt?: string; error?: string } | null;
      if (!tokenRes.ok || !tokenJson?.jwt) {
        throw new Error(tokenJson?.error ?? "Failed to get upload token");
      }
      const { jwt } = tokenJson;

      const fileId = await uploadSyllabusFileDirectly(jwt, file, (evt: UploadProgress) => {
        setProgress(evt.progress);
      });

      setProgress(100);

      const metaRes = await fetch("/api/upload/syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId,
          university,
          // subject reuses the department/subject field for departmental uploads
          subject: department,
          department,
          // No semester — departmental syllabi cover all semesters
          semester: "",
          programme: programme || undefined,
          year,
        }),
      });

      const metaJson = await metaRes.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!metaRes.ok || !metaJson?.success) {
        throw new Error(metaJson?.error ?? "Failed to save syllabus metadata");
      }

      setMessage({
        type: "success",
        text: "Departmental Syllabus uploaded — awaiting admin approval.",
      });
      setFileName("");
      setProgramme("");
      formRef.current?.reset();
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-muted)" }}>
          Step 1: Syllabus Details
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Upload a full departmental syllabus covering all semesters (e.g. Physics FYUG Full Syllabus).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            name="university"
            placeholder="University / Institution"
            required
            className="input-field sm:col-span-2"
          />
          <CustomSelect
            name="programme"
            options={programmeOptions}
            placeholder="Programme (e.g. FYUG, CBCS)"
            value={programme}
            onChange={setProgramme}
          />
          <input
            name="department"
            placeholder="Department / Subject (e.g. Physics)"
            required
            className="input-field"
          />
          <input
            name="year"
            type="number"
            placeholder="Syllabus Year (e.g. 2024)"
            required
            className="input-field"
          />
        </div>
        <p className="mt-3 text-xs px-1" style={{ color: "var(--color-text-muted)" }}>
          This upload covers the <strong>complete syllabus</strong> for all semesters. For a single-semester syllabus, use the &ldquo;Syllabus&rdquo; upload type.
        </p>
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
            accept=".pdf"
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
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: "var(--color-primary)" }}
              />
            </div>
            <div className="flex items-center justify-between text-xs" style={{ color: "var(--color-text-muted)" }}>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? `Uploading… ${progress}%` : "Upload Departmental Syllabus"}
        </button>
        <p className="mt-2 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
          Your syllabus will be reviewed by an admin before publishing.
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
