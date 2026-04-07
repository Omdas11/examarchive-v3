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

export function buildPaperBreadcrumbJsonLd(paper: Paper) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Browse",
        item: `${SITE_URL}/browse`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: paper.course_code ?? paper.title,
        item: `${SITE_URL}/paper/${paper.id}`,
      },
    ],
  };
}

export function buildSyllabusJsonLd(args: {
  paperCode: string;
  paperName: string;
  university: string;
  urlPath: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: args.paperName,
    courseCode: args.paperCode,
    provider: {
      "@type": "Organization",
      name: args.university || "ExamArchive Community",
    },
    educationalLevel: "Undergraduate",
    url: `${SITE_URL}${args.urlPath}`,
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
