# Simple Analytics Setup Guide

This guide explains how to enable privacy-first pageview tracking with Simple Analytics.

## 1) Current Status in Codebase

- Script loader lives at `src/components/SimpleAnalytics.tsx`.
- Root layout mounts `<SimpleAnalytics />` in `src/app/layout.tsx`.
- Tracking only runs when `NEXT_PUBLIC_SIMPLE_ANALYTICS_ENABLED` is set to `"true"`.

## 2) Create Your Simple Analytics Site

1. Sign in at [Simple Analytics](https://simpleanalytics.com/) and add your domain (e.g., `examarchive.dev`).
2. In **Settings → Data**, note the **Hostname** you want to attribute traffic to.

## 3) Configure Environment Variables

Add the following to your hosting env or `.env.local`:

```bash
NEXT_PUBLIC_SIMPLE_ANALYTICS_ENABLED=true
# Optional: pin the hostname if you want to attribute preview URLs to a single domain
# NEXT_PUBLIC_SIMPLE_ANALYTICS_HOSTNAME=examarchive.dev
```

Deploy after updating environment variables. Keep the flag `false` for local development and CI.

## 4) Verify Tracking

- Load any page in production and confirm `https://scripts.simpleanalyticscdn.com/latest.js` returns 200.
- Check the Simple Analytics dashboard → Realtime to see pageviews arriving.
- Ensure no browser errors appear related to `simpleanalyticscdn.com`.

## 5) Coexisting With GA4

The site already supports GA4 via `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Running both is fine; Simple Analytics stays cookieless and lightweight while GA4 handles detailed events.

## 6) Operating Checklist

- [ ] `NEXT_PUBLIC_SIMPLE_ANALYTICS_ENABLED` set to `"true"` in production.
- [ ] (Optional) Hostname override set for preview environments.
- [ ] Realtime traffic visible after deploy.
- [ ] Privacy policy updated if needed to mention Simple Analytics.
