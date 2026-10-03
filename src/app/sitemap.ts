import type { MetadataRoute } from "next";
import { adminDatabases, DATABASE_ID, COLLECTION } from "@/lib/appwrite";
import { Query } from "node-appwrite";

const SITE_URL = "https://www.examarchive.dev";

// Department landing pages for regional SEO (13 UG departments, PG excluded)
const DEPARTMENTS = [
  "assamese", "bengali", "botany", "chemistry", "commerce", "economics",
  "english", "history", "mathematics", "philosophy", "physics",
  "political-science", "zoology",
];

/**
 * Generates /sitemap.xml via Next.js Metadata API.
 * Includes static pages, department landing pages, and all approved papers.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/browse`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/syllabus`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.85 },
    { url: `${SITE_URL}/upload`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/ai-content`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/support`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  // Department landing pages (regional SEO)
  const deptRoutes: MetadataRoute.Sitemap = DEPARTMENTS.map((dept) => ({
    url: `${SITE_URL}/papers/${dept}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // All approved papers
  let paperRoutes: MetadataRoute.Sitemap = [];
  try {
    const db = adminDatabases();
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
      Query.equal("approved", true),
      Query.limit(500),
      Query.select(["$id", "$updatedAt"]),
    ]);
    paperRoutes = res.documents.map((doc) => ({
      url: `${SITE_URL}/paper/${doc.$id}`,
      lastModified: new Date(doc.$updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {
    // If DB is unreachable at build time, skip paper URLs
  }

  return [...staticRoutes, ...deptRoutes, ...paperRoutes];
}
