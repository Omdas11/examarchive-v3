"use client";

import { useState } from "react";
import TypeToConfirmModal from "@/components/TypeToConfirmModal";

interface DevToolClientProps {
  adminEmail: string;
}

type ActionStatus = "idle" | "loading" | "success" | "error";

interface ActionState {
  status: ActionStatus;
  message: string;
}

const DEFAULT_STATE: ActionState = { status: "idle", message: "" };

interface PendingDangerAction {
  action: string;
  confirmWord: string;
  title: string;
  description: string;
  setState: React.Dispatch<React.SetStateAction<ActionState>>;
  payload?: Record<string, unknown>;
}

export default function DevToolClient({ adminEmail }: DevToolClientProps) {
  const [clearPapersState, setClearPapersState] = useState<ActionState>(DEFAULT_STATE);
  const [clearUploadsState, setClearUploadsState] = useState<ActionState>(DEFAULT_STATE);
  const [clearLogsState, setClearLogsState] = useState<ActionState>(DEFAULT_STATE);
  const [healthState, setHealthState] = useState<ActionState>(DEFAULT_STATE);
  const [resetUsersXpState, setResetUsersXpState] = useState<ActionState>(DEFAULT_STATE);
  const [clearSyllabusState, setClearSyllabusState] = useState<ActionState>(DEFAULT_STATE);
  const [purgeCollectionsState, setPurgeCollectionsState] = useState<ActionState>(DEFAULT_STATE);

  // Role override state
  const [overrideUserId, setOverrideUserId] = useState("");
  const [overrideRole, setOverrideRole] = useState("student");
  const [overrideState, setOverrideState] = useState<ActionState>(DEFAULT_STATE);

  // XP manipulation state
  const [xpUserId, setXpUserId] = useState("");
  const [xpAmount, setXpAmount] = useState("");
  const [xpMode, setXpMode] = useState<"add" | "set">("add");
  const [xpState, setXpState] = useState<ActionState>(DEFAULT_STATE);

  // Danger zone modal state
  const [pendingDangerAction, setPendingDangerAction] = useState<PendingDangerAction | null>(null);
  const [dangerActionLoading, setDangerActionLoading] = useState(false);

  async function runAction(
    action: string,
    setState: React.Dispatch<React.SetStateAction<ActionState>>,
    payload?: Record<string, unknown>,
  ) {
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

  function handleDangerCancel() {
    if (!dangerActionLoading) setPendingDangerAction(null);
  }

  function openDangerModal(action: PendingDangerAction) {
    setPendingDangerAction(action);
  }

  async function executeDangerAction() {
    if (!pendingDangerAction) return;
    const { action, setState, payload } = pendingDangerAction;
    setDangerActionLoading(true);
    try {
      await runAction(action, setState, payload);
    } finally {
      setDangerActionLoading(false);
      setPendingDangerAction(null);
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
          {healthState.status === "loading" && <span className="btn-spinner" />}
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
            {overrideState.status === "loading" && <span className="btn-spinner" />}
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
            {xpState.status === "loading" && <span className="btn-spinner" />}
            {xpState.status === "loading" ? "Running…" : "Apply XP"}
          </button>
        </div>
        <StatusBadge state={xpState} />
      </div>

      {/* ── DANGER ZONE ── */}
      <div className="danger-zone">
        <div className="danger-zone-title">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Danger Zone
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          These actions are destructive and cannot be undone. Each requires typing a confirmation word before execution.
        </p>

        <div className="space-y-4">
          {/* Purge all collections (except users) */}
          <div className="p-3 rounded-lg" style={{ border: "2px solid var(--brand-crimson)", background: "color-mix(in srgb, var(--brand-crimson) 6%, var(--color-surface))" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--brand-crimson)" }}>
                  Purge All Collections (skip users)
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Deletes every document from every collection in the database except the users collection.
                </p>
              </div>
              <button
                className="btn text-sm px-4 py-2 shrink-0"
                style={{ background: "var(--brand-crimson)", color: "#fff", borderColor: "var(--brand-crimson)" }}
                onClick={() =>
                  openDangerModal({
                    action: "purge_collections",
                    confirmWord: "PURGE",
                    title: "Purge All Collections",
                    description:
                      "This will delete all documents across every collection (except users). Use only before a full reseed.",
                    setState: setPurgeCollectionsState,
                  })
                }
                disabled={purgeCollectionsState.status === "loading"}
              >
                {purgeCollectionsState.status === "loading" && <span className="btn-spinner" />}
                {purgeCollectionsState.status === "loading" ? "Running…" : "Purge Collections"}
              </button>
            </div>
            <StatusBadge state={purgeCollectionsState} />
          </div>

          {/* Reset All Users XP */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg" style={{ border: "1px solid var(--color-border)" }}>
            <div>
              <p className="text-sm font-semibold">Reset All Users XP &amp; Streak</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Sets XP to 0 and streak_days to 0 for every user.</p>
            </div>
            <button
              className="btn text-sm px-4 py-2 shrink-0"
              style={{ borderColor: "var(--brand-crimson)", color: "var(--brand-crimson)" }}
              onClick={() =>
                openDangerModal({
                  action: "reset_users_xp",
                  confirmWord: "RESET",
                  title: "Reset All Users XP & Streak",
                  description: "This will set XP to 0 and streak_days to 0 for every user in the database. This action cannot be undone.",
                  setState: setResetUsersXpState,
                })
              }
              disabled={resetUsersXpState.status === "loading"}
            >
              {resetUsersXpState.status === "loading" && <span className="btn-spinner" />}
              {resetUsersXpState.status === "loading" ? "Running…" : "Reset All XP"}
            </button>
          </div>
          <StatusBadge state={resetUsersXpState} />

          {/* Clear Pending Uploads */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg" style={{ border: "1px solid var(--color-border)" }}>
            <div>
              <p className="text-sm font-semibold">Clear Pending Uploads</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Removes all unapproved paper submissions. Approved papers are unaffected.</p>
            </div>
            <button
              className="btn text-sm px-4 py-2 shrink-0"
              style={{ borderColor: "var(--brand-crimson)", color: "var(--brand-crimson)" }}
              onClick={() =>
                openDangerModal({
                  action: "clear_pending_uploads",
                  confirmWord: "DELETE",
                  title: "Clear Pending Uploads",
                  description: "This will remove all unapproved paper submissions from the database. Already-approved papers are unaffected.",
                  setState: setClearUploadsState,
                })
              }
              disabled={clearUploadsState.status === "loading"}
            >
              {clearUploadsState.status === "loading" && <span className="btn-spinner" />}
              {clearUploadsState.status === "loading" ? "Running…" : "Clear Pending"}
            </button>
          </div>
          <StatusBadge state={clearUploadsState} />

          {/* Clear Pending Syllabi */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg" style={{ border: "1px solid var(--color-border)" }}>
            <div>
              <p className="text-sm font-semibold">Clear Pending Syllabi</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Removes all pending/unapproved syllabus submissions.</p>
            </div>
            <button
              className="btn text-sm px-4 py-2 shrink-0"
              style={{ borderColor: "var(--brand-crimson)", color: "var(--brand-crimson)" }}
              onClick={() =>
                openDangerModal({
                  action: "clear_pending_syllabus",
                  confirmWord: "DELETE",
                  title: "Clear Pending Syllabi",
                  description: "This will remove all pending syllabus submissions. Approved syllabi are unaffected.",
                  setState: setClearSyllabusState,
                })
              }
              disabled={clearSyllabusState.status === "loading"}
            >
              {clearSyllabusState.status === "loading" && <span className="btn-spinner" />}
              {clearSyllabusState.status === "loading" ? "Running…" : "Clear Syllabi"}
            </button>
          </div>
          <StatusBadge state={clearSyllabusState} />

          {/* Clear Activity Logs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg" style={{ border: "1px solid var(--color-border)" }}>
            <div>
              <p className="text-sm font-semibold">Clear Activity Logs</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Deletes all entries from the activity_logs collection.</p>
            </div>
            <button
              className="btn text-sm px-4 py-2 shrink-0"
              style={{ borderColor: "var(--brand-crimson)", color: "var(--brand-crimson)" }}
              onClick={() =>
                openDangerModal({
                  action: "clear_activity_logs",
                  confirmWord: "DELETE",
                  title: "Clear Activity Logs",
                  description: "This will delete all entries from the activity_logs collection. User data is preserved.",
                  setState: setClearLogsState,
                })
              }
              disabled={clearLogsState.status === "loading"}
            >
              {clearLogsState.status === "loading" && <span className="btn-spinner" />}
              {clearLogsState.status === "loading" ? "Running…" : "Clear Logs"}
            </button>
          </div>
          <StatusBadge state={clearLogsState} />

          {/* Reset All Papers — highest danger */}
          <div className="p-3 rounded-lg" style={{ border: "2px solid var(--brand-crimson)", background: "color-mix(in srgb, var(--brand-crimson) 6%, var(--color-surface))" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--brand-crimson)" }}>
                  Reset All Papers
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <strong>DANGER:</strong> Permanently deletes ALL papers (approved and pending).
                </p>
              </div>
              <button
                className="btn text-sm px-4 py-2 shrink-0"
                style={{ background: "var(--brand-crimson)", color: "#fff", borderColor: "var(--brand-crimson)" }}
                onClick={() =>
                  openDangerModal({
                    action: "reset_all_papers",
                    confirmWord: "RESET",
                    title: "Reset All Papers",
                    description: "This will permanently delete ALL papers (both approved and pending) from the database. This action cannot be reversed.",
                    setState: setClearPapersState,
                  })
                }
                disabled={clearPapersState.status === "loading"}
              >
                {clearPapersState.status === "loading" && <span className="btn-spinner" />}
                {clearPapersState.status === "loading" ? "Running…" : "Reset All Papers"}
              </button>
            </div>
            <StatusBadge state={clearPapersState} />
          </div>
        </div>
      </div>

      {/* Type-to-Confirm Modal */}
      <TypeToConfirmModal
        open={!!pendingDangerAction}
        title={pendingDangerAction?.title ?? ""}
        description={pendingDangerAction?.description ?? ""}
        confirmWord={pendingDangerAction?.confirmWord ?? ""}
        onConfirm={executeDangerAction}
        onCancel={handleDangerCancel}
        loading={dangerActionLoading}
      />
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
