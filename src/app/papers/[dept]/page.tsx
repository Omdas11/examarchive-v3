import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDatabases, DATABASE_ID, COLLECTION } from "@/lib/appwrite";
import { Query } from "node-appwrite";
import { toPaper } from "@/types";
import PaperCard from "@/components/PaperCard";
import Breadcrumb from "@/components/Breadcrumb";

const SITE_URL = "https://www.examarchive.dev";

interface DeptInfo {
  slug: string;
  name: string;
  blurb: string;
  keywords: string[];
}

const DEPARTMENTS: Record<string, DeptInfo> = {
  assamese: {
    slug: "assamese",
    name: "Assamese",
    blurb:
      "Assam University Assamese question papers — Sahitya, Bhasha Honours and FYUG papers from Haflong Government College. Free PDF downloads of previous year papers.",
    keywords: ["Assam University Assamese question papers", "Assamese honours previous year papers"],
  },
  bengali: {
    slug: "bengali",
    name: "Bengali",
    blurb:
      "Download Assam University Bengali question papers — Honours (HCC), FYUG (DSC), Generic Elective and MIL papers from Haflong Government College. Free PDFs of previous year Bengali exam papers.",
    keywords: ["Assam University Bengali question papers", "Bengali honours previous year papers", "BNGHCC question paper"],
  },
  english: {
    slug: "english",
    name: "English",
    blurb:
      "Assam University English question papers — British Poetry, Communication Skills, SEC and Honours papers from Haflong Government College. Free PDF downloads.",
    keywords: ["Assam University English question papers", "English honours previous year papers Assam"],
  },
  chemistry: {
    slug: "chemistry",
    name: "Chemistry",
    blurb:
      "Assam University Chemistry question papers — Organic, Inorganic, Physical Chemistry Honours and FYUG papers from Haflong Government College. Free PDFs.",
    keywords: ["Assam University Chemistry question papers", "Chemistry honours previous year papers"],
  },
  botany: {
    slug: "botany",
    name: "Botany",
    blurb:
      "Assam University Botany question papers — Plant Physiology, Genetics, Ecology Honours and FYUG papers from Haflong Government College. Free PDF downloads.",
    keywords: ["Assam University Botany question papers", "Botany honours previous year papers Assam"],
  },
  commerce: {
    slug: "commerce",
    name: "Commerce",
    blurb:
      "Assam University Commerce question papers — Accounting, Business Studies papers from Haflong Government College. Free PDF downloads of previous year papers.",
    keywords: ["Assam University Commerce question papers", "B.Com previous year papers Assam"],
  },
  physics: {
    slug: "physics",
    name: "Physics",
    blurb:
      "Assam University Physics question papers — Mathematical Physics, Mechanics, Quantum Mechanics Honours and FYUG papers. Free PDF downloads from Haflong Government College.",
    keywords: ["Assam University Physics question papers", "Physics honours previous year papers Assam"],
  },
  mathematics: {
    slug: "mathematics",
    name: "Mathematics",
    blurb:
      "Assam University Mathematics question papers — Algebra, Calculus, Differential Equations Honours and FYUG papers from Haflong Government College. Free PDFs.",
    keywords: ["Assam University Mathematics question papers", "Maths honours previous year papers"],
  },
  philosophy: {
    slug: "philosophy",
    name: "Philosophy",
    blurb:
      "Assam University Philosophy question papers — Logic, Ethics, Indian Philosophy papers from Haflong Government College. Free PDF downloads.",
    keywords: ["Assam University Philosophy question papers"],
  },
  economics: {
    slug: "economics",
    name: "Economics",
    blurb:
      "Assam University Economics question papers — Microeconomics, Macroeconomics FYUG papers from Haflong Government College. Free PDFs.",
    keywords: ["Assam University Economics question papers"],
  },
  history: {
    slug: "history",
    name: "History",
    blurb:
      "Assam University History question papers — Ancient, Medieval, Modern India and Assam History papers from Haflong Government College. Free PDF downloads.",
    keywords: ["Assam University History question papers", "Assam history question paper"],
  },
  "political-science": {
    slug: "political-science",
    name: "Political Science",
    blurb:
      "Assam University Political Science question papers — Political Theory, Indian Government papers from Haflong Government College. Free PDFs.",
    keywords: ["Assam University Political Science question papers"],
  },
  zoology: {
    slug: "zoology",
    name: "Zoology",
    blurb:
      "Assam University Zoology question papers — Animal Diversity, Physiology, Genetics Honours and FYUG papers from Haflong Government College. Free PDF downloads.",
    keywords: ["Assam University Zoology question papers", "Zoology honours previous year papers Assam"],
  },
  biotechnology: {
    slug: "biotechnology",
    name: "Biotechnology",
    blurb:
      "Assam University Biotechnology FYUG question papers from Haflong Government College. Free PDF downloads of previous year papers.",
    keywords: ["Assam University Biotechnology question papers", "Biotechnology FYUG previous year papers"],
  },
  education: {
    slug: "education",
    name: "Education",
    blurb:
      "Assam University Education FYUG question papers from Haflong Government College. Free PDF downloads of previous year papers.",
    keywords: ["Assam University Education question papers", "Education FYUG previous year papers Assam"],
  },
  "fish-and-fisheries": {
    slug: "fish-and-fisheries",
    name: "Fish & Fisheries",
    blurb:
      "Assam University Fish & Fisheries FYUG question papers from Haflong Government College. Free PDF downloads of previous year papers.",
    keywords: ["Assam University Fish Fisheries question papers", "Fisheries FYUG previous year papers"],
  },
  "library-science": {
    slug: "library-science",
    name: "Library Science",
    blurb:
      "Assam University Library Science FYUG question papers from Haflong Government College. Free PDF downloads of previous year papers.",
    keywords: ["Assam University Library Science question papers", "Library Science FYUG previous year papers"],
  },
  manipuri: {
    slug: "manipuri",
    name: "Manipuri",
    blurb:
      "Assam University Manipuri FYUG question papers from Haflong Government College. Free PDF downloads of previous year papers.",
    keywords: ["Assam University Manipuri question papers", "Manipuri FYUG previous year papers"],
  },
  persian: {
    slug: "persian",
    name: "Persian",
    blurb:
      "Assam University Persian FYUG question papers from Haflong Government College. Free PDF downloads of previous year papers.",
    keywords: ["Assam University Persian question papers", "Persian FYUG previous year papers"],
  },
  sanskrit: {
    slug: "sanskrit",
    name: "Sanskrit",
    blurb:
      "Assam University Sanskrit FYUG question papers from Haflong Government College. Free PDF downloads of previous year papers.",
    keywords: ["Assam University Sanskrit question papers", "Sanskrit FYUG previous year papers Assam"],
  },
  vac: {
    slug: "vac",
    name: "VAC",
    blurb:
      "Assam University Value Added Course (VAC) FYUG question papers from Haflong Government College. Free PDF downloads of previous year papers.",
    keywords: ["Assam University VAC question papers", "Value Added Course FYUG previous year papers"],
  },
};

