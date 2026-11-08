import type { MetadataRoute } from "next";
import { adminDatabases, DATABASE_ID, COLLECTION } from "@/lib/appwrite";
import { Query } from "node-appwrite";
import {
  SYLLABUS_DEPARTMENT_SLUGS,
  syllabusDeptBySubjectCode,
} from "@/lib/syllabus-departments";
import { normalizePaperCode } from "@/lib/syllabus-table";

const SITE_URL = "https://www.examarchive.dev";

// Department landing pages for regional SEO (all departments with papers)
const DEPARTMENTS = [
  "assamese",
  "bengali",
  "biotechnology",
  "botany",
  "chemistry",
  "commerce",
  "economics",
  "education",
  "english",
  "fish-and-fisheries",
  "history",
  "library-science",
  "manipuri",
  "mathematics",
  "persian",
  "philosophy",
  "physics",
  "political-science",
  "sanskrit",
  "vac",
  "zoology",
];

/**
 * Generates /sitemap.xml via Next.js Metadata API.
 * Includes static pages, department landing pages (/papers + /syllabus),
 * ALL approved papers (paginated — the collection exceeds a single query
 * page), and ALL syllabus papers from the syllabus table (506 canonical
 * paper codes; variant spellings of one paper share a single URL).
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
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/guides`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/fyug-question-papers`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/assam-university-question-papers`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/cbcs-question-papers`, lastModified: new Date(), changeFrequency: "daily", priority: 0.85 },
  ];

  // Department landing pages (regional SEO)
  const deptRoutes: MetadataRoute.Sitemap = DEPARTMENTS.map((dept) => ({
    url: `${SITE_URL}/papers/${dept}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Syllabus department pages (13 HGC departments)
  const syllabusDeptRoutes: MetadataRoute.Sitemap = SYLLABUS_DEPARTMENT_SLUGS.map((slug) => ({
    url: `${SITE_URL}/syllabus/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // All syllabus papers from the syllabus table (distinct paper codes,
  // grouped under their department: /syllabus/paper/<dept>/<code>)
  const syllabusPaperRoutes: MetadataRoute.Sitemap = [];
  try {
    const db = adminDatabases();
    const codes = new Map<string, string>();
    let offset = 0;
    for (;;) {
      const res = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
        Query.equal("status", "published"),
        Query.limit(500),
        Query.offset(offset),
        Query.select(["paper_code", "subject"]),
      ]);
      for (const doc of res.documents) {
        // Canonical code: "PHYSEC-101" and "PHYSEC101" are one paper, so
        // the sitemap lists one URL per paper instead of one per spelling.
        const code = normalizePaperCode(String(doc.paper_code ?? ""));
        if (!code || codes.has(code)) continue;
        const dept = syllabusDeptBySubjectCode(String(doc.subject ?? ""));
        if (dept) codes.set(code, dept.slug);
      }
      if (res.documents.length < 500) break;
      offset += 500;
    }
    for (const [code, slug] of codes) {
      syllabusPaperRoutes.push({
        url: `${SITE_URL}/syllabus/paper/${slug}/${code}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      });
    }
  } catch {
    // If DB is unreachable at build time, skip syllabus paper URLs
  }

  // All approved papers — paginated so none are dropped as the archive grows
  const paperRoutes: MetadataRoute.Sitemap = [];
  try {
    const db = adminDatabases();
    let offset = 0;
    for (;;) {
      const res = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("approved", true),
        Query.limit(500),
        Query.offset(offset),
        Query.select(["$id", "$updatedAt"]),
      ]);
      for (const doc of res.documents) {
        paperRoutes.push({
          url: `${SITE_URL}/paper/${doc.$id}`,
          lastModified: new Date(doc.$updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.7,
        });
      }
      if (res.documents.length < 500) break;
      offset += 500;
    }
  } catch {
    // If DB is unreachable at build time, skip paper URLs
  }

  return [...staticRoutes, ...deptRoutes, ...syllabusDeptRoutes, ...paperRoutes, ...syllabusPaperRoutes];
}
