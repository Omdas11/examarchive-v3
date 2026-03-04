"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

/**
 * Dev-only floating debug panel.
 * Shows session state, current user email, Supabase response logs, auth errors,
 * and environment variables.  Includes Refresh session / Clear session / Show
 * cookies buttons.
 *
 * Only rendered when NODE_ENV !== "production" (enforced by the parent layout).
 */

type LogEntry = { ts: string; label: string; data: unknown };

function now() {
  return new Date().toLocaleTimeString();
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cookiesText, setCookiesText] = useState<string | null>(null);

  const addLog = useCallback((label: string, data: unknown) => {
    setLogs((l) => [...l, { ts: now(), label, data }]);
  }, []);

  const refreshSession = useCallback(async () => {
    const client = getSupabase();
    if (!client) {
      addLog("error", "Supabase env vars not configured");
      return;
    }
    const result = await client.auth.getSession();
    setSession(result.data.session);
    addLog("getSession", {
      user: result.data.session?.user?.email ?? null,
      expires_at: result.data.session?.expires_at ?? null,
      error: result.error?.message ?? null,
    });
  }, [addLog]);

  // Refresh on open
  useEffect(() => {
    if (open) refreshSession();
  }, [open, refreshSession]);

  const clearSession = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    const result = await client.auth.signOut();
    addLog("signOut", { error: result.error?.message ?? null });
    setSession(null);
  }, [addLog]);

  const showCookies = useCallback(() => {
    // document.cookie only exposes non-httpOnly cookies; session tokens
    // stored as httpOnly cookies are intentionally not visible here.
    const text = document.cookie || "(no non-httpOnly cookies)";
    setCookiesText(text);
    addLog("cookies", text);
  }, [addLog]);

  const envVars: Record<string, string> = {
    NODE_ENV: process.env.NODE_ENV ?? "(not set)",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "(not set)",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 30) + "…"
      : "(not set)",
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
            <DebugSection title="Session">
              <DebugRow
                label="Status"
                value={session ? "✓ Authenticated" : "✗ Not authenticated"}
                highlight={!!session}
              />
              <DebugRow
                label="User email"
                value={session?.user?.email ?? "(none)"}
              />
              <DebugRow
                label="Expires at"
                value={
                  session?.expires_at
                    ? new Date(session.expires_at * 1000).toLocaleString()
                    : "(none)"
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
              <DebugSection title="Cookies">
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
                  { label: "Clear session", fn: clearSession },
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
