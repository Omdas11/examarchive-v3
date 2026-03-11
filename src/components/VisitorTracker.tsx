"use client";

import { useEffect, useState } from "react";

/**
 * Silently records a unique visit and displays the running visitor count.
 * The count is stored in the `site_metrics` Appwrite collection.
 */
export default function VisitorTracker() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    async function track() {
      try {
        const res = await fetch("/api/visitor", {
          method: "POST",
          // If already counted, the server skips the increment (cookie check).
        });
        if (res.ok) {
          const data = await res.json() as { visitor_count?: number };
          if (typeof data.visitor_count === "number" && data.visitor_count > 0) {
            setCount(data.visitor_count);
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
      className="text-xs"
      style={{ color: "var(--color-text-muted)" }}
      title="Total unique site visitors since launch"
    >
      👁 {count.toLocaleString()} {count === 1 ? "visitor" : "visitors"} so far
    </span>
  );
}
