"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import ElectronIcon from "@/components/ElectronIcon";
import { SupporterBadge } from "@/components/badges/AchievementBadges";
import { FREE_WEEKLY_CLAIM_ELECTRONS, type Pass } from "@/lib/payments";

// ── Types ────────────────────────────────────────────────────────────────────

type CreditPack = {
  code: string;
  label: string;
  credits: number;
  amountInPaise: number;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function rupees(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-lg font-bold text-on-surface mt-2">{children}</h2>
  );
}

function SectionSubtitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-on-surface-variant mt-0.5">{children}</p>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function StoreClient({
  packs,
  passes,
  currentCredits,
}: {
  packs: CreditPack[];
  passes: Pass[];
  currentCredits: number;
}) {
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Buy a credit pack via Razorpay ──────────────────────────────────────

  async function buyPack(packCode: string) {
    setLoadingCode(packCode);
    setError(null);
    setMessage(null);
    try {
      const createRes = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packCode }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Failed to create order");
      if (!window.Razorpay) throw new Error("Razorpay checkout failed to load.");

      const checkout = new window.Razorpay({
        key: createData.keyId,
        amount: createData.amount,
        currency: createData.currency,
        name: "ExamArchive",
        description: `Top up ${createData.pack?.label ?? ""}`,
        order_id: createData.orderId,
        handler: async (response: Record<string, unknown>) => {
          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                packCode,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error ?? "Payment verification failed");
            setMessage(verifyData.message ?? "Payment successful.");
            window.location.reload();
          } catch (verificationError) {
            setError(verificationError instanceof Error ? verificationError.message : "Payment verification failed");
            setLoadingCode(null);
          }
        },
        theme: { color: "#4f46e5" },
      });

      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoadingCode(null);
    }
  }

  // ── Free weekly claim (scaffold — backend pending) ──────────────────────

  async function claimFreeWeekly() {
    setLoadingCode("free_weekly");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/claim-weekly", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      setMessage(data.message ?? `Claimed ${FREE_WEEKLY_CLAIM_ELECTRONS}e successfully!`);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setLoadingCode(null);
    }
  }

  // ── Buy pass (scaffold — Razorpay subscription backend pending) ────────

  async function buyPass(passId: string, mode: "onetime" | "subscribe") {
    setLoadingCode(`${passId}_${mode}`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/razorpay/create-pass-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passId, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pass order creation failed — coming soon!");
      setMessage(data.message ?? "Pass activated!");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pass purchase coming soon!");
    } finally {
      setLoadingCode(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      {/* ── Balance header ── */}
      <div className="card p-6">
        <h1 className="text-2xl font-bold">Electron Store</h1>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
          style={{
            borderColor: "var(--electron-pill-border, #f59e0b66)",
            background: "var(--electron-pill-bg, #fffbeb)",
            color: "var(--electron-pill-fg, #b45309)",
          }}
        >
          <ElectronIcon size={16} />
          <span>{currentCredits}e balance</span>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          Each AI-generated PDF costs 10e. Top up below or claim your free weekly electrons.
        </p>
      </div>

      {message && <div className="card p-4 text-sm text-green-700 border border-green-200 bg-green-50">{message}</div>}
      {error && <div className="card p-4 text-sm text-error border border-red-200 bg-red-50">{error}</div>}

      {/* ── Free Weekly Claim ── */}
      <div>
        <SectionHeading>Free Weekly Claim</SectionHeading>
        <SectionSubtitle>Grab {FREE_WEEKLY_CLAIM_ELECTRONS}e for free every week — no payment needed.</SectionSubtitle>

        <div className="mt-4 card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0"
              style={{ background: "var(--electron-pill-bg, #fffbeb)", border: "1.5px solid var(--electron-pill-border, #f59e0b66)" }}
            >
              <ElectronIcon size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-on-surface">{FREE_WEEKLY_CLAIM_ELECTRONS}e</p>
              <p className="text-xs text-on-surface-variant">Resets every Monday · Free</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary w-full sm:w-auto"
            onClick={() => void claimFreeWeekly()}
            disabled={loadingCode === "free_weekly"}
          >
            {loadingCode === "free_weekly" ? "Claiming…" : "Claim Now"}
          </button>
        </div>
      </div>

      {/* ── Credit Packs ── */}
      <div>
        <SectionHeading>Electron Packs</SectionHeading>
        <SectionSubtitle>One-time top-up — more electrons, better value.</SectionSubtitle>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {packs.map((pack) => {
            const cost = pack.amountInPaise / pack.credits;
            return (
              <div key={pack.code} className="card p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <ElectronIcon size={18} className="text-amber-600" />
                  <p className="text-xl font-bold">{pack.label}</p>
                </div>
                <p className="text-2xl font-extrabold text-on-surface mt-1">{rupees(pack.amountInPaise)}</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {rupees(cost * 10)} per PDF · {(cost / 100).toFixed(2)} ₹/e
                </p>
                <button
                  type="button"
                  className="btn-primary mt-4 w-full"
                  onClick={() => void buyPack(pack.code)}
                  disabled={loadingCode === pack.code}
                >
                  {loadingCode === pack.code ? "Processing…" : "Buy"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Passes & Subscriptions ── */}
      <div>
        <SectionHeading>Passes &amp; Subscriptions</SectionHeading>
        <SectionSubtitle>Daily electron allowances — perfect for exam season.</SectionSubtitle>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {passes.map((pass) => {
            const isSupporter = pass.id === "supporter";

            return (
              <div
                key={pass.id}
                className={`card p-5 flex flex-col gap-3 relative overflow-hidden ${
                  isSupporter ? "border-amber-400/60" : ""
                }`}
                style={isSupporter ? { background: "linear-gradient(135deg, #fffbeb 0%, #fff 100%)" } : undefined}
              >
                {isSupporter && (
                  <div className="absolute top-3 right-3">
                    <SupporterBadge size={28} />
                  </div>
                )}

                <div>
                  <p className="font-bold text-on-surface text-base">{pass.label}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{pass.description}</p>
                </div>

                {/* Pricing */}
                <div className="flex flex-col gap-1 text-sm">
                  {isSupporter ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-extrabold">{rupees(pass.subscribedPaise)}</span>
                      <span className="text-on-surface-variant text-xs">/{pass.billingPeriod}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-extrabold">{rupees(pass.oneTimePaise)}</span>
                        <span className="text-on-surface-variant text-xs">one-time</span>
                      </div>
                      <div className="flex items-baseline gap-1 text-on-surface-variant">
                        <span className="font-semibold text-base">{rupees(pass.subscribedPaise)}</span>
                        <span className="text-xs">/{pass.billingPeriod} when subscribed</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Daily claim info */}
                {pass.dailyElectrons > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 w-fit">
                    <ElectronIcon size={12} className="text-amber-600" />
                    <span>{pass.dailyElectrons}e/day for {pass.durationDays} days</span>
                  </div>
                )}

                {/* Supporter perks */}
                {isSupporter && (
                  <ul className="text-xs text-on-surface-variant space-y-0.5 pl-1">
                    <li className="flex items-center gap-1.5">
                      <ElectronIcon size={11} className="text-amber-600 flex-shrink-0" />
                      <span>100e instant bonus</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <SupporterBadge size={11} />
                      <span>Exclusive Supporter Badge</span>
                    </li>
                  </ul>
                )}

                {/* Action buttons */}
                {isSupporter ? (
                  <button
                    type="button"
                    className="btn-primary mt-auto w-full"
                    onClick={() => void buyPass(pass.id, "subscribe")}
                    disabled={loadingCode === `${pass.id}_subscribe`}
                  >
                    {loadingCode === `${pass.id}_subscribe` ? "Processing…" : "Support Now"}
                  </button>
                ) : (
                  <div className="mt-auto flex flex-col gap-2">
                    <button
                      type="button"
                      className="btn-primary w-full"
                      onClick={() => void buyPass(pass.id, "onetime")}
                      disabled={loadingCode === `${pass.id}_onetime`}
                    >
                      {loadingCode === `${pass.id}_onetime` ? "Processing…" : `Buy Pass · ${rupees(pass.oneTimePaise)}`}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary w-full text-xs"
                      onClick={() => void buyPass(pass.id, "subscribe")}
                      disabled={loadingCode === `${pass.id}_subscribe`}
                    >
                      {loadingCode === `${pass.id}_subscribe`
                        ? "Processing…"
                        : `Subscribe · ${rupees(pass.subscribedPaise)}/${pass.billingPeriod}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
