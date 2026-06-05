"use client";

import { useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import CreditIcon from "@/components/CreditIcon";

// ── Types ────────────────────────────────────────────────────────────────────

type CreditPack = {
  code: string;
  label: string;
  credits: number;
  amountInPaise: number;
};

type AmazonProductItem = {
  asin: string;
  title: string;
  category: string;
  priceInPaise: number;
  isLivePrice: boolean;
  thumbnailUrl: string;
  buyUrl: string;
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
  currentCredits,
  amazonProducts,
}: {
  packs: CreditPack[];
  currentCredits: number;
  amazonProducts: AmazonProductItem[];
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

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      {/* ── Balance header ── */}
      <div className="card p-6">
        <h1 className="text-2xl font-bold">Credit Store</h1>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
          style={{
            borderColor: "var(--color-primary-soft, #d3273e33)",
            background: "var(--color-surface, #fff)",
            color: "var(--color-primary, #d3273e)",
          }}
        >
          <CreditIcon size={16} />
          <span>₹{currentCredits} balance</span>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          AI-generated PDFs are experimental and cost 10 credits per generation. The platform remains free for everyone.
        </p>
      </div>

      {message && <div className="card p-4 text-sm text-green-700 border border-green-200 bg-green-50">{message}</div>}
      {error && <div className="card p-4 text-sm text-error border border-red-200 bg-red-50">{error}</div>}

      {/* ── Credit Packs ── */}
      <div>
        <SectionHeading>Credit Packs</SectionHeading>
        <SectionSubtitle>One-time top-up — more credits, higher discount.</SectionSubtitle>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {packs.map((pack) => {
            const nominalValuePaise = pack.credits * 100;
            const discountPct = Math.round(((nominalValuePaise - pack.amountInPaise) / nominalValuePaise) * 100);
            return (
              <div key={pack.code} className="card p-5 flex flex-col relative overflow-hidden">
                {discountPct > 0 && (
                  <div className="absolute top-0 right-0 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl">
                    {discountPct}% OFF
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <CreditIcon size={18} className="text-primary" />
                  <p className="text-xl font-bold">{pack.label}</p>
                </div>
                <div className="mt-1">
                  <p className="text-2xl font-extrabold text-on-surface">{rupees(pack.amountInPaise)}</p>
                  {discountPct > 0 && (
                    <p className="text-xs text-on-surface-variant line-through opacity-60">
                      {rupees(nominalValuePaise)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-primary mt-4 w-full"
                  onClick={() => void buyPack(pack.code)}
                  disabled={loadingCode === pack.code}
                >
                  {loadingCode === pack.code ? "Processing…" : "Buy Now"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Amazon Study Materials ── */}
      {amazonProducts.length > 0 && (
        <div>
          <SectionHeading>📚 Study Materials</SectionHeading>
          <SectionSubtitle>
            Handpicked supplies for students — purchased via Amazon.
          </SectionSubtitle>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {amazonProducts.map((product) => (
              <a
                key={product.asin}
                href={product.buyUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                {/* Thumbnail */}
                <div className="relative h-32 w-full bg-gray-50 rounded overflow-hidden flex items-center justify-center">
                  {product.thumbnailUrl ? (
                    <Image
                      src={product.thumbnailUrl}
                      alt={product.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-contain p-2"
                      unoptimized
                    />
                  ) : (
                    <span className="text-3xl select-none">🛍️</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                    {product.category}
                  </p>
                  <p className="text-sm font-medium text-on-surface mt-0.5 line-clamp-2">
                    {product.title}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-base font-extrabold text-on-surface">
                      {rupees(product.priceInPaise)}
                    </span>
                    {product.isLivePrice && (
                      <span className="text-[10px] text-green-600 font-semibold bg-green-50 border border-green-200 rounded px-1 py-0.5">
                        Live
                      </span>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-auto">
                  <span className="block text-center text-xs font-semibold text-white bg-[#FF9900] hover:bg-[#e8890c] rounded px-3 py-1.5 transition-colors">
                    Buy from Amazon →
                  </span>
                </div>
              </a>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-on-surface-variant text-center">
            ExamArchive may earn a small commission from qualifying purchases at no extra cost to you.
          </p>
        </div>
      )}
    </section>
  );
}
