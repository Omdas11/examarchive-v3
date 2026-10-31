"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { COOKIE_CONSENT_EVENT, getCookieConsent } from "@/lib/consent";

// Publisher ID from public/ads.txt (live since June 2026). This is the
// AdSense site-connection script Google asks for before a site review:
// it alone shows no ad units, and shows nothing at all until the account
// is approved. It loads only after the visitor accepts cookies.
const ADSENSE_CLIENT = "ca-pub-2814629639937169";

export default function AdSense() {
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    const refresh = () => setAccepted(getCookieConsent() === "accepted");
    refresh();
    window.addEventListener(COOKIE_CONSENT_EVENT, refresh);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, refresh);
  }, []);
  if (!accepted) return null;
  return (
    <Script
      id="adsense-script"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
