"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastContext";
import { formatIstDateTime } from "@/lib/datetime";

/** Delay in ms before navigating to the tracker page after a successful ingest. */
const REDIRECT_DELAY_MS = 1800;
const TRACKER_AUTO_FLOW_STORAGE_KEY = "syllabus-tracker-auto-flow-v1";

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

function isMarkdownFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".md");
}

export default function IngestMdClient() {
  const { showToast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<IngestionLog[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [pollDelayMs, setPollDelayMs] = useState(10_000);
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "partial" | "failed">("all");
  const [query, setQuery] = useState("");
  const [autoTrackerFlow, setAutoTrackerFlow] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRACKER_AUTO_FLOW_STORAGE_KEY);
      if (raw === "0") setAutoTrackerFlow(false);
      if (raw === "1") setAutoTrackerFlow(true);
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRACKER_AUTO_FLOW_STORAGE_KEY, autoTrackerFlow ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [autoTrackerFlow]);

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

  async function ingestFiles(files: File[]) {
    if (files.length === 0) {
      setError("Please choose at least one file.");
      return;
    }
    const invalidFiles = files.filter((file) => !isMarkdownFile(file)).map((file) => file.name);
    if (invalidFiles.length > 0) {
      setError(`Only .md files are allowed. Invalid: ${invalidFiles.join(", ")}`);
      return;
    }
    setUploading(true);
    setPollDelayMs(2_500);
    setError(null);
    setLastResult(null);
    const outcomes: Array<{ paperCode: string; status: string; rowsAffected: number; added: number; updated: number }> = [];
    const errors: string[] = [];
    try {
      for (const file of files) {
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
                .filter((entry: unknown) => typeof entry === "object" && entry !== null && "message" in entry)
                .map((entry: unknown) => String((entry as { message?: unknown }).message ?? ""))
                .filter(Boolean)
            : [];
          errors.push(`${file.name}: ${data.error ?? (fallbackErrors.join("; ") || "Upload/ingestion failed.")}`);
          continue;
        }

        const paperCode = String(data.paperCode ?? "");
        outcomes.push({
          paperCode,
          status: String(data.status ?? "failed"),
          rowsAffected: Number(data.rowsAffected ?? 0),
          added: Number(data.added ?? 0),
          updated: Number(data.updated ?? 0),
        });
        if (paperCode) {
          showToast(
            `✓ ${paperCode} ingested — view in Syllabus Tracker`,
            data.status === "success" ? "success" : "warning",
          );
        }
      }

      const successCount = outcomes.filter((item) => item.status === "success").length;
      const partialCount = outcomes.filter((item) => item.status === "partial").length;
      const failedCount = files.length - successCount - partialCount;
      const totalAdded = outcomes.reduce((sum, item) => sum + item.added, 0);
      const totalUpdated = outcomes.reduce((sum, item) => sum + item.updated, 0);
      const totalRows = outcomes.reduce((sum, item) => sum + item.rowsAffected, 0);

      setLastResult(
        `Processed ${files.length} file(s) · Success ${successCount}, Partial ${partialCount}, Failed ${failedCount} · Added ${totalAdded}, Updated ${totalUpdated}, Rows ${totalRows}`,
      );
      if (errors.length > 0) {
        setError(errors.join(" | "));
      }

      if (autoTrackerFlow) {
        const paperCodes = outcomes
          .map((item) => item.paperCode)
          .filter((code) => code.length > 0);
        const lastPaperCode = paperCodes.length > 0 ? paperCodes[paperCodes.length - 1] : null;
        if (lastPaperCode) {
          const trackerUrl = `/admin/syllabus-tracker?highlight=${encodeURIComponent(lastPaperCode)}&returnToIngest=1`;
          // Navigate to tracker after a short delay so the toast is visible first.
          setTimeout(() => {
            window.location.assign(trackerUrl);
          }, REDIRECT_DELAY_MS);
        }
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

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (!q) return true;
      return (
        log.fileName.toLowerCase().includes(q) ||
        log.paperCode.toLowerCase().includes(q) ||
        log.status.toLowerCase().includes(q)
      );
    });
  }, [logs, query, statusFilter]);

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border border-outline-variant/40 bg-surface p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          <a href="/api/admin/ingest-md?template=syllabus" className="btn">
            Download Syllabus Template
          </a>
          <a href="/api/admin/ingest-md?template=question" className="btn">
            Download Question Template
          </a>
          <label className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/40 px-3 py-2 text-sm">
            <span>Auto Ingest ↔ Tracker flow</span>
            <input
              type="checkbox"
              checked={autoTrackerFlow}
              onChange={(e) => setAutoTrackerFlow(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
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
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) void ingestFiles(files);
          }}
          className={`block cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragActive ? "border-primary bg-primary/10" : "border-outline-variant/40 bg-surface-container-low"
          }`}
        >
          <input
            type="file"
            multiple
            accept=".md,text/markdown"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              if (files.length > 0) void ingestFiles(files);
            }}
          />
          <p className="text-sm font-semibold">Drag & drop Markdown files or click to choose one or more files</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Only `.md` files are accepted. Upload syllabus-only or question-only markdown templates.
            Files containing both sections are rejected. Authoring spec: docs/MASTER_INGESTION_GUIDE.md.
            `syllabus_pdf_url` and `question_pdf_url` are auto-populated when omitted.
          </p>
          {uploading && <p className="mt-3 text-sm text-primary">Processing ingestion…</p>}
        </label>
        {error && <p className="mt-3 text-sm text-error">⚠ {error}</p>}
        {lastResult && <p className="mt-3 text-sm text-on-surface-variant">{lastResult}</p>}
      </section>

      <section className="rounded-xl border border-outline-variant/40 bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ingestion Log Dashboard</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search file, paper code, status…"
              className="input-field h-9 w-64 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="input-field h-9 w-36 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="success">Success</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          Showing {filteredLogs.length} of {logs.length} log entries
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                <th className="py-2 pr-2">Timestamp</th>
                <th className="py-2 pr-2">File Name</th>
                <th className="py-2 pr-2">Paper Code</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Rows Affected</th>
                <th className="py-2 pr-2">Errors</th>
                <th className="py-2 pr-2">Expand</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <Fragment key={log.id}>
                  <tr className="border-b border-outline-variant/20">
                    <td className="py-2 pr-2">{formatIstDateTime(log.timestamp)} IST</td>
                    <td className="py-2 pr-2">
                      <details>
                        <summary className="max-w-sm cursor-pointer truncate md:max-w-xl">{log.fileName}</summary>
                        <p className="mt-1 break-all text-xs text-on-surface-variant">{log.fileName}</p>
                      </details>
                    </td>
                    <td className="py-2 pr-2">{log.paperCode || "—"}</td>
                    <td className={`py-2 pr-2 font-semibold ${getStatusClass(log.status)}`}>
                      {log.status.toUpperCase()}
                    </td>
                    <td className="py-2 pr-2">{log.rowsAffected}</td>
                    <td className="py-2 pr-2">{log.errors.length}</td>
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
                      <td colSpan={7} className="py-2">
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
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-on-surface-variant">
                    No ingestion logs match the current filters.
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
