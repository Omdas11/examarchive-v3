"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type IngestionError = { line: number; message: string };
type IngestionLog = {
  id: string;
  timestamp: string;
  fileName: string;
  paperCode: string;
  status: "success" | "partial" | "failed" | string;
  rowsAffected: number;
  errors: IngestionError[];
};

export default function IngestMdClient() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<IngestionLog[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [pollDelayMs, setPollDelayMs] = useState(10_000);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ingest-md", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.logs)) {
        setLogs(data.logs as IngestionLog[]);
      }
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let timeoutId: number | null = null;
    const schedule = async () => {
      await loadLogs();
      if (disposed) return;
      timeoutId = window.setTimeout(schedule, pollDelayMs);
    };
    void schedule();
    return () => {
      disposed = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [loadLogs, pollDelayMs]);

  async function ingestFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".md")) {
      setError("Only .md files are allowed.");
      return;
    }
    setUploading(true);
    setPollDelayMs(2_500);
    setError(null);
    setLastResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/admin/ingest-md", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        const fallbackErrors = Array.isArray(data.errors)
          ? data.errors
              .map((entry: unknown) =>
                typeof entry === "object" && entry !== null && "message" in entry
                  ? String((entry as { message?: unknown }).message ?? "")
                  : "",
              )
              .filter(Boolean)
          : [];
        setError(data.error ?? fallbackErrors.join("; ") || "Upload/ingestion failed.");
      } else {
        setLastResult(
          `${String(data.status).toUpperCase()} · Added ${data.added}, Updated ${data.updated}, Rows ${data.rowsAffected}`,
        );
      }
      await loadLogs();
    } catch {
      setError("Network error while uploading file.");
    } finally {
      setUploading(false);
      setPollDelayMs(10_000);
    }
  }

  const statusClass = useMemo(
    () => ({
      success: "text-green-600",
      partial: "text-amber-600",
      failed: "text-red-600",
    }),
    [],
  );

  function getStatusClass(status: string): string {
    return statusClass[status as keyof typeof statusClass] ?? "text-on-surface";
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border border-outline-variant/40 bg-surface p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          <a href="/api/admin/ingest-md?template=1" className="btn">
            Download Template
          </a>
          <a href="/DEMO_DATA_ENTRY.md" className="btn">
            View Template
          </a>
        </div>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void ingestFile(file);
          }}
          className={`block cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragActive ? "border-primary bg-primary/10" : "border-outline-variant/40 bg-surface-container-low"
          }`}
        >
          <input
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void ingestFile(file);
            }}
          />
          <p className="text-sm font-semibold">Drag & drop a Markdown file or click to choose one</p>
          <p className="mt-1 text-xs text-on-surface-variant">Only `.md` files using the strict template are accepted.</p>
          {uploading && <p className="mt-3 text-sm text-primary">Processing ingestion…</p>}
        </label>
        {error && <p className="mt-3 text-sm text-error">⚠ {error}</p>}
        {lastResult && <p className="mt-3 text-sm text-on-surface-variant">{lastResult}</p>}
      </section>

      <section className="rounded-xl border border-outline-variant/40 bg-surface p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Ingestion Log Dashboard</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                <th className="py-2 pr-2">Timestamp</th>
                <th className="py-2 pr-2">File Name</th>
                <th className="py-2 pr-2">Paper Code</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Rows Affected</th>
                <th className="py-2 pr-2">Expand</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr className="border-b border-outline-variant/20">
                    <td className="py-2 pr-2">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-2 pr-2">{log.fileName}</td>
                    <td className="py-2 pr-2">{log.paperCode || "—"}</td>
                    <td className={`py-2 pr-2 font-semibold ${getStatusClass(log.status)}`}>
                      {log.status.toUpperCase()}
                    </td>
                    <td className="py-2 pr-2">{log.rowsAffected}</td>
                    <td className="py-2 pr-2">
                      <button
                        className="btn text-xs"
                        onClick={() => setExpanded((prev) => ({ ...prev, [log.id]: !prev[log.id] }))}
                      >
                        {expanded[log.id] ? "Hide" : "Expand"}
                      </button>
                    </td>
                  </tr>
                  {expanded[log.id] && (
                    <tr key={`${log.id}-errors`} className="border-b border-outline-variant/20">
                      <td colSpan={6} className="py-2">
                        {log.errors.length === 0 ? (
                          <p className="text-xs text-on-surface-variant">No parsing errors.</p>
                        ) : (
                          <ul className="list-disc pl-5 text-xs text-error">
                            {log.errors.map((err, idx) => (
                              <li key={`${log.id}-err-${idx}`}>
                                Line {err.line}: {err.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-on-surface-variant">
                    No ingestion logs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
