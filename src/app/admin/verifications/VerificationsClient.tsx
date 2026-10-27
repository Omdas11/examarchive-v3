"use client";

import { useCallback, useEffect, useState } from "react";

interface VerificationRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  content_type: string;
  content_id: string;
  verdict: string;
  correction: string;
  xp_awarded: number;
  credits_awarded: number;
  status: string;
  created_at: string;
}

export default function VerificationsClient() {
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/verifications", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load verifications");
      const data = (await res.json()) as { verifications: VerificationRow[] };
      setRows(data.verifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load verifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "accept" | "reject") {
    setActing(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/verifications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Review failed");
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-on-surface-variant">Loading…</p>;
  }

  return (
    <div className="mt-6 space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No pending corrections.</p>
      ) : (
        rows.map((row) => (
          <div key={row.id} className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">
                {row.user_name ?? row.user_email ?? row.user_id}
              </p>
              <p className="text-xs text-on-surface-variant">{row.created_at}</p>
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">
              {row.content_type} · {row.content_id}
            </p>
            <p className="mt-2 text-sm">{row.correction || "(no correction text)"}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={acting === row.id}
                onClick={() => void act(row.id, "accept")}
                className="rounded-lg bg-surface-container px-3 py-2 text-sm hover:bg-surface-container-high transition-colors disabled:opacity-50"
              >
                Accept (+25 XP, +5 credits)
              </button>
              <button
                type="button"
                disabled={acting === row.id}
                onClick={() => void act(row.id, "reject")}
                className="rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                style={{ color: "var(--color-text-muted)" }}
              >
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
