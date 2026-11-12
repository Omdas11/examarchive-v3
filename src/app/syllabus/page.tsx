import type { Metadata } from "next";
import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import { SYLLABUS_DEPARTMENTS, SYLLABUS_DEPARTMENT_SLUGS } from "@/lib/syllabus-departments";
import { normalizePaperCode } from "@/lib/syllabus-table";
import { getAllSyllabusRows } from "@/lib/syllabus-cache";

export const metadata: Metadata = {
  title: "Syllabus Library by Department | ExamArchive",
  description:
    "Browse Assam University FYUG syllabus by department — 13 departments from Haflong Government College, 500+ papers with unit-wise syllabus content and free PDF downloads.",
  keywords: [
    "syllabus library",
    "Assam University syllabus",
    "FYUGP syllabus",
    "Haflong Government College syllabus",
    "department syllabus",
  ],
  alternates: { canonical: "/syllabus" },
  openGraph: {
    title: "Syllabus Library | ExamArchive",
    description:
      "Assam University FYUG syllabus by department — 13 departments, 500+ papers, unit-wise content and free PDF downloads.",
    url: "https://www.examarchive.dev/syllabus",
    type: "website",
  },
};

interface DeptCounts {
  papers: number;
  units: number;
}

export default async function SyllabusPage() {
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  const userIsAdmin = !!user && isAdmin(user.role);

  // ── Per-department counts from the syllabus table (2,789 published rows;
  // codes are canonicalised, so "PHYSEC-101" + "PHYSEC101" count once).
  // Uses the shared 7-day syllabus cache instead of re-reading all 2,789
  // rows from Appwrite on every visit.
  const counts = new Map<string, DeptCounts>();
  try {
    // subject -> paper code -> distinct unit numbers
    const bySubject = new Map<string, Map<string, Set<number>>>();
    const rows = await getAllSyllabusRows();
    for (const row of rows) {
      const subject = String(row.subject ?? "").trim().toUpperCase();
      // Canonical code: "PHYSEC-101" and "PHYSEC101" are one paper, not two.
      const code = normalizePaperCode(String(row.paper_code ?? ""));
      if (!subject || !code) continue;
      if (!bySubject.has(subject)) bySubject.set(subject, new Map());
      const papers = bySubject.get(subject)!;
      if (!papers.has(code)) papers.set(code, new Set());
      papers.get(code)!.add(Number(row.unit_number ?? 0));
    }
    for (const [subject, papers] of bySubject.entries()) {
      let units = 0;
      for (const unitSet of papers.values()) units += unitSet.size;
      counts.set(subject, { papers: papers.size, units });
    }
  } catch {
    // DB unreachable — directory still renders with zero counts
  }

  const totalPapers = Array.from(counts.values()).reduce((sum, c) => sum + c.papers, 0);

  return (
    <MainLayout
      title="Syllabus Library"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Syllabus" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto w-full px-4 pb-16 pt-8" style={{ maxWidth: "var(--max-w)" }}>
        <div className="rounded-3xl border border-outline-variant/40 bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Syllabus Library
          </p>
          <h1 className="mt-2 text-3xl font-black text-on-surface">
            Haflong Government College Syllabus by Department
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
            FYUG syllabus from Haflong Government College, organised by department. Pick a
            department to see its papers with unit-wise syllabus content, or download the
            official departmental syllabus PDF.
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            13 departments · {totalPapers} papers · Assam University · FYUGP
          </p>
          {userIsAdmin && (
            <div className="mt-5">
              <Link
                href="/upload?type=dept_syllabus"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
              >
                Upload Syllabus
              </Link>
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SYLLABUS_DEPARTMENT_SLUGS.map((slug) => {
            const info = SYLLABUS_DEPARTMENTS[slug];
            const c = counts.get(info.subjectCode);
            return (
              <Link
                key={slug}
                href={`/syllabus/${slug}`}
                className="group flex flex-col gap-2 rounded-2xl border border-outline-variant/30 bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <p className="text-lg font-bold text-on-surface">{info.name}</p>
                <p className="text-sm leading-relaxed text-on-surface-variant">{info.blurb}</p>
                <p className="mt-auto pt-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all group-hover:opacity-90" style={{ background: "var(--color-primary)" }}>
                    {c ? `${c.papers} papers · ${c.units} units` : "View syllabus"} →
                  </span>
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </MainLayout>
  );
}
