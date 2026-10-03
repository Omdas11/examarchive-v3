import type { Metadata } from "next";
import Link from "next/link";
import { adminDatabases, DATABASE_ID, COLLECTION } from "@/lib/appwrite";
import { Query } from "node-appwrite";
import { toPaper } from "@/types";
import PaperCard from "@/components/PaperCard";
import Breadcrumb from "@/components/Breadcrumb";

const SITE_URL = "https://www.examarchive.dev";

export const metadata: Metadata = {
  title: "Assam University Question Papers — Past Papers Free PDF Download | ExamArchive",
  description:
    "Download Assam University previous year question papers as free PDFs. CBCS & FYUG papers from Haflong Government College — all 13 departments, semester-wise.",
  keywords: [
    "assam university past question papers",
    "assam university question papers",
    "assam university previous year question papers",
    "aus question paper pdf",
    "assam university pyq",
  ],
  openGraph: {
    title: "Assam University Question Papers | ExamArchive",
    description: "Free PDF downloads of Assam University previous year question papers.",
    url: `${SITE_URL}/assam-university-question-papers`,
    type: "website",
  },
  alternates: { canonical: `${SITE_URL}/assam-university-question-papers` },
};

const FAQS = [
  {
    q: "Where can I download Assam University previous year question papers?",
    a: "You can download them free as PDFs right here on ExamArchive. We archive question papers from Haflong Government College, affiliated to Assam University, Silchar — covering CBCS and FYUG programmes across 13 departments.",
  },
  {
    q: "Are Assam University question papers available programme-wise?",
    a: "Yes. Papers are tagged CBCS (pre-NEP pattern) or FYUGP (NEP 2020 Four-Year Undergraduate Programme, from 2022–23). Use the programme filter on the browse page.",
  },
  {
    q: "Do you have HS (higher secondary) papers too?",
    a: "We have a small set of HS papers (e.g. Bengali MIL). The archive focuses on undergraduate CBCS/FYUG papers.",
  },
  {
    q: "Is downloading free? Do I need an account?",
    a: "Downloads are completely free and don't require an account.",
  },
];

export default async function AssamUniversityPapersPage() {
  let papers: ReturnType<typeof toPaper>[] = [];
  try {
    const db = adminDatabases();
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
      Query.equal("approved", true),
      Query.orderDesc("$createdAt"),
      Query.limit(24),
    ]);
    papers = res.documents.map(toPaper);
  } catch {
    papers = [];
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Assam University Question Papers" },
        ]}
      />
      <h1 className="mt-4 text-3xl font-bold">
        Assam University Question Papers — Previous Year Papers (Free PDF)
      </h1>
      <p className="mt-4 text-lg text-gray-700">
        Download <strong>Assam University previous year question papers</strong> as free PDFs.
        ExamArchive is starting with <strong>Haflong Government College</strong> (affiliated to
        Assam University, Silchar) and covers all 13 undergraduate departments — Assamese, Bengali,
        Botany, Chemistry, Commerce, Economics, English, History, Mathematics, Philosophy, Physics,
        Political Science and Zoology — across both <strong>CBCS</strong> and{" "}
        <strong>FYUG</strong> programmes.
      </p>

      <h2 className="mt-8 text-2xl font-semibold">Browse by Programme</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/fyug-question-papers" className="rounded-lg border p-4 hover:bg-gray-50">
          <h3 className="font-semibold">FYUG Question Papers</h3>
          <p className="text-sm text-gray-600">NEP 2020 Four-Year Undergraduate Programme (2022 onwards)</p>
        </Link>
        <Link href="/cbcs-question-papers" className="rounded-lg border p-4 hover:bg-gray-50">
          <h3 className="font-semibold">CBCS Question Papers</h3>
          <p className="text-sm text-gray-600">Choice Based Credit System (pre-NEP pattern)</p>
        </Link>
      </div>

      <h2 className="mt-8 text-2xl font-semibold">Browse by Department</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {["assamese", "bengali", "botany", "chemistry", "commerce", "economics", "english", "history", "mathematics", "philosophy", "physics", "political-science", "zoology"].map((dept) => (
          <Link
            key={dept}
            href={`/papers/${dept}`}
            className="rounded-lg border p-3 text-center capitalize hover:bg-gray-50"
          >
            {dept.replace("-", " ")}
          </Link>
        ))}
      </div>

      {papers.length > 0 && (
        <>
          <h2 className="mt-8 text-2xl font-semibold">Recently Added Papers</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {papers.map((p) => (
              <PaperCard key={p.id} paper={p} />
            ))}
          </div>
        </>
      )}

      <h2 className="mt-10 text-2xl font-semibold">Frequently Asked Questions</h2>
      <div className="mt-4 space-y-4">
        {FAQS.map((f) => (
          <div key={f.q} className="rounded-lg border p-4">
            <h3 className="font-semibold">{f.q}</h3>
            <p className="mt-1 text-gray-700">{f.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
