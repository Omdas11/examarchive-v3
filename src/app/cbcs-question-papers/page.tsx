import type { Metadata } from "next";
import Link from "next/link";
import { adminDatabases, DATABASE_ID, COLLECTION } from "@/lib/appwrite";
import { Query } from "node-appwrite";
import { toPaper } from "@/types";
import PaperCard from "@/components/PaperCard";
import Breadcrumb from "@/components/Breadcrumb";

const SITE_URL = "https://www.examarchive.dev";

export const metadata: Metadata = {
  title: "CBCS Question Papers — Assam University Past Papers (Free PDF) | ExamArchive",
  description:
    "Download Assam University CBCS previous year question papers as free PDFs. Honours (HCC), Generic Elective & SEC papers from Haflong Government College.",
  keywords: [
    "cbcs question papers",
    "assam university cbcs question papers",
    "cbcs previous year question papers",
    "assam university cbcs pyq",
  ],
  openGraph: {
    title: "CBCS Question Papers — Assam University | ExamArchive",
    description: "Free PDF downloads of Assam University CBCS previous year question papers.",
    url: `${SITE_URL}/cbcs-question-papers`,
    type: "website",
  },
  alternates: { canonical: `${SITE_URL}/cbcs-question-papers` },
};

export default async function CbcsQuestionPapersPage() {
  let papers: ReturnType<typeof toPaper>[] = [];
  try {
    const db = adminDatabases();
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
      Query.equal("programme", "CBCS"),
      Query.equal("approved", true),
      Query.orderDesc("year"),
      Query.limit(48),
    ]);
    papers = res.documents.map(toPaper);
  } catch {
    papers = [];
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is CBCS?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CBCS (Choice Based Credit System) was the undergraduate pattern at Assam University before NEP 2020. Papers use codes like BNGHCC-501T (Honours Core), with CC, DSE, SEC, GE and AECC course types.",
        },
      },
      {
        "@type": "Question",
        name: "CBCS vs FYUG — which papers do I need?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "If you joined before 2022–23, you likely follow CBCS. From 2022–23, Assam University moved new admissions to FYUG (NEP 2020). Check your paper codes: HCC/DSE/GE codes are CBCS; DSC/DSM/SEC/IDC codes are FYUG.",
        },
      },
    ],
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "CBCS Question Papers" },
        ]}
      />
      <h1 className="mt-4 text-3xl font-bold">
        CBCS Question Papers — Assam University (Free PDF Download)
      </h1>
      <p className="mt-4 text-lg text-gray-700">
        Download <strong>Assam University CBCS previous year question papers</strong> as free PDFs.
        CBCS (Choice Based Credit System) papers — Honours Core (HCC), Discipline Specific Elective
        (DSE), Generic Elective (GE), Skill Enhancement (SEC) and Ability Enhancement (AECC) — from
        Haflong Government College across all 13 departments.
      </p>

      {papers.length > 0 && (
        <>
          <h2 className="mt-8 text-2xl font-semibold">CBCS Papers</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {papers.map((p) => (
              <PaperCard key={p.id} paper={p} />
            ))}
          </div>
        </>
      )}

      <p className="mt-8 text-gray-700">
        Also see:{" "}
        <Link href="/fyug-question-papers" className="text-blue-600 underline">
          FYUG question papers
        </Link>{" "}
        ·{" "}
        <Link href="/assam-university-question-papers" className="text-blue-600 underline">
          All Assam University question papers
        </Link>
      </p>
    </main>
  );
}
