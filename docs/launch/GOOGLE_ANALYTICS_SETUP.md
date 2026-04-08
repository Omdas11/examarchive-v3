# Google Analytics Setup Guide (GA4)

This guide explains how to set up and use Google Analytics 4 for ExamArchive.

## 1. Current Status in Codebase

- GA script loading is already implemented in `src/components/GoogleAnalytics.tsx`.
- Root layout already mounts `<GoogleAnalytics />` in `src/app/layout.tsx`.
- Tracking activates only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is present.

## 2. Create GA4 Property

1. Open Google Analytics Admin.
2. Create a GA4 property for the production site domain.
3. Copy the **Measurement ID** (`G-XXXXXXXXXX`).
4. Add it to Vercel/hosting env:

   ```bash
   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

5. Redeploy and verify realtime traffic in GA4.

## 3. Recommended Event Taxonomy

Use these event names consistently for startup metrics:

## Acquisition / Activation
- `signup_started`
- `signup_completed`
- `login_completed`

## Core Student Usage
- `paper_viewed`
- `paper_downloaded`
- `paper_search_performed`
- `syllabus_viewed`

## Contribution Funnel
- `paper_upload_submitted`
- `paper_upload_pending_review`
- `paper_upload_approved`
- `paper_upload_rejected`

## AI Usage
- `ai_generation_started`
- `ai_generation_completed`
- `ai_generation_failed`
- `ai_chat_message_sent`
- `ai_pdf_exported`

## Growth / Gamification
- `referral_link_copied`
- `referral_signup_completed`
- `badge_unlocked`
- `tier_upgraded`

## Monetization Readiness
- `credits_pack_viewed`
- `credits_purchase_initiated`
- `credits_purchase_completed`
- `paywall_shown`

## 4. Minimal Event Helper Pattern

Add a small helper when introducing event calls:

```ts
export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (!gtag) return;
  gtag("event", name, params ?? {});
}
```

Usage example:

```ts
trackEvent("paper_downloaded", {
  paper_id: paperId,
  paper_code: paperCode,
  source: "paper_page",
});
```

## 5. GA4 Conversion Setup

Mark these as conversions in GA4:

- `signup_completed`
- `paper_downloaded`
- `paper_upload_submitted`
- `ai_generation_completed`
- `credits_purchase_completed` (when billing launches)

## 6. Dashboard Starter Metrics

Create one startup dashboard with:

- New users per week
- WAU / MAU
- Downloads per active user
- Upload approval rate
- AI generations per active user
- Referral-assisted signups

## 7. Operating Checklist

- [ ] Measurement ID configured in all environments.
- [ ] Realtime verification passed after deployment.
- [ ] Core events instrumented and visible in DebugView.
- [ ] Conversion events marked in GA4.
- [ ] Weekly KPI review cadence documented.
