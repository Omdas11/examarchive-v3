import { NextResponse } from "next/server";
import { getProductsWithLivePricing, buildAffiliateLink } from "@/lib/amazon-products";

/**
 * GET /api/amazon-products
 *
 * Returns the curated Amazon affiliate product list.
 * When PA API credentials are configured (see AMAZON_AFFILIATE_SETUP.md)
 * each item includes a live `livePriceInPaise` and a PA API thumbnail URL.
 * Otherwise static fallback data is returned so the section always renders.
 *
 * Response is cached for 1 hour (CDN / ISR).
 */
export const revalidate = 3600;

export async function GET() {
  const products = await getProductsWithLivePricing();

  const payload = products.map((p) => ({
    asin: p.asin,
    title: p.title,
    category: p.category,
    priceInPaise: p.livePriceInPaise ?? p.staticPriceInPaise,
    isLivePrice: p.livePriceInPaise !== undefined,
    thumbnailUrl: p.thumbnailUrl,
    buyUrl: buildAffiliateLink(p.asin),
  }));

  return NextResponse.json(payload);
}
