/**
 * Site-wide feature flags. This file must stay free of Node.js-only
 * imports (no node-appwrite, no next/cache) so it can be imported from
 * src/middleware.ts, which runs in the Edge runtime.
 */

// Temporary — set to false to re-enable the syllabus once all 517 papers are verified.
export const SYLLABUS_DISABLED = true;

// Monetag Banner zone ID. Create a Banner zone in Monetag for
// examarchive.dev and paste its zone ID here. Leave empty to hide all
// banner sections (BannerAd renders nothing while this is empty).
export const MONETAG_BANNER_ZONE_ID = "";
