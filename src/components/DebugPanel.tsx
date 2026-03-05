"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Dev-only floating debug panel.
 * Shows Appwrite session state, current user email, auth events, environment
 * variables, and cookies.
 *
 * Only rendered when NODE_ENV !== "production" (enforced by the parent layout).
 */

type LogEntry = { ts: string; label: string; data: unknown };

/** Shape of user info fetched from the debug API. */
interface DebugUserInfo {
  email?: string;
  id?: string;
  name?: string;
  error?: string;
}

function now() {
  return new Date().toLocaleTimeString();
}

/** Maximum number of log entries retained in memory to avoid performance degradation. */
const MAX_LOGS = 50;

// Module-level log queue so auth events fired before the panel mounts are captured.
const pendingLogs: LogEntry[] = [];

/**
 * Push a log entry from anywhere in the app (e.g. auth actions).
 * If the panel is mounted it receives the entry immediately; otherwise it is
 * queued and flushed when the panel first mounts.
 */
export function addDebugLog(label: string, data: unknown) {
  pendingLogs.push({ ts: now(), label, data });
  if (pendingLogs.length > MAX_LOGS) pendingLogs.splice(0, pendingLogs.length - MAX_LOGS);
}

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<DebugUserInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cookiesText, setCookiesText] = useState<string | null>(null);

  const addLog = useCallback((label: string, data: unknown) => {
    setLogs((l) => {
      const next = [...l, { ts: now(), label, data }];
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
    });
  }, []);

  // Flush any logs that arrived before the panel mounted.
  useEffect(() => {
    if (pendingLogs.length > 0) {
      setLogs((l) => {
        const merged = [...pendingLogs, ...l];
        return merged.length > MAX_LOGS ? merged.slice(merged.length - MAX_LOGS) : merged;
      });
      pendingLogs.length = 0;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      // Check for session cookie presence (non-httpOnly cookies only)
      const hasSession = document.cookie.includes("ea_session");
      addLog("session check", { hasSessionCookie: hasSession });
      setUserInfo(hasSession ? { email: "(session present – verify server-side)" } : null);
    } catch (err) {
      addLog("error", String(err));
    }
  }, [addLog]);

  // Log useful debug info on mount.
  useEffect(() => {
    if (typeof window !== "undefined") {
      addLog("redirect URL (current page)", window.location.href);
      const params = new URLSearchParams(window.location.search);
      const userId = params.get("userId");
      if (userId) addLog("callback: userId param present", userId.slice(0, 8) + "…");
      const secret = params.get("secret");
      if (secret) addLog("callback: secret param present", "(hidden)");
      const authError = params.get("error");
      if (authError) addLog("callback: error param", authError);
    }
  }, [addLog]);

  // Refresh on open
  useEffect(() => {
    if (open) refreshSession();
  }, [open, refreshSession]);

  const clearCookies = useCallback(() => {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
    });
    const remaining = document.cookie || "(no non-httpOnly cookies remaining)";
    setCookiesText(remaining);
    addLog("clearCookies", remaining);
  }, [addLog]);

  const showCookies = useCallback(() => {
    const text = document.cookie || "(no non-httpOnly cookies)";
    setCookiesText(text);
    addLog("cookies", text);
  }, [addLog]);

  const envVars: Record<string, string> = {
    NODE_ENV: process.env.NODE_ENV ?? "(not set)",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "(not set)",
    NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
      ? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT.slice(0, 30) + "…"
      : "(not set)",
    NEXT_PUBLIC_APPWRITE_PROJECT_ID:
      process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "(not set)",
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open debug panel"
        style={{
          position: "fixed",
          bottom: "1.25rem",
          right: "1.25rem",
          zIndex: 9990,
          background: "#1e293b",
          color: "#f1f5f9",
          border: "1px solid #334155",
          borderRadius: "9999px",
          padding: "0.4rem 0.8rem",
          fontSize: "0.7rem",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          letterSpacing: "0.03em",
        }}
      >
        🛠 Debug
      </button>

      {!open ? null : (
        <>
          {/* Overlay */}
          <div
            onClick={() => setOpen(false)}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9991,
              background: "rgba(0,0,0,0.55)",
            }}
          />

          {/* Bottom sheet */}
          <div
            role="dialog"
            aria-label="Debug panel"
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9992,
              background: "#0f172a",
              color: "#e2e8f0",
              borderTop: "2px solid #334155",
              borderRadius: "1rem 1rem 0 0",
              maxHeight: "80dvh",
              overflowY: "auto",
              padding: "1.25rem 1rem 2rem",
              fontFamily:
                "ui-monospace, SFMono-Regular, 'Cascadia Code', Menlo, monospace",
              fontSize: "0.72rem",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.1rem",
              }}
            >
              <strong style={{ fontSize: "0.85rem" }}>🛠 Dev Debug Panel</strong>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close debug panel"
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Session state */}
            <DebugSection title="Session (Appwrite)">
              <DebugRow
                label="Status"
                value={userInfo ? "✓ Session present" : "✗ Not authenticated"}
                highlight={!!userInfo}
              />
              <DebugRow
                label="User"
                value={userInfo?.email ?? "(none)"}
              />
            </DebugSection>

            {/* Environment variables */}
            <DebugSection title="Environment">
              {Object.entries(envVars).map(([k, v]) => (
                <DebugRow key={k} label={k} value={v} />
              ))}
            </DebugSection>

            {/* Cookies */}
            {cookiesText !== null && (
              <DebugSection title="Cookies (non-httpOnly)">
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    color: "#94a3b8",
                    margin: 0,
                  }}
                >
                  {cookiesText}
                </pre>
              </DebugSection>
            )}

            {/* Last auth response – removed (no client-side Appwrite SDK) */}

            {/* Logs */}
            {logs.length > 0 && (
              <DebugSection title={`Logs (${logs.length})`}>
                {logs.map((entry, i) => (
                  <div key={i} style={{ marginBottom: "0.6rem" }}>
                    <span style={{ color: "#64748b" }}>[{entry.ts}]</span>{" "}
                    <span style={{ color: "#38bdf8" }}>{entry.label}</span>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        color: "#94a3b8",
                        margin: "0.2rem 0 0",
                      }}
                    >
                      {JSON.stringify(entry.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </DebugSection>
            )}

            {/* Action buttons */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginTop: "1rem",
                flexWrap: "wrap",
              }}
            >
              {(
                [
                  { label: "Refresh session", fn: refreshSession },
                  { label: "Clear cookies", fn: clearCookies },
                  { label: "Show cookies", fn: showCookies },
                ] as const
              ).map(({ label, fn }) => (
                <button
                  key={label}
                  onClick={() => void fn()}
                  style={{
                    background: "#1e293b",
                    color: "#e2e8f0",
                    border: "1px solid #334155",
                    borderRadius: "0.375rem",
                    padding: "0.35rem 0.7rem",
                    fontSize: "0.7rem",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setLogs([])}
                style={{
                  background: "#1e293b",
                  color: "#64748b",
                  border: "1px solid #334155",
                  borderRadius: "0.375rem",
                  padding: "0.35rem 0.7rem",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                }}
              >
                Clear logs
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function DebugSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <p
        style={{
          color: "#475569",
          fontWeight: 700,
          marginBottom: "0.4rem",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          fontSize: "0.6rem",
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function DebugRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.2rem" }}>
      <span style={{ color: "#64748b", minWidth: "11rem", flexShrink: 0 }}>
        {label}:
      </span>
      <span
        style={{
          color: highlight ? "#4ade80" : "#e2e8f0",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}
