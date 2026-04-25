/**
 * Amazon affiliate products — static product catalogue + optional live-pricing
 * via Amazon Product Advertising API v5.
 *
 * Environment variables (all optional — see AMAZON_AFFILIATE_SETUP.md):
 *   AMAZON_AFFILIATE_TAG        – your Associates partner tag (e.g. examarchive-21)
 *   AMAZON_PA_API_ACCESS_KEY    – PA API access key (from Associates Central)
 *   AMAZON_PA_API_SECRET_KEY    – PA API secret key
 *   AMAZON_PA_API_MARKETPLACE   – default "www.amazon.in"
 *
 * Without PA API credentials the section still renders using static prices and
 * affiliate links.  Configure PA API to show live prices and thumbnails.
 */

import crypto from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────

export interface AmazonProduct {
  asin: string;
  title: string;
  category: string;
  /** Fallback price in paise shown when PA API is not configured or fails. */
  staticPriceInPaise: number;
  /** Live price in paise fetched from PA API — present only when configured. */
  livePriceInPaise?: number;
  /** Thumbnail URL — populated by PA API or a static CDN pattern. */
  thumbnailUrl: string;
}

// ── Env helpers ────────────────────────────────────────────────────────────

export function getAffiliateTag(): string {
  return process.env.AMAZON_AFFILIATE_TAG ?? "";
}

export function buildAffiliateLink(asin: string): string {
  const tag = getAffiliateTag();
  const base = `https://www.amazon.in/dp/${asin}`;
  return tag ? `${base}?tag=${tag}` : base;
}

/**
 * Static Amazon CDN thumbnail pattern — works for most standard products.
 * Replace with the PA API-provided URL once PA API is configured for higher
 * reliability.
 */
