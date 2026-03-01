import type { MetadataRoute } from "next";

/**
 * Generates /robots.txt via Next.js Metadata API.
 * Disallows admin and API routes from being indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: "https://examarchive.dev/sitemap.xml",
    host: "https://examarchive.dev",
  };
}
