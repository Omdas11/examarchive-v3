import type { Metadata } from "next";
import Link from "next/link";
import { adminDatabases, DATABASE_ID, COLLECTION } from "@/lib/appwrite";
import { Query } from "node-appwrite";
import { toPaper } from "@/types";
import PaperCard from "@/components/PaperCard";
import Breadcrumb from "@/components/Breadcrumb";

const SITE_URL = "https://www.examarchive.dev";

export const metadata: Metadata = {
  title: "FYUG Question Papers — Assam University Past Papers (Free PDF Download) | ExamArchive",
  description:
    "Download Assam University FYUG (Four-Year Undergraduate Programme) previous year question papers as free PDFs. NEP 2020 FYUGP papers — DSC, DSM, SEC, IDC, AEC, VAC — from Haflong Government College.",
  keywords: [
    "fyug past question paper",
    "fyug question papers",
    "assam university fyug question papers",
    "fyug previous year question papers",
    "nep fyug question paper pdf",
    "assam university fyug pyq",
  ],
  openGraph: {
    title: "FYUG Question Papers — Assam University | ExamArchive",
    description:
      "Free PDF downloads of Assam University FYUG previous year question papers (NEP 2020).",
    url: `${SITE_URL}/fyug-question-papers`,
    type: "website",
  },
  alternates: { canonical: `${SITE_URL}/fyug-question-papers` },
};

const FAQS = [
  {
    q: "What is FYUG?",
    a: "FYUG stands for Four-Year Undergraduate Programme, introduced under NEP 2020. Assam University adopted FYUG from the 2022–23 academic session, replacing the CBCS pattern for new admissions.",
  },
  {
    q: "How do I identify a FYUG question paper by its code?",
    a: "FYUG paper codes follow the pattern Subject+Type+Number, e.g. PHYDSC101T (Physics DSC, semester 1), BNGSEC401T (Bengali SEC, semester 4). The middle digits encode the semester: 101–109 = sem 1, 201–209 = sem 2, and so on.",
  },
  {
    q: "Are these FYUG papers free to download?",
    a: "Yes. Every paper on ExamArchive is a free PDF download — no login required to download.",
  },
  {
    q: "Which colleges do these FYUG papers come from?",
    a: "ExamArchive is starting with Haflong Government College (affiliated to Assam University, Silchar). More colleges will be added over time.",
  },
];

export default async function FyugQuestionPapersPage() {
  let papers: ReturnType<typeof toPaper>[] = [];
  try {
    const db = adminDatabases();
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
      Query.equal("programme", "FYUGP"),
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
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Assam University FYUG Question Papers",
    itemListElement: papers.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/paper/${p.id}`,
      name: `${p.course_code} ${p.title} (${p.year})`,
    })),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "FYUG Question Papers" },
        ]}
      />
      <h1 className="mt-4 text-3xl font-bold">
        FYUG Question Papers — Assam University (Free PDF Download)
      </h1>
      <p className="mt-4 text-lg text-gray-700">
        Download <strong>Assam University FYUG previous year question papers</strong> as free PDFs.
        FYUG (Four-Year Undergraduate Programme) is the NEP 2020 pattern adopted by Assam University,
        Silchar from 2022–23. Find FYUGP papers by subject — Physics, Chemistry, Bengali, English,
        Botany, Zoology, Mathematics, Economics, Political Science, Philosophy, History, Commerce
        and Assamese — from Haflong Government College.
      </p>

      <h2 className="mt-8 text-2xl font-semibold">Browse FYUG Papers by Department</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {["physics", "chemistry", "bengali", "english", "botany", "zoology", "mathematics", "economics", "political-science", "philosophy", "history", "commerce", "assamese"].map((dept) => (
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
          <h2 className="mt-8 text-2xl font-semibold">Latest FYUG Papers</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {papers.map((p) => (
              <PaperCard key={p.id} paper={p} />
            ))}
          </div>
        </>
      )}

      <h2 className="mt-10 text-2xl font-semibold">FYUG Paper Code Guide</h2>
      <p className="mt-2 text-gray-700">
        FYUG codes look like <code>PHYDSC101T</code>: the first 3 letters are the subject (PHY = Physics),
        the next 3 letters are the course type (DSC = Discipline Specific Core, DSM = Minor, SEC =
        Skill Enhancement, IDC = Interdisciplinary, AEC = Ability Enhancement, VAC = Value Added),
        the digits encode the semester (101 = 1st sem, 201 = 2nd sem…), and the final letter is T
        (Theory) or P (Practical).
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Frequently Asked Questions</h2>
      <div className="mt-4 space-y-4">
        {FAQS.map((f) => (
          <div key={f.q} className="rounded-lg border p-4">
            <h3 className="font-semibold">{f.q}</h3>
            <p className="mt-1 text-gray-700">{f.a}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-gray-700">
        Also see:{" "}
        <Link href="/cbcs-question-papers" className="text-blue-600 underline">
          CBCS question papers
        </Link>{" "}
        ·{" "}
        <Link href="/assam-university-question-papers" className="text-blue-600 underline">
          All Assam University question papers
        </Link>{" "}
        ·{" "}
        <Link href="/browse" className="text-blue-600 underline">
          Browse all papers
        </Link>
      </p>
    </main>
  );
}
