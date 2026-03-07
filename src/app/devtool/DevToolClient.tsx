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
  const [resetUsersXpState, setResetUsersXpState] = useState<ActionState>(DEFAULT_STATE);
  const [clearSyllabusState, setClearSyllabusState] = useState<ActionState>(DEFAULT_STATE);

  // Role override state
  const [overrideUserId, setOverrideUserId] = useState("");
  const [overrideRole, setOverrideRole] = useState("student");
  const [overrideState, setOverrideState] = useState<ActionState>(DEFAULT_STATE);

  // XP manipulation state
  const [xpUserId, setXpUserId] = useState("");
  const [xpAmount, setXpAmount] = useState("");
  const [xpMode, setXpMode] = useState<"add" | "set">("add");
  const [xpState, setXpState] = useState<ActionState>(DEFAULT_STATE);

  async function runAction(
    action: string,
    setState: React.Dispatch<React.SetStateAction<ActionState>>,
    confirmMsg: string,
    payload?: Record<string, unknown>,
  ) {
    if (!confirm(confirmMsg)) return;
    setState({ status: "loading", message: "Running…" });
    try {
      const res = await fetch("/api/devtool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
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

  async function handleRoleOverride() {
    if (!overrideUserId.trim()) {
      setOverrideState({ status: "error", message: "User ID is required." });
      return;
    }
    if (!confirm(`Override role for user ${overrideUserId} to "${overrideRole}"?`)) return;
    setOverrideState({ status: "loading", message: "Running…" });
    try {
      const res = await fetch("/api/devtool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "role_override", userId: overrideUserId, role: overrideRole }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOverrideState({ status: "success", message: data.message ?? "Role updated." });
      } else {
        setOverrideState({ status: "error", message: data.error ?? "Role override failed." });
      }
    } catch {
      setOverrideState({ status: "error", message: "Network error. Please try again." });
    }
  }

  async function handleXpManipulation() {
    if (!xpUserId.trim() || !xpAmount) {
      setXpState({ status: "error", message: "User ID and XP amount are required." });
      return;
    }
    const amount = parseInt(xpAmount, 10);
    if (isNaN(amount)) {
      setXpState({ status: "error", message: "XP amount must be a number." });
      return;
    }
    if (!confirm(`${xpMode === "add" ? "Add" : "Set"} ${amount} XP for user ${xpUserId}?`)) return;
    setXpState({ status: "loading", message: "Running…" });
    try {
      const res = await fetch("/api/devtool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: `xp_${xpMode}`, userId: xpUserId, amount }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setXpState({ status: "success", message: data.message ?? "XP updated." });
      } else {
        setXpState({ status: "error", message: data.error ?? "XP manipulation failed." });
      }
    } catch {
      setXpState({ status: "error", message: "Network error. Please try again." });
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

      {/* Role Override */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-1">Role Override</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Force-set a user&apos;s primary role. Use the Appwrite User ID (not email).
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={overrideUserId}
            onChange={(e) => setOverrideUserId(e.target.value)}
            placeholder="Appwrite User ID"
            className="input-field flex-1"
          />
          <select
            value={overrideRole}
            onChange={(e) => setOverrideRole(e.target.value)}
            className="input-field sm:w-40"
          >
            <option value="student">student</option>
            <option value="moderator">moderator</option>
            <option value="admin">admin</option>
            <option value="founder">founder</option>
          </select>
          <button
            className="btn text-sm px-4 py-2 shrink-0"
            onClick={handleRoleOverride}
            disabled={overrideState.status === "loading"}
          >
            {overrideState.status === "loading" ? "Running…" : "Override Role"}
          </button>
        </div>
        <StatusBadge state={overrideState} />
      </div>

      {/* XP Manipulation */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-1">XP Manipulation</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Add or set XP for a specific user. Use the Appwrite User ID.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={xpUserId}
            onChange={(e) => setXpUserId(e.target.value)}
            placeholder="Appwrite User ID"
            className="input-field flex-1"
          />
          <input
            type="number"
            value={xpAmount}
            onChange={(e) => setXpAmount(e.target.value)}
            placeholder="XP amount"
            className="input-field sm:w-32"
          />
          <select
            value={xpMode}
            onChange={(e) => setXpMode(e.target.value as "add" | "set")}
            className="input-field sm:w-28"
          >
            <option value="add">Add</option>
            <option value="set">Set to</option>
          </select>
          <button
            className="btn text-sm px-4 py-2 shrink-0"
            onClick={handleXpManipulation}
            disabled={xpState.status === "loading"}
          >
            {xpState.status === "loading" ? "Running…" : "Apply XP"}
          </button>
        </div>
        <StatusBadge state={xpState} />
      </div>

      {/* Reset All Users XP */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-1">Reset All Users XP &amp; Streak</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Sets XP to 0 and streak_days to 0 for every user in the database.
        </p>
        <button
          className="btn text-sm px-4 py-2"
          style={{ borderColor: "#ef4444", color: "#ef4444" }}
          onClick={() =>
            runAction(
              "reset_users_xp",
              setResetUsersXpState,
              "⚠️ Reset XP and streak for ALL users? This cannot be undone.",
            )
          }
          disabled={resetUsersXpState.status === "loading"}
        >
          {resetUsersXpState.status === "loading" ? "Running…" : "Reset All XP & Streak"}
        </button>
        <StatusBadge state={resetUsersXpState} />
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

      {/* Clear Pending Syllabi */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-1">Clear Pending Syllabi</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Removes all pending/unapproved syllabus submissions. Approved syllabi are unaffected.
        </p>
        <button
          className="btn text-sm px-4 py-2"
          style={{ borderColor: "#ef4444", color: "#ef4444" }}
          onClick={() =>
            runAction(
              "clear_pending_syllabus",
              setClearSyllabusState,
              "Remove all pending syllabus submissions? This cannot be undone.",
            )
          }
          disabled={clearSyllabusState.status === "loading"}
        >
          {clearSyllabusState.status === "loading" ? "Running…" : "Clear Pending Syllabi"}
        </button>
        <StatusBadge state={clearSyllabusState} />
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