function staticThumbnail(asin: string): string {
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SL200_.jpg`;
}

// ── Curated product catalogue ──────────────────────────────────────────────
//
// Replace the placeholder ASINs below with real Amazon.in ASINs for your
// chosen products.  See AMAZON_AFFILIATE_SETUP.md § 4 for step-by-step
// instructions on finding ASINs and updating this list.

export const STATIC_AMAZON_PRODUCTS: AmazonProduct[] = [
  {
    asin: "B07DFBS5D7",
    title: "Casio FX-991EX ClassWiz Scientific Calculator",
    category: "Calculator",
    staticPriceInPaise: 189900,
    thumbnailUrl: staticThumbnail("B07DFBS5D7"),
  },
  {
    asin: "B01LYI79I5",
    title: "Apsara Platinum Extra Dark Pencils (pack of 10)",
    category: "Stationery",
    staticPriceInPaise: 8500,
    thumbnailUrl: staticThumbnail("B01LYI79I5"),
  },
  {
    asin: "B07V6XZZGK",
    title: "Classmate Pulse Spiral Notebook 200 Pages",
    category: "Notebook",
    staticPriceInPaise: 10900,
    thumbnailUrl: staticThumbnail("B07V6XZZGK"),
  },
  {
    asin: "B07M6XH1SQ",
    title: "Luxor Ball Pens Assorted (pack of 25)",
    category: "Stationery",
    staticPriceInPaise: 24900,
    thumbnailUrl: staticThumbnail("B07M6XH1SQ"),
  },
  {
    asin: "B082YNZK9X",
    title: "Staedtler Engineering Drawing Instrument Set",
    category: "Drawing",
    staticPriceInPaise: 89900,
    thumbnailUrl: staticThumbnail("B082YNZK9X"),
  },
  {
    asin: "B07V7SVVWQ",
    title: "Kokuyo Camlin Exam Pad A4",
    category: "Stationery",
    staticPriceInPaise: 22900,
    thumbnailUrl: staticThumbnail("B07V7SVVWQ"),
  },
];

// ── PA API v5 — AWS Signature V4 helper ───────────────────────────────────

function toHex(buffer: Buffer): string {
  return buffer.toString("hex");
}

function sha256(data: string): Buffer {
  return crypto.createHash("sha256").update(data, "utf8").digest();
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function signingKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256("AWS4" + secretKey, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

interface PaApiCredentials {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  marketplace: string;
}

interface PaApiItemResult {
  ASIN: string;
  Images?: {
    Primary?: {
      Medium?: { URL?: string };
    };
  };
  Offers?: {
    Listings?: Array<{
      Price?: { Amount?: number };
    }>;
  };
}

/**
 * Fetch live item data for the given ASINs from Amazon PA API v5.
 * Returns `null` on any error — callers should fall back to static data.
 */
async function fetchPaApiItems(
  asins: string[],
  creds: PaApiCredentials,
): Promise<PaApiItemResult[] | null> {
  const host = "webservices.amazon.in";
  const region = "us-east-1";
  const service = "ProductAdvertisingAPI";
  const target = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";
  const contentType = "application/json; charset=utf-8";

  const now = new Date();
  const amzDate =
    now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const payload = JSON.stringify({
    ItemIds: asins,
    Resources: [
      "Images.Primary.Medium",
      "ItemInfo.Title",
      "Offers.Listings.Price",
    ],
    PartnerTag: creds.partnerTag,
    PartnerType: "Associates",
    Marketplace: creds.marketplace,
  });

  const payloadHash = toHex(sha256(payload));

  // Canonical headers must be sorted alphabetically by header name
  const canonicalHeaders = [
    `content-encoding:amz-1.0`,
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-date:${amzDate}`,
    `x-amz-target:${target}`,
  ].join("\n") + "\n";

  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

  const canonicalRequest = [
    "POST",
    "/paapi5/getitems",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    toHex(sha256(canonicalRequest)),
  ].join("\n");

  const key = signingKey(creds.secretKey, dateStamp, region, service);
  const signature = toHex(hmacSha256(key, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${creds.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const res = await fetch(`https://${host}/paapi5/getitems`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "Content-Encoding": "amz-1.0",
        "Host": host,
        "X-Amz-Date": amzDate,
        "X-Amz-Target": target,
        "Authorization": authorization,
      },
      body: payload,
      // 8-second timeout so a slow PA API doesn't block the store page
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      ItemsResult?: { Items?: PaApiItemResult[] };
    };
    return data.ItemsResult?.Items ?? null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Return the product catalogue, enriched with live prices/thumbnails from
 * PA API when credentials are present.  Always returns usable data (static
 * fallback on any failure).
 */
export async function getProductsWithLivePricing(): Promise<AmazonProduct[]> {
  const accessKey = process.env.AMAZON_PA_API_ACCESS_KEY ?? "";
  const secretKey = process.env.AMAZON_PA_API_SECRET_KEY ?? "";
  const partnerTag = getAffiliateTag();
  const marketplace = process.env.AMAZON_PA_API_MARKETPLACE ?? "www.amazon.in";

  const products: AmazonProduct[] = STATIC_AMAZON_PRODUCTS.map((p) => ({ ...p }));

  if (!accessKey || !secretKey || !partnerTag) {
    return products;
  }

  const asins = products.map((p) => p.asin);
  const items = await fetchPaApiItems(asins, {
    accessKey,
    secretKey,
    partnerTag,
    marketplace,
  });

  if (!items) return products;

  const byAsin = new Map(items.map((item) => [item.ASIN, item]));

  return products.map((product) => {
    const item = byAsin.get(product.asin);
    if (!item) return product;

    const thumbnail = item.Images?.Primary?.Medium?.URL;
    const priceAmount = item.Offers?.Listings?.[0]?.Price?.Amount;
    const livePriceInPaise =
      typeof priceAmount === "number" && priceAmount > 0
        ? Math.round(priceAmount * 100)
        : undefined;

    return {
      ...product,
      thumbnailUrl: thumbnail ?? product.thumbnailUrl,
      livePriceInPaise,
    };
  });
}
