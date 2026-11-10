import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.examarchive.dev";

/**
 * Generates /robots.txt via the Next.js Metadata API.
 * Allows all crawlers to index public pages while blocking
 * admin, API, devtool, and personal settings pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/devtool", "/settings"],
      },
      // Aggressive SEO crawlers: kept out (advisory — good bots obey it).
      // Googlebot and Bingbot are NOT listed, so they keep indexing.
      // AI assistants (ClaudeBot, GPTBot, CCBot) are allowed in — they read
      // the site and cite it, which is free promotion.
      {
        userAgent: [
          "AhrefsBot",
          "SemrushBot",
          "MJ12bot",
          "DotBot",
          "PetalBot",
          "Bytespider",
          "YandexBot",
        ],
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
