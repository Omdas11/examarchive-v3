"use client";

import { useState } from "react";
import { DOMAIN_COST_PAISE, MIN_SUPPORT_RUPEES, formatRupees } from "@/lib/support";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const QUICK_AMOUNTS = [20, 50, 100, 200];

/**
 * Support form: amount (min Rs 20) + optional name → Razorpay Checkout.
 * No login required. After a successful payment the progress numbers
 * refresh from /api/support/stats.
 */
export default function SupportForm({
  initialRaisedPaise,
  initialDonors,
  defaultName,
}: {
  initialRaisedPaise: number;
  initialDonors: number;
  defaultName: string;
}) {
  const [amount, setAmount] = useState("50");
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [raisedPaise, setRaisedPaise] = useState(initialRaisedPaise);
  const [donors, setDonors] = useState(initialDonors);

  const percent = Math.min(100, Math.round((raisedPaise / DOMAIN_COST_PAISE) * 100));

  async function refreshStats() {
    try {
      const res = await fetch("/api/support/stats");
      if (!res.ok) return;
      const data = (await res.json()) as { raisedPaise?: number; donors?: number };
      if (typeof data.raisedPaise === "number") setRaisedPaise(data.raisedPaise);
      if (typeof data.donors === "number") setDonors(data.donors);
    } catch {
      // progress refreshes on next visit anyway
    }
  }

  async function support() {
    setError(null);
    setMessage(null);
    const rupees = Number(amount);
    if (!Number.isInteger(rupees) || rupees < MIN_SUPPORT_RUPEES) {
      setError(`Minimum support is Rs ${MIN_SUPPORT_RUPEES}.`);
      return;
    }
    setBusy(true);
    try {
      const createRes = await fetch("/api/support/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountRupees: rupees, donorName: name.trim() || undefined }),
      });
      const createData = (await createRes.json()) as {
        error?: string;
        keyId?: string;
        orderId?: string;
        amount?: number;
        currency?: string;
      };
      if (!createRes.ok) throw new Error(createData.error ?? "Failed to create order");
      if (!window.Razorpay) throw new Error("Razorpay checkout failed to load.");

      const checkout = new window.Razorpay({
        key: createData.keyId,
        amount: createData.amount,
        currency: createData.currency,
        name: "ExamArchive",
        description: `Support the domain renewal — Rs ${rupees}`,
        order_id: createData.orderId,
        prefill: { name: name.trim() || undefined },
        handler: async (response: Record<string, unknown>) => {
          try {
            const verifyRes = await fetch("/api/support/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = (await verifyRes.json()) as { error?: string; message?: string };
            if (!verifyRes.ok) throw new Error(verifyData.error ?? "Payment verification failed");
            setMessage(verifyData.message ?? "Thank you for your support!");
            await refreshStats();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Payment verification failed");
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
        theme: { color: "#047857" },
      });
      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div
      className="mc-anim-up relative mt-3 overflow-hidden rounded-3xl border shadow-lg"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface)",
        animationDelay: "0.28s",
      }}
    >
      {/* Gradient top bar */}
      <div
        className="h-1.5 w-full"
        style={{ background: "linear-gradient(90deg,#059669,#047857,#0284c7,#7c3aed)" }}
        aria-hidden="true"
      />
      <div className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-bold">
            <span className="mc-gradient-text text-base">{formatRupees(raisedPaise)} raised</span>
            {" · "}
            {percent}%
          </span>
          <span className="inline-flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              groups
            </span>
            {donors} supporter{donors === 1 ? "" : "s"}
          </span>
        </div>
        {/* Mini progress bar */}
        <div
          className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--color-surface-muted)" }}
          aria-hidden="true"
        >
          <div
            className="mc-progress-fill h-full rounded-full"
            style={{
              width: `${percent}%`,
              background: "linear-gradient(90deg,#059669,#047857,#0284c7)",
            }}
          />
        </div>

        <label className="mt-5 block text-sm font-bold" htmlFor="support-amount">
          Amount (Rs)
        </label>
        <input
          id="support-amount"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          className="mt-1 w-full rounded-2xl border-2 px-4 py-3 text-xl font-black outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20"
          style={{ borderColor: "var(--color-border)", background: "var(--color-input-bg)" }}
          placeholder="50"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((v) => {
            const selected = Number(amount) === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className="rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-all hover:-translate-y-0.5 active:scale-95"
                style={
                  selected
                    ? {
                        borderColor: "transparent",
                        background: "linear-gradient(90deg,#047857,#0284c7)",
                        color: "#fff",
                        boxShadow: "0 6px 16px rgba(4,120,87,0.35)",
                      }
                    : {
                        borderColor: "var(--color-border)",
                        background: "transparent",
                        color: "inherit",
                      }
                }
                aria-pressed={selected}
              >
                Rs {v}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
          Minimum Rs {MIN_SUPPORT_RUPEES} per support.
        </p>

        <label className="mt-5 block text-sm font-bold" htmlFor="support-name">
          Your name <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(optional)</span>
        </label>
        <input
          id="support-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          className="mt-1 w-full rounded-2xl border-2 px-4 py-3 text-base outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20"
          style={{ borderColor: "var(--color-border)", background: "var(--color-input-bg)" }}
          placeholder="Anonymous supporter"
        />

        {error && (
          <p key={error} className="mc-shake mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              error
            </span>
            {error}
          </p>
        )}
        {message && (
          <p
            key={message}
            className="mc-pop mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold"
            style={{ color: "#047857", background: "var(--color-accent-soft)" }}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              check_circle
            </span>
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={support}
          disabled={busy}
          className="mc-support-btn mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-black text-white disabled:opacity-60"
        >
          {busy ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              Opening secure checkout…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-xl" aria-hidden="true">
                volunteer_activism
              </span>
              Support ExamArchive
              <span className="material-symbols-outlined text-xl" aria-hidden="true">
                arrow_forward
              </span>
            </>
          )}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            lock
          </span>
          Secured by Razorpay · One-time support · No account needed
        </p>
      </div>
    </div>
  );
}
