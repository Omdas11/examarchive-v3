import type { Metadata } from "next";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import Link from "next/link";
import { NOTES_PAPERS, totalPages, totalNotesPages } from "@/lib/notes";

export const metadata: Metadata = {
  title: "7th Semester Notes",
  description:
    "Free written notes for the 7th semester (FYUGP, Assam University, Haflong Government College): all 20 units across PHYDSC401T, PHYDSC402T, PHYDSC403T and CHM-DSM-401, with top high-mark topics and Assam University questions.",
};

const DISCLAIMER =
  "These are student study notes written for the 7th semester (FYUGP, Assam University, Haflong Government College). They are not official university material. Use them with your syllabus and textbooks, and check the Assam University questions listed on each paper page against the original papers.";

export default function NotesPage() {
  const total = totalNotesPages();
  return (
    <MainLayout
      title="7th Semester Notes"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "7th Semester Notes" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole="student"
      isLoggedIn={false}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <h1 className="text-2xl font-bold">7th Semester Notes</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Written notes for all 20 units of the 7th semester — {total} pages across 4 papers.
          Each unit starts with its top 2 high-mark topics, then the Assam University questions
          for that unit, then extra important questions. Read a unit, then attempt its questions
          from the notes before you check anything else.
        </p>
        <p
          className="mt-4 rounded-2xl border border-outline-variant/10 bg-surface px-4 py-3 text-xs leading-relaxed"
          style={{ color: "var(--color-text-muted)" }}
        >
          {DISCLAIMER}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {NOTES_PAPERS.map((paper) => (
            <Link
              key={paper.slug}
              href={`/notes/${paper.slug}`}
              className="rounded-3xl border border-outline-variant/10 bg-surface p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-[11px] font-black uppercase tracking-widest"
                  style={{ color: "var(--color-primary)" }}
                >
                  {paper.code}
                </p>
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{
                    background: "var(--brand-emerald-soft)",
                    color: "var(--brand-emerald-dark)",
                  }}
                >
                  {totalPages(paper)} pages
                </span>
              </div>
              <h2 className="mt-2 text-base font-bold leading-snug">{paper.name}</h2>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--color-text-muted)" }}
              >
                {paper.blurb}
              </p>
              <ul className="mt-4 space-y-1.5">
                {paper.units.map((unit) => (
                  <li key={unit.number} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="leading-snug">
                      <span className="font-semibold">{unit.label}:</span> {unit.title}
                    </span>
                    <span
                      className="shrink-0 text-xs font-semibold"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {unit.pages} pp
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-bold" style={{ color: "var(--color-primary)" }}>
                View all 5 units
                <span className="material-symbols-outlined align-middle text-base ml-1" aria-hidden="true">
                  arrow_forward
                </span>
              </p>
            </Link>
          ))}
        </div>
      </section>
    </MainLayout>
  );
}
