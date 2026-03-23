"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ea_visitor_count";

/**
 * Silently records a unique visit and displays the running visitor count.
 * The count is stored in the `site_metrics` Appwrite collection.
 */
export default function VisitorTracker() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    async function track() {
      try {
        if (typeof window !== "undefined") {
          const cached = window.sessionStorage.getItem(STORAGE_KEY);
          if (cached !== null) {
            const parsed = Number(cached);
            if (!Number.isNaN(parsed)) {
              setCount(parsed);
              return;
            }
          }
        }

        const res = await fetch("/api/visitor", {
          method: "POST",
          // If already counted, the server skips the increment (cookie check).
        });
        if (res.ok) {
          const data = await res.json() as { visitor_count?: number };
          if (typeof data.visitor_count === "number" && data.visitor_count >= 0) {
            setCount(data.visitor_count);
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(STORAGE_KEY, String(data.visitor_count));
            }
          }
        }
      } catch {
        // Non-critical — silently ignore
      }
    }
    track();
  }, []);

  if (!count) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      style={{ color: "var(--color-text-muted)" }}
      title="Total unique site visitors since launch"
    >
      {/* Eye SVG */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      {count.toLocaleString()} {count === 1 ? "visitor" : "visitors"} so far
    </span>
  );
}
