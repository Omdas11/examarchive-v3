import type { Metadata } from "next";
import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import type { Paper } from "@/types";
import { toPaper } from "@/types";
import { toRoman } from "@/lib/utils";
import { buildPaperJsonLd, serializeJsonLd } from "@/lib/json-ld";
import { findByPaperCode, type SyllabusRegistryEntry, type SyllabusUnit } from "@/data/syllabus-registry";
import { PAPER_TYPE_COLORS } from "@/components/PaperCard";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

const SITE_URL = "https://www.examarchive.dev";
const OG_IMAGE_URL = `${SITE_URL}/branding/logo.png`;

interface PaperPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PaperPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const db = adminDatabases();
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.papers, id);
    const paper = toPaper(doc);
    return {
      title: `${paper.title} – ${paper.course_code ?? "Paper"}`,
      description: `Download ${paper.title} for ${paper.course_name} (${paper.course_code ?? "paper"}).`,
      openGraph: {
        type: "article",
        url: `${SITE_URL}/paper/${id}`,
        title: `${paper.title} | ExamArchive`,
        description: `Past exam paper for ${paper.course_name ?? paper.course_code ?? "students"}.`,
        images: [
          {
            url: OG_IMAGE_URL,
            width: 1200,
            height: 630,
            alt: `${paper.title} - ExamArchive`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${paper.title} | ExamArchive`,
        description: `Past exam paper for ${paper.course_name ?? paper.course_code ?? "students"}.`,
        images: [OG_IMAGE_URL],
      },
    };
  } catch {
    return { title: "Paper Not Found" };
  }
}

export default async function PaperPage({ params }: PaperPageProps) {
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  const { id } = await params;
  let paper: Paper | null = null;
  try {
    const db = adminDatabases();
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.papers, id);
    paper = toPaper(doc);
  } catch {
    // document not found
  }

  if (!paper) {
    return (
      <MainLayout
        title="Paper Not Found"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Paper" }]}
        showSearch={false}
        sidebarItems={APP_SIDEBAR_ITEMS}
        userRole={user?.role ?? "visitor"}
        isLoggedIn={!!user}
        userName={userName}
        userInitials={userInitials}
      >
      <section className="mx-auto px-4 py-20 text-center" style={{ maxWidth: "var(--max-w)" }}>
        <h1 className="text-2xl font-bold">Paper Not Found</h1>
        <p className="mt-2" style={{ color: "var(--color-text-muted)" }}>
          The requested paper does not exist or has been removed.
        </p>
        <Link href="/browse" className="btn-primary mt-5 inline-block">← Browse</Link>
      </section>
      </MainLayout>
    );
  }

  const semRoman = paper.semester ? toRoman(parseInt(paper.semester, 10)) : paper.semester;
  const paperJsonLd = buildPaperJsonLd(paper);

  const metaBadges = [
    paper.institution,
    paper.programme,
    paper.department,
    semRoman ? `Sem ${semRoman}` : null,
    paper.year && String(paper.year),
    paper.exam_type,
  ].filter(Boolean) as string[];

  const uploaderDisplay = paper.uploaded_by_username
    ? `@${paper.uploaded_by_username}`
    : null;

  // Look up structured syllabus data from the registry by course_code.
  const courseCode = paper.course_code;
  const syllabusEntry: SyllabusRegistryEntry | undefined = courseCode
    ? findByPaperCode(courseCode)
    : undefined;

  // Fetch all approved papers with the same paper_code for multi-year view.
  let relatedPapers: Paper[] = [];
  if (courseCode) {
    try {
      const db = adminDatabases();
      const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("approved", true),
        Query.equal("course_code", courseCode),
        Query.orderDesc("$createdAt"),
        Query.limit(20),
      ]);
      relatedPapers = documents.map(toPaper).filter((p) => p.id !== paper!.id);
    } catch {
      // ignore
    }
  }

  return (
    <MainLayout
      title="Paper"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Browse", href: "/browse" },
        { label: paper.course_code ?? "Paper" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "visitor"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
    <script type="application/ld+json">
      {serializeJsonLd(paperJsonLd)}
    </script>
    <section className="mx-auto px-6 py-10 space-y-6" style={{ maxWidth: "var(--max-w)" }}>

      {/* ── Back link ── */}
      <Link
        href="/browse"
        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all hover:text-primary hover:-translate-x-1"
        style={{ color: "var(--color-text-muted)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back to Archive
      </Link>

      {/* ── Paper header card ── */}
      <div className="bg-surface p-8 sm:p-12 rounded-[2.5rem] shadow-ambient border border-outline-variant/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary opacity-[0.03] rounded-full -mr-20 -mt-20 blur-3xl" />
        
        <div className="relative z-10">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: "var(--color-primary)" }}>
            {paper.course_code || "Academic Resource"}
          </p>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-[1.1] text-on-surface">{paper.title}</h1>
          {paper.course_name && paper.course_name !== paper.title && (
            <p className="mt-4 text-lg font-medium opacity-60" style={{ color: "var(--color-text-muted)" }}>{paper.course_name}</p>
          )}

          {/* Meta badges */}
          <div className="mt-8 flex flex-wrap gap-2">
            {metaBadges.map((b) => (
              <span
                key={b}
                className="inline-block rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sm border border-primary/10"
                style={{ background: "var(--brand-emerald-soft)", color: "var(--brand-emerald-dark)" }}
              >
                {b}
              </span>
            ))}
          </div>

          {/* Uploader + stats */}
          {(uploaderDisplay || (paper.view_count ?? 0) > 0 || (paper.download_count ?? 0) > 0) && (
            <div className="mt-8 flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest opacity-40">
              {uploaderDisplay && (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm font-black">person</span>
                  {uploaderDisplay}
                </span>
              )}
              {(paper.view_count ?? 0) > 0 && (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm font-black">visibility</span>
                  {paper.view_count} views
                </span>
              )}
              {(paper.download_count ?? 0) > 0 && (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm font-black">download</span>
                  {paper.download_count} downloads
                </span>
              )}
            </div>
          )}

          <a
            href={paper.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-10 py-5 rounded-full shadow-lg hover:shadow-floating transition-all active:scale-95 flex items-center justify-center gap-3 text-base font-black"
          >
            <span className="material-symbols-outlined font-black">picture_as_pdf</span>
            Open Full Archive PDF
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Available papers ── */}
        <div className="bg-surface p-8 rounded-3xl shadow-lift border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1.5 h-6 rounded-full bg-primary" />
            <h2 className="text-xl font-extrabold tracking-tight">Version History</h2>
          </div>
          <ul className="space-y-3">
            {/* Current paper */}
            <li
              className="flex items-center justify-between rounded-2xl p-4 border-2 border-primary shadow-sm"
              style={{ background: "var(--brand-emerald-soft)" }}
            >
              <div className="flex flex-col">
                <span className="text-sm font-black text-on-surface">
                  {paper.year} Edition
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Current Version</span>
              </div>
              <a
                href={paper.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary text-white px-5 py-2 rounded-full text-xs font-bold shadow-md hover:shadow-lg transition-all"
              >
                View
              </a>
            </li>
            {/* Other papers for same course code */}
            {relatedPapers.map((rp) => (
              <li
                key={rp.id}
                className="flex items-center justify-between rounded-2xl p-4 border border-outline-variant/10 bg-surface-container-low hover:bg-surface-container transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-on-surface">
                    {rp.year} Edition
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-40">Previous Year</span>
                </div>
                <Link
                  href={`/paper/${rp.id}`}
                  className="bg-surface text-on-surface border border-outline-variant/20 px-5 py-2 rounded-full text-xs font-bold hover:bg-surface-container-low transition-all"
                >
                  Switch
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Syllabus ── */}
        <div className="bg-surface p-8 rounded-3xl shadow-lift border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1.5 h-6 rounded-full bg-secondary" />
            <h2 className="text-xl font-extrabold tracking-tight">Syllabus Insights</h2>
          </div>
          {syllabusEntry ? (
            <div className="space-y-6">
              {/* Paper meta */}
              <div className="flex flex-wrap gap-2">
                {syllabusEntry.category && PAPER_TYPE_COLORS[syllabusEntry.category] && (
                  <span
                    className="inline-block rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-widest shadow-sm"
                    style={{
                      background: "var(--rgb-secondary-container)",
                      color: "var(--brand-blue)",
                    }}
                  >
                    {syllabusEntry.category}
                  </span>
                )}
                <span
                  className="inline-block rounded-full bg-surface-container-low border border-outline-variant/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest"
                >
                  {syllabusEntry.credits} Credits
                </span>
              </div>

              {/* Units summary */}
              {Array.isArray(syllabusEntry.units) && syllabusEntry.units.length > 0 && (
                <div className="space-y-3">
                  {syllabusEntry.units.slice(0, 3).map((unit: SyllabusUnit) => (
                    <div
                      key={unit.unit}
                      className="flex gap-4 rounded-2xl p-4 bg-surface-container-low border border-outline-variant/5"
                    >
                      <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-sm"
                        style={{ background: "var(--brand-emerald-soft)", color: "var(--brand-emerald-dark)" }}
                      >
                        {unit.unit}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm leading-tight text-on-surface">{unit.name}</p>
                        {unit.lectures != null && (
                          <p className="text-[10px] mt-1 font-bold uppercase tracking-widest opacity-40">
                            {unit.lectures} lectures
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {syllabusEntry.units.length > 3 && (
                    <p className="text-[10px] font-black text-center uppercase tracking-[0.2em] opacity-30 pt-2">
                      + {syllabusEntry.units.length - 3} more modules in full syllabus
                    </p>
                  )}
                </div>
              )}

              {/* Link to full syllabus detail */}
              <Link
                href={`/syllabus/paper/${encodeURIComponent(syllabusEntry.paper_code)}`}
                className="btn py-3.5 rounded-full w-full text-sm font-black uppercase tracking-widest border-2 border-primary/10 hover:bg-primary-fixed hover:text-primary transition-all flex items-center justify-center gap-2"
                style={{ color: "var(--color-primary)" }}
              >
                Full Syllabus Registry
                <span className="material-symbols-outlined font-black text-base">arrow_forward</span>
              </Link>
            </div>
          ) : (
            <div className="rounded-[2rem] p-10 text-center bg-surface-container-low border border-dashed border-outline-variant/20">
              <div className="w-12 h-12 rounded-full bg-surface mx-auto flex items-center justify-center text-primary/20 mb-4 shadow-inner">
                <span className="material-symbols-outlined font-black">inventory_2</span>
              </div>
              <p className="text-sm font-bold text-on-surface opacity-60">Syllabus data pending indexing</p>
              <p className="text-[10px] mt-2 font-medium text-on-surface-variant opacity-40 uppercase tracking-widest">
                Check back later for module breakdown
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Notes & Resources ── */}
      <div className="bg-surface p-8 rounded-3xl shadow-lift border border-outline-variant/10">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-1.5 h-6 rounded-full bg-tertiary" />
          <h2 className="text-xl font-extrabold tracking-tight">Recommended Reading</h2>
        </div>
        {Array.isArray(syllabusEntry?.reference_books) && syllabusEntry.reference_books.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {syllabusEntry.reference_books.map((book, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/5">
                <span className="shrink-0 text-lg font-black opacity-10 italic">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium text-on-surface/80 leading-relaxed">{book}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl p-6 bg-surface-container-low border border-outline-variant/10">
            <p className="text-sm font-medium opacity-60">
              {syllabusEntry
                ? "No reference books listed for this module."
                : "Library references will be automatically linked once syllabus indexing is complete."}
            </p>
          </div>
        )}
      </div>
    </section>
    </MainLayout>
  );
}
