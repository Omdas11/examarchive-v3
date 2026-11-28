/**
 * Support pool ("Keep ExamArchive Alive") — shared constants.
 *
 * The site's only real bill is the domain: examarchive.dev renews at
 * ₹2,201.37/year, due 2027-01-27. Everything else is $0 (Cloudflare free
 * tier, Appwrite Education org). The pool's goal is exactly that renewal.
 * Minimum support is ₹20 — below that Razorpay's ~2% + GST fee eats the
 * donation and the bookkeeping isn't worth it.
 */
export const DOMAIN_COST_PAISE = 220137; // ₹2,201.37
export const DOMAIN_COST_RUPEES = 2201.37;
export const DOMAIN_RENEWAL_DATE = "27 Jan 2027";
export const MIN_SUPPORT_RUPEES = 20;
export const MAX_SUPPORT_RUPEES = 10000;
export const SUPPORT_STATS_KV_KEY = "support-stats-v1";
export const SUPPORT_STATS_KV_TTL_SECONDS = 300;

export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
