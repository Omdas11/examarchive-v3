import type { Paper } from "@/types";

const SITE_URL = "https://www.examarchive.dev";

export function buildPaperJsonLd(paper: Paper) {
  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: paper.title,
    description: `Past exam paper for ${paper.course_name ?? paper.course_code ?? "Haflong Government College students"}.`,
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
    },
    url: `${SITE_URL}/paper/${paper.id}`,
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
