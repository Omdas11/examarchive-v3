import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import { derivePaperNameFromRows, toSyllabusTableRow } from "@/lib/syllabus-table";
import { toSyllabus, type Syllabus } from "@/types";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import { SYLLABUS_DEPARTMENTS } from "@/lib/syllabus-departments";

const SITE_URL = "https://www.examarchive.dev";

interface PaperSummary {
  code: string;
  name: string;
  units: number;
  lectures: number;
}

export async function generateStaticParams() {
  return Object.keys(SYLLABUS_DEPARTMENTS).map((department) => ({ department }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ department: string }>;
}): Promise<Metadata> {
  const { department } = await params;
  const info = SYLLABUS_DEPARTMENTS[department];
  if (!info) return { title: "Not Found" };
  const title = `Assam University ${info.name} Syllabus | ExamArchive`;
  return {
    title,
    description: info.blurb,
    keywords: info.keywords,
    openGraph: {
      title,
      description: info.blurb,
      url: `${SITE_URL}/syllabus/${department}`,
      type: "website",
    },
    alternates: { canonical: `/syllabus/${department}` },
  };
}

export default async function SyllabusDepartmentPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  const info = SYLLABUS_DEPARTMENTS[department];
  if (!info) notFound();

  const user = await getServerUser();
  const userName = user ? user.name || user.username || "Scholar" : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  const userIsAdmin = !!user && isAdmin(user.role);

  // ── Departmental syllabus PDF (one per department in the syllabus collection)
  let deptPdf: Syllabus | null = null;
  try {
    const db = adminDatabases();
    const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [
      Query.equal("approval_status", "approved"),
      Query.equal("department", info.name),
      Query.limit(1),
    ]);
    if (documents.length > 0) deptPdf = toSyllabus(documents[0] as Record<string, unknown>);
  } catch {
    // collection may not exist yet
  }

  // ── Syllabus-table papers for this department (subject = 3-letter code)
  const papers: PaperSummary[] = [];
  try {
    const db = adminDatabases();
    const grouped = new Map<string, ReturnType<typeof toSyllabusTableRow>[]>();
    let offset = 0;
    for (;;) {
      const res = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
        Query.equal("status", "published"),
        Query.equal("subject", info.subjectCode),
        Query.limit(500),
        Query.offset(offset),
      ]);
      for (const doc of res.documents) {
        const row = toSyllabusTableRow(doc as Record<string, unknown>);
        const code = row.paper_code.trim().toUpperCase();
        if (!code) continue;
        if (!grouped.has(code)) grouped.set(code, []);
        grouped.get(code)!.push(row);
      }
      if (res.documents.length < 500) break;
      offset += 500;
    }
    for (const [code, rows] of grouped.entries()) {
      papers.push({
        code,
        name: derivePaperNameFromRows(code, rows),
        units: new Set(rows.map((r) => r.unit_number)).size,
        lectures: rows.reduce(
          (sum, r) => sum + (typeof r.lectures === "number" ? r.lectures : 0),
          0,
        ),
      });
    }
    papers.sort((a, b) => a.code.localeCompare(b.code));
  } catch {
    // DB unreachable — page still renders with an empty list
  }

  const totalUnits = papers.reduce((sum, p) => sum + p.units, 0);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Where can I download the Assam University ${info.name} syllabus?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `ExamArchive offers the Assam University ${info.name} FYUG syllabus from Haflong Government College — ${papers.length} papers with unit-wise syllabus content, free to browse, with PDF downloads.`,
        },
      },
      {
        "@type": "Question",
        name: `Is the Haflong Government College ${info.name} syllabus free?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes, all ${papers.length} ${info.name} syllabus papers on ExamArchive are free to browse, covering the FYUGP programme.`,
        },
      },
    ],
  };

  return (
    <MainLayout
      title={`${info.name} Syllabus`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Syllabus", href: "/syllabus" },
        { label: info.name },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <section className="mx-auto w-full px-4 pb-16 pt-8" style={{ maxWidth: "var(--max-w)" }}>
        <div className="rounded-3xl border border-outline-variant/40 bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Syllabus Library
          </p>
          <h1 className="mt-2 text-3xl font-black text-on-surface">
            Assam University {info.name} Syllabus
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant">{info.blurb}</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            {papers.length} papers · {totalUnits} units · Haflong Government College · FYUGP
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/papers/${department}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
            >
              {info.name} Question Papers
            </Link>
            <Link
              href="/syllabus"
              className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/40 px-4 py-2 text-sm font-semibold text-on-surface"
            >
              All Departments
            </Link>
            {userIsAdmin && (
              <Link
                href="/upload?type=dept_syllabus"
                className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/40 px-4 py-2 text-sm font-semibold text-on-surface"
              >
                Upload Syllabus
              </Link>
            )}
          </div>
        </div>

        {deptPdf && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant/40 bg-surface p-4 shadow-sm">
            <div>
              <p className="text-sm font-bold text-on-surface">Official departmental syllabus (PDF)</p>
              <p className="text-xs text-on-surface-variant">
                {deptPdf.subject || deptPdf.course_name || info.name} · {deptPdf.programme || "FYUG"}
              </p>
            </div>
            <a
              href={deptPdf.file_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
            >
              View PDF
            </a>
          </div>
        )}

        <section aria-label={`${info.name} syllabus papers`} className="mt-8">
          <h2 className="text-xl font-bold text-on-surface">Papers ({papers.length})</h2>
          {papers.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {papers.map((p) => (
                <Link
                  key={p.code}
                  href={`/syllabus/paper/${department}/${p.code}`}
                  className="group flex flex-col gap-2 rounded-2xl border border-outline-variant/30 bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <p className="font-mono text-xs font-bold text-primary">{p.code}</p>
                  <p className="text-sm font-semibold leading-snug text-on-surface">{p.name}</p>
                  <p className="mt-auto text-xs text-on-surface-variant">
                    {p.units} unit{p.units !== 1 ? "s" : ""}
                    {p.lectures > 0 ? ` · ${p.lectures} lectures` : ""}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-on-surface-variant">
              No syllabus papers found for this department yet.{" "}
              <Link href="/syllabus" className="underline">
                Browse all departments
              </Link>
              .
            </p>
          )}
        </section>
      </section>
    </MainLayout>
  );
}
