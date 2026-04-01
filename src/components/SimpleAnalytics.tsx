"use client";

import Script from "next/script";

/**
 * Simple Analytics loader gated by env configuration.
 * Requires NEXT_PUBLIC_SIMPLE_ANALYTICS_ENABLED === "true".
 */
export default function SimpleAnalytics() {
  const enabled = process.env.NEXT_PUBLIC_SIMPLE_ANALYTICS_ENABLED === "true";
  const hostname = process.env.NEXT_PUBLIC_SIMPLE_ANALYTICS_HOSTNAME;

  if (!enabled) return null;

  return (
    <>
      <Script
        id="simple-analytics"
        strategy="afterInteractive"
        src="https://scripts.simpleanalyticscdn.com/latest.js"
        data-hostname={hostname || undefined}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://queue.simpleanalyticscdn.com/noscript.gif"
          alt=""
          referrerPolicy="no-referrer-when-downgrade"
        />
      </noscript>
    </>
  );
}
