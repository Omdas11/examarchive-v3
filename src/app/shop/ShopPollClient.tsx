"use client";

import { useEffect, useMemo, useState } from "react";
import { CONTACT_EMAILS } from "@/lib/contact-emails";

interface ShopProduct {
  key: string;
  name: string;
  description: string;
}

const PRICE_OPTIONS = [
  { key: "budget", label: "Budget" },
  { key: "standard", label: "Standard" },
  { key: "premium", label: "Premium" },
];

interface PollApiResponse {
  votes: Record<string, Record<string, number>>;
}

export default function ShopPollClient({ products }: { products: ShopProduct[] }) {
  const [votes, setVotes] = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [myVotes, setMyVotes] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ea_shop_poll_votes");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        setMyVotes(parsed);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadVotes = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/shop/poll", { cache: "no-store" });
        const data = (await res.json()) as PollApiResponse;
        if (!cancelled) setVotes(data.votes ?? {});
      } catch {
        if (!cancelled) setVotes({});
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadVotes();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalVotesByProduct = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const product of products) {
      const perOption = votes[product.key] ?? {};
      totals[product.key] = Object.values(perOption).reduce((sum, count) => sum + count, 0);
    }
    return totals;
  }, [products, votes]);

  const submitVote = async (productKey: string, optionKey: string) => {
    if (submittingKey) return;
    setSubmittingKey(productKey);
    try {
      await fetch("/api/shop/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: productKey, option: optionKey }),
      });

      const nextVotes = { ...myVotes, [productKey]: optionKey };
      setMyVotes(nextVotes);
      try {
        localStorage.setItem("ea_shop_poll_votes", JSON.stringify(nextVotes));
      } catch {
        // ignore storage errors
      }

      setVotes((prev) => ({
        ...prev,
        [productKey]: {
          ...(prev[productKey] ?? {}),
          [optionKey]: ((prev[productKey] ?? {})[optionKey] ?? 0) + 1,
        },
      }));
    } finally {
      setSubmittingKey(null);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {products.map((product) => {
        const totalVotes = totalVotesByProduct[product.key] ?? 0;
        const userChoice = myVotes[product.key];
        return (
          <article key={product.key} className="card p-5">
            <h2 className="text-base font-semibold">{product.name}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">{product.description}</p>
            <p className="mt-3 text-xs text-on-surface-variant">
              Community poll votes: {totalVotes}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PRICE_OPTIONS.map((option) => {
                const count = votes[product.key]?.[option.key] ?? 0;
                const isSelected = userChoice === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => submitVote(product.key, option.key)}
                    disabled={!!userChoice || submittingKey === product.key}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                      isSelected
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant text-on-surface"
                    }`}
                  >
                    {option.label} ({count})
                  </button>
                );
              })}
            </div>

            {userChoice ? (
              <p className="mt-3 text-xs text-primary">
                Your vote: {PRICE_OPTIONS.find((o) => o.key === userChoice)?.label}
              </p>
            ) : (
              <p className="mt-3 text-xs text-on-surface-variant">
                Vote once per product from this browser.
              </p>
            )}

            <a
              href={`mailto:${CONTACT_EMAILS.contact}?subject=${encodeURIComponent(`Shop interest: ${product.name}`)}`}
              className="inline-flex mt-4 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary"
            >
              Request Access
            </a>
          </article>
        );
      })}

      {isLoading && (
        <p className="sm:col-span-2 text-xs text-on-surface-variant">
          Loading latest vote totals…
        </p>
      )}
    </div>
  );
}
