"use client";

import { useCallback, useEffect, useState } from "react";
import { formatIstTime } from "@/lib/datetime";

/**
 * Dev-only floating debug panel.
 * Shows Appwrite session state, auth events, environment variables, cookies,
 * network status, and viewport dimensions.
 *
 * Only rendered when NODE_ENV !== "production" AND
 * NEXT_PUBLIC_ENABLE_DEBUG_PANEL === "true" (enforced by the parent layout).
 */

type LogEntry = { ts: string; label: string; data: unknown };

/** Shape of user info derived from cookie inspection. */
interface DebugUserInfo {
  email?: string;
  id?: string;
  name?: string;
  error?: string;
}

function now() {
  return `${formatIstTime()} IST`;
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

/** Read a Network Information API value safely (not available in all browsers). */
function getConnectionInfo(): string {
  try {
    // @ts-expect-error – NetworkInformation is not in all TS lib types
    const conn = navigator.connection;
    if (!conn) return "unknown";
    const parts: string[] = [];
    if (conn.effectiveType) parts.push(conn.effectiveType);
    if (conn.downlink !== undefined) parts.push(`↓${conn.downlink} Mbps`);
    if (conn.rtt !== undefined) parts.push(`RTT ${conn.rtt} ms`);
    return parts.join(" · ") || "unknown";
  } catch {
    return "unavailable";
  }
}

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<DebugUserInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cookiesText, setCookiesText] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

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

  // Track online/offline status.
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => { setIsOnline(true); addLog("network", "online"); };
    const onOffline = () => { setIsOnline(false); addLog("network", "offline"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [addLog]);

  // Track viewport dimensions (updates on resize).
  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
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
      addLog("current page URL", window.location.href);
      const params = new URLSearchParams(window.location.search);
      const userId = params.get("userId");
      if (userId) addLog("callback: userId param present", userId.slice(0, 8) + "…");
      const secret = params.get("secret");
      if (secret) addLog("callback: secret param present", "(hidden)");
      const authError = params.get("error");
      if (authError) addLog("callback: error param", authError);
    }
  }, [addLog]);

  // Refresh session info when panel opens.
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

  const copyLogs = useCallback(async () => {
    const text = logs
      .map((e) => `[${e.ts}] ${e.label}\n${JSON.stringify(e.data, null, 2)}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("Copied!");
    } catch {
      setCopyFeedback("Copy failed");
    }
    setTimeout(() => setCopyFeedback(""), 2000);
  }, [logs]);

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
      {/* Floating trigger – large touch target for mobile */}
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
          padding: "0.55rem 1rem",
          fontSize: "0.75rem",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          letterSpacing: "0.03em",
          minHeight: "2.75rem",
          minWidth: "5rem",
          touchAction: "manipulation",
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
            {/* Drag handle – visual affordance for mobile */}
            <div
              aria-hidden="true"
              style={{
                width: "2.5rem",
                height: "0.25rem",
                background: "#334155",
                borderRadius: "9999px",
                margin: "0 auto 1rem",
              }}
            />

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
                  padding: "0.4rem",
                  minWidth: "2.2rem",
                  minHeight: "2.2rem",
                  touchAction: "manipulation",
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

            {/* Network & viewport */}
            <DebugSection title="Device">
              <DebugRow
                label="Network"
                value={isOnline ? `✓ Online · ${getConnectionInfo()}` : "✗ Offline"}
                highlight={isOnline}
              />
              <DebugRow
                label="Viewport"
                value={viewport.w ? `${viewport.w} × ${viewport.h} px` : "–"}
              />
              <DebugRow
                label="User Agent"
                value={
                  typeof navigator !== "undefined"
                    ? navigator.userAgent.slice(0, 60) + (navigator.userAgent.length > 60 ? "…" : "")
                    : "–"
                }
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

            {/* Action buttons – larger tap targets for mobile */}
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
                  { label: "Show cookies", fn: showCookies },
                  { label: "Clear cookies", fn: clearCookies },
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
                    padding: "0.5rem 0.8rem",
                    fontSize: "0.7rem",
                    cursor: "pointer",
                    minHeight: "2.2rem",
                    touchAction: "manipulation",
                  }}
                >
                  {label}
                </button>
              ))}
              {logs.length > 0 && (
                <button
                  onClick={() => void copyLogs()}
                  style={{
                    background: "#1e293b",
                    color: copyFeedback ? "#4ade80" : "#e2e8f0",
                    border: "1px solid #334155",
                    borderRadius: "0.375rem",
                    padding: "0.5rem 0.8rem",
                    fontSize: "0.7rem",
                    cursor: "pointer",
                    minHeight: "2.2rem",
                    touchAction: "manipulation",
                  }}
                >
                  {copyFeedback || "Copy logs"}
                </button>
              )}
              <button
                onClick={() => setLogs([])}
                style={{
                  background: "#1e293b",
                  color: "#64748b",
                  border: "1px solid #334155",
                  borderRadius: "0.375rem",
                  padding: "0.5rem 0.8rem",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                  minHeight: "2.2rem",
                  touchAction: "manipulation",
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
