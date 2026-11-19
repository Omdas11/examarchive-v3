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
 * Support form: amount (min ₹20) + optional name → Razorpay Checkout.
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
      setError(`Minimum support is ₹${MIN_SUPPORT_RUPEES}.`);
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
        description: `Support the domain renewal — ₹${rupees}`,
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
    <div className="mt-3 rounded-2xl border p-5" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">
          {formatRupees(raisedPaise)} raised · {percent}%
        </span>
        <span style={{ color: "var(--color-text-muted)" }}>
          {donors} supporter{donors === 1 ? "" : "s"}
        </span>
      </div>

      <label className="mt-4 block text-sm font-semibold" htmlFor="support-amount">
        Amount (₹)
      </label>
      <input
        id="support-amount"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-base"
        style={{ borderColor: "var(--color-border)" }}
        placeholder="50"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(String(v))}
            className="rounded-full border px-3 py-1 text-sm font-semibold"
            style={{
              borderColor: "var(--color-border)",
              background: Number(amount) === v ? "#047857" : "transparent",
              color: Number(amount) === v ? "#fff" : "inherit",
            }}
          >
            ₹{v}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
        Minimum ₹{MIN_SUPPORT_RUPEES} per support.
      </p>

      <label className="mt-4 block text-sm font-semibold" htmlFor="support-name">
        Your name <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(optional)</span>
      </label>
      <input
        id="support-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-base"
        style={{ borderColor: "var(--color-border)" }}
        placeholder="Anonymous supporter"
      />

      {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      {message && <p className="mt-3 text-sm font-semibold" style={{ color: "#047857" }}>{message}</p>}

      <button
        type="button"
        onClick={support}
        disabled={busy}
        className="mt-4 w-full rounded-xl px-4 py-3 text-base font-bold text-white disabled:opacity-60"
        style={{ background: "#047857" }}
      >
        {busy ? "Please wait…" : "Support ExamArchive"}
      </button>
    </div>
  );
}
