import type { Paper } from "@/types";

const SITE_URL = "https://www.examarchive.dev";

export function buildPaperJsonLd(paper: Paper) {
  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: `${paper.title} (${paper.course_code ?? "Paper"}) - Assam University ${paper.year}`,
    description: `Assam University ${paper.title} question paper ${paper.year} from Haflong Government College. Free PDF download.`,
    author: {
      "@type": "Organization",
      name: "ExamArchive Community",
    },
    educationalLevel: "Undergraduate",
    inLanguage: "en",
    isPartOf: {
      "@type": "CollectionPage",
      name: "ExamArchive Past Papers",
      url: `${SITE_URL}/browse`,
    },
    about: {
      "@type": "Course",
      name: paper.course_name ?? paper.title,
      courseCode: paper.course_code ?? undefined,
      provider: {
        "@type": "CollegeOrUniversity",
        name: "Assam University",
      },
    },
    url: `${SITE_URL}/paper/${paper.id}`,
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; url?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
