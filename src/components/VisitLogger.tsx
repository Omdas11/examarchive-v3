"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * VisitLogger — fire-and-forget page-view beacon for the site's own
 * visit log (see /api/log-visit). Mounted once in the root layout.
 *
 * Uses navigator.sendBeacon so logging never blocks navigation or
 * rendering. Fires on every client-side route change (pathname), plus
 * the initial page load. A ref guard prevents duplicate beacons for the
 * same path (e.g. React StrictMode double-effects in development).
 *
 * Note: only JavaScript-capable visitors are logged here — simple bots
 * that never run JS won't appear. GA4 remains the source for total
 * traffic; this log is for IP / session-level inspection.
 */
export default function VisitLogger() {
  const pathname = usePathname();
  const lastLogged = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastLogged.current === pathname) return;
    lastLogged.current = pathname;
    try {
      const payload = new Blob([JSON.stringify({ path: pathname })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/log-visit", payload);
    } catch {
      // Analytics must never break the page.
    }
  }, [pathname]);

  return null;
}
