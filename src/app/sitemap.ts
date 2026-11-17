import type { MetadataRoute } from "next";
import { getAllApprovedPapers } from "@/lib/papers-cache";
import { getAllSyllabusRows } from "@/lib/syllabus-cache";
import {
  SYLLABUS_DEPARTMENT_SLUGS,
  syllabusDeptForSubjectValue,
} from "@/lib/syllabus-departments";
import { normalizePaperCode } from "@/lib/syllabus-table";

const SITE_URL = "https://www.examarchive.dev";

// The sitemap itself is cached for a day: it only changes when papers are
// added, which is rare. (It used to run two uncached full-table scans —
// ~3,200 Appwrite reads — on EVERY hit, which burned most of the monthly
// database-read budget. It now reuses the cached paper + syllabus lists,
// so a sitemap hit costs zero fresh reads.)
export const revalidate = 86400;

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
 * ALL approved papers, and ALL syllabus papers from the syllabus table
 * (517 canonical paper codes; variant spellings of one paper share a
 * single URL). Paper + syllabus data come from the shared caches
 * (papers-cache, 24h; syllabus-cache, 7d), so this costs no fresh reads.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/browse`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/syllabus`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.85 },
    { url: `${SITE_URL}/ai-content`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/support`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/guides`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/notes`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/notes/phydsc401t`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/notes/phydsc402t`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/notes/phydsc403t`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/notes/chm-dsm-401`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
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
    const rows = await getAllSyllabusRows();
    const codes = new Map<string, string>();
    for (const row of rows) {
      // Canonical code: "PHYSEC-101" and "PHYSEC101" are one paper, so
      // the sitemap lists one URL per paper instead of one per spelling.
      const code = normalizePaperCode(String(row.paper_code ?? ""));
      if (!code || codes.has(code)) continue;
      // Match by code first, then by full name: only Mathematics stores
      // the 3-letter code ("MTM"); the other 12 departments store the
      // full name ("Physics", ...). The by-code-only lookup dropped all
      // but Mathematics, shrinking the sitemap from ~1,205 to ~736 URLs.
      const dept = syllabusDeptForSubjectValue(String(row.subject ?? ""));
      if (dept) codes.set(code, dept.slug);
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
    // If the cache is unreachable, skip syllabus paper URLs
  }

  // All approved papers
  const paperRoutes: MetadataRoute.Sitemap = [];
  try {
    const papers = await getAllApprovedPapers();
    for (const paper of papers) {
      paperRoutes.push({
        url: `${SITE_URL}/paper/${paper.id}`,
        lastModified: paper.created_at ? new Date(paper.created_at) : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      });
    }
  } catch {
    // If the cache is unreachable, skip paper URLs
  }

  return [...staticRoutes, ...deptRoutes, ...syllabusDeptRoutes, ...paperRoutes, ...syllabusPaperRoutes];
}
