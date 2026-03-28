/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";

type Limits = {
  dailyLimit: number;
  rpmLimit: number;
  defaults: {
    dailyLimit: number;
    rpmLimit: number;
  };
};

type StatsResponse = {
  rpm: number;
  rpd: number;
  limits: Limits;
};

export default function AiStatsClient() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ dailyLimit: string; rpmLimit: string }>({
    dailyLimit: "",
    rpmLimit: "",
  });

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-stats", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load stats (${res.status})`);
      }
      const data = (await res.json()) as StatsResponse;
      setStats(data);
      setForm({
        dailyLimit: data.limits.dailyLimit.toString(),
        rpmLimit: data.limits.rpmLimit.toString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }

  async function saveLimits() {
    setLoading(true);
    setError(null);
    try {
      const dailyLimit = Number(form.dailyLimit);
      const rpmLimit = Number(form.rpmLimit);
      const res = await fetch("/api/admin/ai-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLimit, rpmLimit }),
      });
      if (!res.ok) {
        throw new Error(`Failed to update limits (${res.status})`);
      }
      const data = (await res.json()) as { limits: Limits };
      setStats((prev) =>
        prev
          ? { ...prev, limits: data.limits }
          : { rpm: 0, rpd: 0, limits: data.limits },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update limits");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-3">
        <StatCard label="Requests / Minute" value={stats?.rpm ?? 0} />
        <StatCard label="Requests Today" value={stats?.rpd ?? 0} />
        <StatCard label="RPM Limit" value={stats?.limits.rpmLimit ?? 0} />
        <StatCard label="Daily Limit" value={stats?.limits.dailyLimit ?? 0} />
        <StatCard label="Tokens / Request" value="Not tracked" />
      </div>

      <div className="rounded-xl border border-outline-variant/40 bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Control limits</h3>
          <button
            onClick={loadStats}
            disabled={loading}
            className="btn-primary px-3 py-1 text-sm"
          >
            Refresh
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <LabeledInput
            label="Daily limit (requests/day)"
            value={form.dailyLimit}
            onChange={(v) => setForm((s) => ({ ...s, dailyLimit: v }))}
          />
          <LabeledInput
            label="RPM limit (requests/min)"
            value={form.rpmLimit}
            onChange={(v) => setForm((s) => ({ ...s, rpmLimit: v }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-on-surface-variant">
          <span>
            Defaults: Daily {stats?.limits?.defaults.dailyLimit ?? "—"}, RPM {stats?.limits?.defaults.rpmLimit ?? "—"}
          </span>
          <span>Changes apply immediately until server restart.</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={saveLimits}
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm"
          >
            Save limits
          </button>
          {loading && <span className="text-sm text-on-surface-variant">Working…</span>}
          {error && <span className="text-sm text-error">⚠ {error}</span>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[180px] flex-1 rounded-xl border border-outline-variant/40 bg-surface p-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-on-surface-variant">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
        min={1}
      />
    </label>
  );
}
