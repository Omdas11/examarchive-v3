"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_SETTINGS_EVENT,
  getCookieConsent,
  setCookieConsent,
  type CookieConsentChoice,
} from "@/lib/consent";

/**
 * Cookie banner with Accept / Reject.
 *
 * - No choice yet: banner shows, and Google Analytics does not load.
 * - Accept: Google Analytics loads, and, once AdSense is approved,
 *   personalised ads may show.
 * - Reject: Google Analytics stays off, and no personalised ads.
 * The AdSense site-connection script itself is in the page head on
 * every page so Google can verify the site; the script alone shows
 * no ads and creates no ad units.
 * - Choice is stored in localStorage and can be changed any time from
 *   the "Cookie Settings" link in the footer.
 * Essential cookies (sign-in session, theme) are not gated: the site
 * cannot sign you in without them.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  const refresh = useCallback(() => {
    setVisible(getCookieConsent() === null);
  }, []);

  useEffect(() => {
    refresh();
    const onSettings = () => setVisible(true);
    const onChanged = () => refresh();
    window.addEventListener(COOKIE_SETTINGS_EVENT, onSettings);
    window.addEventListener(COOKIE_CONSENT_EVENT, onChanged);
    return () => {
      window.removeEventListener(COOKIE_SETTINGS_EVENT, onSettings);
      window.removeEventListener(COOKIE_CONSENT_EVENT, onChanged);
    };
  }, [refresh]);

  const choose = (choice: CookieConsentChoice) => {
    setCookieConsent(choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-3xl border border-outline-variant/20 bg-surface p-5 shadow-2xl"
    >
      <p className="text-sm font-bold text-on-surface">We use cookies</p>
      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
        ExamArchive uses essential cookies to keep you signed in. With your
        permission, we also use Google Analytics to understand which papers
        students use, and Google AdSense to show ads. You can reject and the
        site still works fully. See our{" "}
        <a href="/privacy" className="font-bold underline">
          Privacy Policy
        </a>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white"
        >
          Accept all
        </button>
        <button
          type="button"
          onClick={() => choose("rejected")}
          className="rounded-full border border-outline-variant/30 px-6 py-2.5 text-sm font-bold"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
