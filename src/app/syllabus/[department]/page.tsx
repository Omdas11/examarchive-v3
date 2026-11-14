import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import {
  derivePaperNameFromRows,
  dedupeSyllabusRowsByUnit,
  normalizePaperCode,
  semesterForPaperCode,
  toSyllabusTableRow,
} from "@/lib/syllabus-table";
import { getAllSyllabusRows } from "@/lib/syllabus-cache";
import { toSyllabus, type Syllabus } from "@/types";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import MainLayout from "@/components/layout/MainLayout";
import CaptchaDownloadButton from "@/components/CaptchaDownloadButton";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import { SYLLABUS_DEPARTMENTS, syllabusDeptForSubjectValue } from "@/lib/syllabus-departments";

const SITE_URL = "https://www.examarchive.dev";

interface PaperSummary {
  code: string;
  name: string;
  units: number;
  lectures: number;
  type: string;
  semester: number;
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

  // ── Syllabus-table papers for this department. The `subject` field is
  // inconsistent in the data (Mathematics stores the code "MTM", the other
  // 12 departments store the full name like "Physics"), so resolve it
  // through syllabusDeptForSubjectValue instead of comparing to the code.
  // Uses the shared 7-day syllabus cache instead of re-reading the whole
  // department from Appwrite on every visit.
  const papers: PaperSummary[] = [];
  try {
    const grouped = new Map<string, ReturnType<typeof toSyllabusTableRow>[]>();
    const rows = await getAllSyllabusRows();
    for (const row of rows) {
      if (syllabusDeptForSubjectValue(String(row.subject ?? ""))?.slug !== info.slug) continue;
      // Group by the canonical code: "PHYSEC-101" and "PHYSEC101" are the
      // same paper stored under two spellings (see normalizePaperCode).
      const code = normalizePaperCode(row.paper_code);
      if (!code) continue;
      if (!grouped.has(code)) grouped.set(code, []);
      grouped.get(code)!.push(row);
    }
    for (const [code, rows] of grouped.entries()) {
      // Collapse raw code variants to one row per unit first: without this,
      // lectures would be double-counted for papers stored under two
      // spellings (e.g. "PHYSEC-101" + "PHYSEC101").
      const uniqueRows = dedupeSyllabusRowsByUnit(rows);
      papers.push({
        code,
        name: derivePaperNameFromRows(code, uniqueRows),
        units: new Set(uniqueRows.map((r) => r.unit_number)).size,
        lectures: uniqueRows.reduce(
          (sum, r) => sum + (typeof r.lectures === "number" ? r.lectures : 0),
          0,
        ),
        type: uniqueRows.map((r) => r.type.trim()).find((t) => t.length > 0) ?? "",
        semester: semesterForPaperCode(code),
      });
    }
    papers.sort((a, b) => a.code.localeCompare(b.code));
  } catch {
    // DB unreachable — page still renders with an empty list
  }

  const totalUnits = papers.reduce((sum, p) => sum + p.units, 0);

  // Papers grouped by semester (1-8); codes with no semester number last.
  const bySemester = new Map<number, PaperSummary[]>();
  for (const p of papers) {
    const key = p.semester > 0 ? p.semester : 0;
    if (!bySemester.has(key)) bySemester.set(key, []);
    bySemester.get(key)!.push(p);
  }
  const semesterKeys = [...bySemester.keys()].sort((a, b) => {
    if (a === 0) return 1;
    if (b === 0) return -1;
    return a - b;
  });

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
          <h1 className="mt-2 text-2xl font-black text-on-surface sm:text-3xl">
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
              <p className="text-sm text-on-surface-variant">
                {[deptPdf.subject || deptPdf.course_name || info.name, deptPdf.programme].filter(Boolean).join(" · ")}
              </p>
            </div>
            {deptPdf.file_url ? (
              <CaptchaDownloadButton
                fileId={deptPdf.file_id}
                fileUrl={deptPdf.file_url}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
              >
                View PDF
              </CaptchaDownloadButton>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-2xl bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface-variant">
                Departmental PDF not uploaded yet
              </span>
            )}
          </div>
        )}

        <section aria-label={`${info.name} syllabus papers`} className="mt-8">
          <h2 className="text-xl font-bold text-on-surface">Papers by semester ({papers.length})</h2>
          {papers.length > 0 ? (
            <>
              <nav aria-label="Semesters" className="mt-3 flex flex-wrap gap-2">
                {semesterKeys.map((sem) => (
                  <a
                    key={sem}
                    href={`#semester-${sem}`}
                    className="rounded-full border border-outline-variant/40 bg-surface px-3 py-1 text-xs font-bold text-on-surface"
                  >
                    {sem === 0 ? "Other" : `Semester ${sem}`} · {bySemester.get(sem)!.length}
                  </a>
                ))}
              </nav>
              {semesterKeys.map((sem) => (
                <div key={sem} id={`semester-${sem}`} className="mt-8 scroll-mt-24">
                  <h3 className="text-lg font-bold text-on-surface">
                    {sem === 0 ? "Other papers" : `Semester ${sem}`}{" "}
                    <span className="text-sm font-semibold text-on-surface-variant">
                      ({bySemester.get(sem)!.length} papers)
                    </span>
                  </h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {bySemester.get(sem)!.map((p) => (
                      <Link
                        key={p.code}
                        href={`/syllabus/paper/${department}/${p.code}`}
                        className="group flex flex-col gap-2 rounded-2xl border border-outline-variant/30 bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <p className="flex items-center gap-2 font-mono text-xs font-bold text-primary">
                          {p.code}
                          {p.type && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-sans text-[10px] font-black uppercase tracking-wider text-primary">
                              {p.type}
                            </span>
                          )}
                        </p>
                        <p className="text-sm font-semibold leading-snug text-on-surface">{p.name}</p>
                        <p className="mt-auto text-xs text-on-surface-variant">
                          {p.units} unit{p.units !== 1 ? "s" : ""}
                          {p.lectures > 0 ? ` · ${p.lectures} lectures` : ""}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </>
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
