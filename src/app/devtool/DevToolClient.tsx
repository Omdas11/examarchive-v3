"use client";

import { useState } from "react";

interface DevToolClientProps {
  adminEmail: string;
}

type ActionStatus = "idle" | "loading" | "success" | "error";

interface ActionState {
  status: ActionStatus;
  message: string;
}

const DEFAULT_STATE: ActionState = { status: "idle", message: "" };

export default function DevToolClient({ adminEmail }: DevToolClientProps) {
  const [clearPapersState, setClearPapersState] = useState<ActionState>(DEFAULT_STATE);
  const [clearUploadsState, setClearUploadsState] = useState<ActionState>(DEFAULT_STATE);
  const [clearLogsState, setClearLogsState] = useState<ActionState>(DEFAULT_STATE);
  const [healthState, setHealthState] = useState<ActionState>(DEFAULT_STATE);

  async function runAction(
    action: string,
    setState: React.Dispatch<React.SetStateAction<ActionState>>,
    confirmMsg: string,
  ) {
    if (!confirm(confirmMsg)) return;
    setState({ status: "loading", message: "Running…" });
    try {
      const res = await fetch("/api/devtool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setState({ status: "success", message: data.message ?? "Done." });
      } else {
        setState({ status: "error", message: data.error ?? "Action failed." });
      }
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
    }
  }

  async function runHealthCheck() {
    setHealthState({ status: "loading", message: "Checking…" });
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (res.ok) {
        setHealthState({ status: "success", message: `System healthy. DB: ${data.db ?? "ok"}, Storage: ${data.storage ?? "ok"}` });
      } else {
        setHealthState({ status: "error", message: data.error ?? "Health check failed." });
      }
    } catch {
      setHealthState({ status: "error", message: "Could not reach health endpoint." });
    }
  }

  return (
    <div className="space-y-6">
      {/* Operator info */}
      <div className="card p-4 text-sm">
        <p style={{ color: "var(--color-text-muted)" }}>
          Signed in as <strong>{adminEmail}</strong>
        </p>
      </div>

      {/* System Health */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-1">System Health</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Run a connectivity check against Appwrite DB and Storage.
        </p>
        <button
          className="btn text-sm px-4 py-2"
          onClick={runHealthCheck}
          disabled={healthState.status === "loading"}
        >
          {healthState.status === "loading" ? "Checking…" : "Run Health Check"}
        </button>
        <StatusBadge state={healthState} />
      </div>

      {/* Clear Pending Uploads */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-1">Clear Pending Uploads</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Removes all unapproved paper submissions from the database. Already-approved papers are unaffected.
        </p>
        <button
          className="btn text-sm px-4 py-2"
          style={{ borderColor: "#ef4444", color: "#ef4444" }}
          onClick={() =>
            runAction(
              "clear_pending_uploads",
              setClearUploadsState,
              "Remove all unapproved paper submissions? This cannot be undone.",
            )
          }
          disabled={clearUploadsState.status === "loading"}
        >
          {clearUploadsState.status === "loading" ? "Running…" : "Clear Pending Uploads"}
        </button>
        <StatusBadge state={clearUploadsState} />
      </div>

      {/* Reset Activity Logs */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-1">Clear Activity Logs</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Deletes all entries from the activity_logs collection. User data is preserved.
        </p>
        <button
          className="btn text-sm px-4 py-2"
          style={{ borderColor: "#ef4444", color: "#ef4444" }}
          onClick={() =>
            runAction(
              "clear_activity_logs",
              setClearLogsState,
              "Clear all activity logs? This cannot be undone.",
            )
          }
          disabled={clearLogsState.status === "loading"}
        >
          {clearLogsState.status === "loading" ? "Running…" : "Clear Activity Logs"}
        </button>
        <StatusBadge state={clearLogsState} />
      </div>

      {/* Reset All Papers */}
      <div className="card p-6 border-2" style={{ borderColor: "#ef4444" }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: "#ef4444" }}>
          ⚠️ Reset All Papers
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          <strong>DANGER:</strong> Permanently deletes ALL papers (approved and pending) from the database.
          This action cannot be reversed.
        </p>
        <button
          className="btn text-sm px-4 py-2"
          style={{ background: "#ef4444", color: "#fff", borderColor: "#ef4444" }}
          onClick={() =>
            runAction(
              "reset_all_papers",
              setClearPapersState,
              "⚠️ DANGER: This will permanently delete ALL papers. Type 'confirm' to proceed.",
            )
          }
          disabled={clearPapersState.status === "loading"}
        >
          {clearPapersState.status === "loading" ? "Running…" : "Reset All Papers"}
        </button>
        <StatusBadge state={clearPapersState} />
      </div>
    </div>
  );
}

function StatusBadge({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  const styles: Record<ActionStatus, { bg: string; color: string }> = {
    idle: { bg: "transparent", color: "transparent" },
    loading: { bg: "#fef9c3", color: "#713f12" },
    success: { bg: "#dcfce7", color: "#166534" },
    error: { bg: "#fee2e2", color: "#991b1b" },
  };
  const { bg, color } = styles[state.status];
  return (
    <p
      className="mt-3 rounded-md px-3 py-2 text-xs font-medium"
      style={{ background: bg, color }}
    >
      {state.status === "success" ? "✓ " : state.status === "error" ? "✗ " : ""}
      {state.message}
    </p>
  );
}
