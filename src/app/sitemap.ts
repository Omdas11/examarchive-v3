import type { MetadataRoute } from "next";
import { adminDatabases, COLLECTION, DATABASE_ID, Query } from "@/lib/appwrite";

const SITE_URL = "https://www.examarchive.dev";

/**
 * Generates /sitemap.xml via Next.js Metadata API.
 * Static pages are listed directly; dynamic paper pages can be added here
 * once the database is queried in a real build.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/browse`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/upload`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/syllabus`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/support`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/ai-content`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  const dynamicRoutes: MetadataRoute.Sitemap = [];

  try {
    const db = adminDatabases();

    const [papersRes, syllabusTableRes] = await Promise.all([
      db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("approved", true),
        Query.orderDesc("$updatedAt"),
        Query.limit(500),
      ]),
      db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
        Query.orderDesc("$updatedAt"),
        Query.limit(1000),
      ]),
    ]);

    for (const doc of papersRes.documents) {
      const id = String(doc.$id ?? "");
      if (!id) continue;
      dynamicRoutes.push({
        url: `${SITE_URL}/paper/${encodeURIComponent(id)}`,
        lastModified: new Date(String(doc.$updatedAt ?? doc.$createdAt ?? Date.now())),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    const seenCodes = new Set<string>();
    for (const doc of syllabusTableRes.documents) {
      const code = String(doc.paper_code ?? "").trim().toUpperCase();
      if (!code || seenCodes.has(code)) continue;
      seenCodes.add(code);
      dynamicRoutes.push({
        url: `${SITE_URL}/syllabus/paper/${encodeURIComponent(code)}`,
        lastModified: new Date(String(doc.$updatedAt ?? doc.$createdAt ?? Date.now())),
        changeFrequency: "weekly",
        priority: 0.75,
      });
    }
  } catch {
    // Fallback to static routes when DB is unavailable at build/runtime.
  }

  return [...staticRoutes, ...dynamicRoutes];
}
