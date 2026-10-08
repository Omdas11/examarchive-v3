"use client";

import { useState } from "react";

/**
 * Founder-only button that triggers a full gamification reset
 * (XP → 0, tier → bronze, streak → 0, all achievements deleted).
 * Requires typing RESET to confirm.
 */
export default function ResetGamificationButton() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    if (confirm.trim().toUpperCase() !== "RESET") return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset-gamification", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setResult(
        `Done — ${data.usersReset} users reset, ${data.achievementsDeleted} achievements deleted.`,
      );
      setConfirm("");
    } catch (e) {
      setResult(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder='Type RESET to confirm'
          disabled={busy}
          className="rounded-lg border border-red-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || confirm.trim().toUpperCase() !== "RESET"}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Resetting…" : "Reset all XP & badges"}
        </button>
      </div>
      {result && <p className="mt-2 text-xs font-semibold text-red-700">{result}</p>}
    </div>
  );
}
