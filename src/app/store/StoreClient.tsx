"use client";

import { useState } from "react";

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

export default function StoreClient({
  packs,
  currentCredits,
}: {
  packs: CreditPack[];
  currentCredits: number;
}) {
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 space-y-4">
      <div className="card p-6">
        <h1 className="text-2xl font-bold">Electron Store</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Current balance: {currentCredits}e</p>
      </div>

      {message && <div className="card p-4 text-sm text-green-700">{message}</div>}
      {error && <div className="card p-4 text-sm text-error">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        {packs.map((pack) => (
          <div key={pack.code} className="card p-5">
            <p className="text-lg font-bold">{pack.label}</p>
            <p className="text-sm text-on-surface-variant mt-1">₹{(pack.amountInPaise / 100).toFixed(0)}</p>
            <button
              type="button"
              className="btn-primary mt-4 w-full"
              onClick={() => void buyPack(pack.code)}
              disabled={loadingCode === pack.code}
            >
              {loadingCode === pack.code ? "Processing…" : "Buy"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
