"use client";

/**
 * LeaderboardConsentWrapper
 *
 * Client component mounted in the root layout. On login, every user must
 * choose whether their real name may appear on the public XP leaderboard.
 * The choice is mandatory: the modal has no close button and no
 * backdrop-dismiss — it stays until the user picks one of the two options,
 * and the choice is saved in D1 (users.leaderboard_name_visible).
 *
 * The check runs once per session (root layout mounts once): a single
 * /api/profile GET. Guests 401 and see nothing. Users who already chose
 * never see the modal again; they can change the choice in their profile.
 */

import { useEffect, useState } from "react";

export default function LeaderboardConsentWrapper() {
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function checkConsent() {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          leaderboard_name_visible?: number | null;
        };
        if (!cancelled && data.leaderboard_name_visible == null) {
          setShowModal(true);
        }
      } catch {
        // Non-blocking; the modal simply does not appear this session.
      }
    }
    void checkConsent();
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(showName: boolean) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile/leaderboard-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ showName }),
      });
      if (!res.ok) throw new Error("save failed");
      setShowModal(false);
    } catch {
      setError("Could not save your choice. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!showModal) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-consent-title"
    >
      <div
        className="card w-full rounded-lg p-5 sm:p-6"
        style={{ maxWidth: 420 }}
      >
        <h2
          id="leaderboard-consent-title"
          className="text-lg font-bold"
          style={{ margin: "0 0 0.5rem" }}
        >
          Show your name on the leaderboard?
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--color-text-muted)", margin: "0 0 1rem" }}
        >
          The XP leaderboard is public — anyone can see it. If you show your
          name, your real name appears next to your XP. If not, only your
          username shows. You can change this anytime in your profile.
        </p>
        {error && (
          <p className="text-sm font-semibold" style={{ color: "#dc2626", margin: "0 0 1rem" }}>
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void choose(true)}
            className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "#047857" }}
          >
            Show my name
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void choose(false)}
            className="rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-60"
            style={{
              background: "var(--color-surface)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
          >
            Username only
          </button>
        </div>
      </div>
    </div>
  );
}
