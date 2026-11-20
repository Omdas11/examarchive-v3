/**
 * Site-wide feature flags. This file must stay free of Node.js-only
 * imports (no node-appwrite, no next/cache) so it can be imported from
 * src/middleware.ts, which runs in the Edge runtime.
 */

// Temporary — set to false to re-enable the syllabus once all 517 papers are verified.
export const SYLLABUS_DISABLED = true;

// AI Notes maintenance — set to true to hide the generator for everyone
// except the founder while AI Notes is being upgraded (real papers +
// syllabus grounding). Founder bypasses it in the page and the API route.
// Set to false to open AI Notes to everyone again.
export const AI_NOTES_MAINTENANCE = true;

// Ads master switch — set to false to hide all ads (Monetag banners,
// Monetag verification meta, AdSense script) while keeping the code so
// ads can be turned back on by flipping this one flag. Owner asked
// 2026-11-18: ads are annoying for an early website.
export const ADS_ENABLED = false;

// Monetag Banner zone ID. "ExamArchive banner" (In-Page Push banner),
// zone 12285430, created 2026-11-17. Leave empty to hide all banner
// sections (BannerAd renders nothing while this is empty).
export const MONETAG_BANNER_ZONE_ID = "12285430";
