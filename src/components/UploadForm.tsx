"use client";

import { useState } from "react";

export default function UploadForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");

      setMessage("Paper uploaded successfully — pending approval.");
      setFileName("");
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
          <select name="semester" required className="input-field">
            <option value="">Semester</option>
            <option value="1st">1st</option>
            <option value="2nd">2nd</option>
            <option value="3rd">3rd</option>
            <option value="4th">4th</option>
            <option value="5th">5th</option>
            <option value="6th">6th</option>
          </select>
          <select name="exam_type" required className="input-field">
            <option value="">Exam Type</option>
            <option value="Midterm">Midterm</option>
            <option value="Final">Final</option>
            <option value="Quiz">Quiz</option>
          </select>
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
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
          {loading ? "Uploading…" : "Upload Paper"}
        </button>
        <p className="mt-2 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
          Your upload will be reviewed by an admin before publishing.
        </p>
      </div>

      {message && (
        <p className="text-sm text-center" style={{ color: "var(--color-primary)" }}>{message}</p>
      )}
    </form>
  );
}
