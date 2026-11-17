"use client";

import { useEffect, useRef } from "react";
import { MONETAG_BANNER_ZONE_ID } from "@/lib/site-flags";

/**
 * Banner ad section. Renders nothing while no Monetag Banner zone is
 * configured, so pages show no empty boxes and no "Advertisement" label
 * until a real banner tag is ready.
 *
 * SEO-safe by design:
 * - The ad loads via an async script (never render-blocking, and search
 *   engines do not index ad content loaded this way).
 * - The container reserves a fixed height so the ad loading cannot shift
 *   page content (no layout shift / CLS).
 * - The only indexable text is the short standard "Advertisement" label.
 *
 * The tag is appended with document.createElement in an effect (not as a
 * JSX <script> and not via innerHTML): React 19 hoists JSX <script>
 * elements to <head>, which would move the banner out of this section,
 * and scripts inserted via innerHTML never execute. Appending the element
 * loads and runs the tag in place, on first load and on client-side
 * navigation alike.
 */
export type BannerAdFormat = "leaderboard" | "rectangle";

const FORMAT_STYLE: Record<BannerAdFormat, { minHeight: number; maxWidth: number }> = {
  leaderboard: { minHeight: 90, maxWidth: 728 },
  rectangle: { minHeight: 250, maxWidth: 300 },
};

export default function BannerAd({ format = "leaderboard" }: { format?: BannerAdFormat }) {
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!MONETAG_BANNER_ZONE_ID || !slotRef.current) return;
    const slot = slotRef.current;
    // Monetag Banner tag. Same tag loader the site already uses for
    // Monetag (quge5.com/88/tag.min.js — the host from the removed
    // Multitag); the zone ID selects the Banner format configured in
    // the Monetag dashboard for examarchive.dev. If Monetag gives a
    // different tag URL for the Banner zone, replace the src here.
    const script = document.createElement("script");
    script.src = "https://quge5.com/88/tag.min.js";
    script.async = true;
    script.setAttribute("data-zone", MONETAG_BANNER_ZONE_ID);
    script.setAttribute("data-cfasync", "false");
    slot.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  if (!MONETAG_BANNER_ZONE_ID) return null;

  const { minHeight, maxWidth } = FORMAT_STYLE[format];

  return (
    <section
      aria-label="Advertisement"
      className="my-8 rounded-3xl border border-outline-variant/10 bg-surface px-4 py-3 shadow-sm"
    >
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
        Advertisement
      </p>
      <div
        ref={slotRef}
        className="mx-auto mt-2 flex w-full items-center justify-center overflow-hidden"
        style={{ minHeight, maxWidth }}
      />
    </section>
  );
}
