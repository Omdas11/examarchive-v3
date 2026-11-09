import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import Link from "next/link";
import {
  AU_GAP_TEXT,
  notesPaperBySlug,
  notesPaperSlugs,
  totalPages,
} from "@/lib/notes";

const DISCLAIMER =
  "These are student study notes written for the 7th semester (FYUGP, Assam University, Haflong Government College). They are not official university material. Use them with your syllabus and textbooks, and check the Assam University questions below against the original papers.";

export function generateStaticParams() {
  return notesPaperSlugs().map((slug) => ({ paper: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ paper: string }>;
}): Promise<Metadata> {
  const { paper: slug } = await params;
  const paper = notesPaperBySlug(slug);
  if (!paper) return { title: "Notes" };
  return {
    title: `${paper.code} Notes — ${paper.name}`,
    description: `Written notes for ${paper.code} ${paper.name} (7th semester, FYUGP, Assam University): all 5 units, ${totalPages(paper)} pages, with top high-mark topics and Assam University questions.`,
  };
}

export default async function NotesPaperPage({
  params,
}: {
  params: Promise<{ paper: string }>;
}) {
  const { paper: slug } = await params;
  const paper = notesPaperBySlug(slug);
  if (!paper) notFound();

  return (
    <MainLayout
      title={`${paper.code} Notes`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "7th Semester Notes", href: "/notes" },
        { label: `${paper.code} — ${paper.name}` },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole="student"
      isLoggedIn={false}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <p
          className="text-[11px] font-black uppercase tracking-widest"
          style={{ color: "var(--color-primary)" }}
        >
          {paper.code} · 7th Semester
        </p>
        <h1 className="mt-1 text-2xl font-bold">{paper.name}</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {paper.blurb} All 5 units, {totalPages(paper)} pages. Each unit PDF opens in a new
          tab to read, or downloads to your device.
        </p>
        {paper.auGapNote && (
          <p
            className="mt-3 rounded-2xl border border-outline-variant/10 bg-surface px-4 py-3 text-xs leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            {paper.auGapNote}
          </p>
        )}
        <p
          className="mt-4 rounded-2xl border border-outline-variant/10 bg-surface px-4 py-3 text-xs leading-relaxed"
          style={{ color: "var(--color-text-muted)" }}
        >
          {DISCLAIMER}
        </p>

        <div className="mt-8 space-y-4">
          {paper.units.map((unit) => (
            <article
              key={unit.number}
              className="rounded-3xl border border-outline-variant/10 bg-surface p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-base font-bold leading-snug">
                  {unit.label}: {unit.title}
                </h2>
                <span
                  className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{
                    background: "var(--brand-emerald-soft)",
                    color: "var(--brand-emerald-dark)",
                  }}
                >
                  {unit.pages} pages
                </span>
              </div>

              <h3 className="mt-4 text-xs font-black uppercase tracking-widest text-on-surface-variant">
                Top 2 high-mark topics
              </h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
                {unit.topTopics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ol>

              <h3 className="mt-5 text-xs font-black uppercase tracking-widest text-on-surface-variant">
                Assam University questions
              </h3>
              {unit.auQuestions.length === 0 ? (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                  {AU_GAP_TEXT}. No AU paper for this unit was found in the question bank, so the
                  notes cover the unit from the syllabus, with extra important questions at the
                  end of the PDF.
                </p>
              ) : (
                <>
                  {unit.auNote && (
                    <p
                      className="mt-2 text-xs leading-relaxed"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {unit.auNote}
                    </p>
                  )}
                  <ul className="mt-2 space-y-3">
                    {unit.auQuestions.map((q, idx) => (
                      <li key={idx} className="text-sm leading-relaxed">
                        <p>{q.text}</p>
                        <p
                          className="mt-0.5 text-xs"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {q.source}
                          {q.paraphrased ? " — paraphrased, not verbatim" : ""}
                          {q.note ? ` — ${q.note}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={unit.pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-on-primary gradient-primary transition-all hover:shadow-floating active:scale-95"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    open_in_new
                  </span>
                  Read PDF
                </Link>
                <a
                  href={unit.pdf}
                  download
                  className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition-all hover:shadow-floating active:scale-95"
                  style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    download
                  </span>
                  Download
                </a>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 text-sm">
          <Link
            href="/notes"
            className="font-bold underline"
            style={{ color: "var(--color-primary)" }}
          >
            Back to all 7th semester notes
          </Link>
        </p>
      </section>
    </MainLayout>
  );
}
