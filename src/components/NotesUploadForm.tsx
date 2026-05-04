"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./ToastContext";
import {
  uploadNotesFileDirectly,
  MAX_UPLOAD_BYTES,
  type UploadProgress,
} from "@/lib/appwrite-client";
import { dispatchProfileRefreshEvent } from "@/lib/profile-events";

type MessageState = { type: "success" | "error"; text: string } | null;

const MAX_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

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

export default function NotesUploadForm() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [eta, setEta] = useState(0);
  const [message, setMessage] = useState<MessageState>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  // Clear any pending redirect timer when the component unmounts.
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (file.size > MAX_UPLOAD_BYTES) {
        setMessage({ type: "error", text: `File too large. Max ${MAX_MB} MB.` });
        setFileName("");
        return;
      }
      setMessage(null);
      setFileName(file.name);
    },
    [],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const formEl = e.currentTarget;
    const data = new FormData(formEl);

    const title = (data.get("title") as string).trim();
    const file = data.get("file") as File | null;

    if (!title) {
      setMessage({ type: "error", text: "Please enter a title for the notes." });
      return;
    }

    if (!file || file.size === 0) {
      setMessage({ type: "error", text: "Please select a PDF file to upload." });
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage({
        type: "error",
        text: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_MB} MB.`,
      });
      return;
    }

    setLoading(true);
    setProgress(0);
    setUploadSpeed(0);
    setEta(0);
    startTimeRef.current = Date.now();

    try {
      const tokenRes = await fetch("/api/upload/token");
      const tokenJson = await tokenRes.json().catch(() => null) as { jwt?: string; userId?: string; error?: string } | null;
      if (!tokenRes.ok || !tokenJson?.jwt || !tokenJson?.userId) {
        throw new Error(tokenJson?.error ?? "Failed to get upload token");
      }
      const { jwt, userId } = tokenJson;

      const fileId = await uploadNotesFileDirectly(jwt, file, userId, (evt: UploadProgress) => {
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

      const metaRes = await fetch("/api/upload/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId,
          title,
          file_name: file.name,
        }),
      });

      const metaJson = await metaRes.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!metaRes.ok || !metaJson?.success) {
        throw new Error(metaJson?.error ?? "Failed to save notes metadata");
      }

      setMessage({ type: "success", text: "Upload successful — awaiting admin approval." });
      setFileName("");
      formRef.current?.reset();

      dispatchProfileRefreshEvent();
      showToast("Notes uploaded! Redirecting to your profile…", "success");
      redirectTimerRef.current = setTimeout(() => {
        router.push("/profile");
        router.refresh();
      }, 1500);
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
          Step 1: Notes Details
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Enter a descriptive title for your handmade notes (e.g. &ldquo;PHYDSC101T Unit 2 Handwritten Notes&rdquo;).
        </p>
        <input
          name="title"
          placeholder="Notes Title (e.g. PHYDSC101T Unit 2 Notes)"
          required
          className="input-field w-full"
        />
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
              handleFileChange(file);
              const dt = new DataTransfer();
              dt.items.add(file);
              if (fileInputRef.current) fileInputRef.current.files = dt.files;
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
            PDF only · Maximum file size: {MAX_MB} MB
          </p>
          <input
            ref={fileInputRef}
            name="file"
            type="file"
            accept=".pdf"
            required
            className="sr-only"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
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
          {loading ? `Uploading… ${progress}%` : "Upload Notes"}
        </button>
        <p className="mt-2 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
          Your notes will be reviewed by an admin before publishing.
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