export async function generateStaticParams() {
  return Object.keys(DEPARTMENTS).map((dept) => ({ dept }));
}

export async function generateMetadata({ params }: { params: Promise<{ dept: string }> }): Promise<Metadata> {
  const { dept } = await params;
  const info = DEPARTMENTS[dept];
  if (!info) return { title: "Not Found" };
  const title = `Assam University ${info.name} Question Papers | ExamArchive`;
  return {
    title,
    description: info.blurb,
    keywords: info.keywords,
    openGraph: { title, description: info.blurb, url: `${SITE_URL}/papers/${dept}`, type: "website" },
    alternates: { canonical: `/papers/${dept}` },
  };
}

export default async function DepartmentPage({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  const info = DEPARTMENTS[dept];
  if (!info) notFound();

  let papers: ReturnType<typeof toPaper>[] = [];
  try {
    const db = adminDatabases();
    // Server-side department filter (paginated) — the old limit(100) fetch
    // silently dropped papers from large departments as the archive grew.
    let offset = 0;
    for (;;) {
      const res = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("approved", true),
        Query.equal("department", info.name),
        Query.limit(500),
        Query.offset(offset),
      ]);
      papers.push(...res.documents.map(toPaper));
      if (res.documents.length < 500) break;
      offset += 500;
    }
    papers.sort((a, b) => b.year - a.year);
  } catch {
    // DB unreachable
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Where can I download Assam University ${info.name} question papers?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `ExamArchive offers free PDF downloads of Assam University ${info.name} previous year question papers from Haflong Government College, covering both CBCS and FYUGP programmes.`,
        },
      },
      {
        "@type": "Question",
        name: `Are Haflong Government College ${info.name} papers free?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes, all ${papers.length} ${info.name} question papers on ExamArchive are free to download as PDFs, no sign-up required for browsing.`,
        },
      },
    ],
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Browse", href: "/browse" }, { label: info.name }]} />

      <header className="mt-6 mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Assam University {info.name} Question Papers
        </h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400 max-w-3xl leading-relaxed">{info.blurb}</p>
        <p className="mt-2 text-sm text-neutral-500">
          {papers.length} papers · Haflong Government College · CBCS & FYUGP
        </p>
      </header>

      <section aria-label={`${info.name} papers`}>
        {papers.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {papers.map((p) => (
              <PaperCard key={p.id} paper={p} />
            ))}
          </div>
        ) : (
          <p className="text-neutral-500">No papers found. <Link href="/browse" className="underline">Browse all papers</Link>.</p>
        )}
      </section>

      <section className="mt-12 prose dark:prose-invert max-w-3xl" aria-label="About">
        <h2>About {info.name} Papers at Haflong Government College</h2>
        <p>
          Haflong Government College, affiliated with Assam University Silchar, offers {info.name} under
          both the CBCS (Choice Based Credit System) and FYUGP (Four Year Undergraduate Programme) curricula.
          This archive collects previous year question papers to help students prepare for semester exams.
        </p>
        <h3>Frequently Asked Questions</h3>
        <h4>Where can I download Assam University {info.name} question papers?</h4>
        <p>Right here — every paper above is a free PDF download, no account needed to browse.</p>
        <h4>Do you have both CBCS and FYUG papers?</h4>
        <p>Yes. Use the FYUGP/CBCS filter on the browse page to narrow by programme.</p>
      </section>
    </main>
  );
}
