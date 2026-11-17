/**
 * Site-wide feature flags. This file must stay free of Node.js-only
 * imports (no node-appwrite, no next/cache) so it can be imported from
 * src/middleware.ts, which runs in the Edge runtime.
 */

// Temporary — set to false to re-enable the syllabus once all 517 papers are verified.
export const SYLLABUS_DISABLED = true;

// Monetag Banner zone ID. "ExamArchive banner" (In-Page Push banner),
// zone 12285430, created 2026-11-17. Leave empty to hide all banner
// sections (BannerAd renders nothing while this is empty).
export const MONETAG_BANNER_ZONE_ID = "12285430";
