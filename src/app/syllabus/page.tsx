import type { Metadata } from "next";
import Link from "next/link";
import { SYLLABUS_REGISTRY } from "@/data/syllabus-registry";
import {
  FEATURED_PAPERS,
  PROGRAMME_LABEL,
  SEMESTER_LABEL,
  TOTAL_CREDITS,
  TOTAL_MENTORS,
  formatTwoDigits,
} from "@/data/featured-curriculum";
const paperExists = (code: string) =>
  SYLLABUS_REGISTRY.some((entry) => entry.paper_code.toUpperCase() === code.toUpperCase());
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import type { Syllabus } from "@/types";
import { toSyllabus } from "@/types";
import { getServerUser } from "@/lib/auth";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import SyllabusClient from "./SyllabusClient";

export const metadata: Metadata = {
  title: "Syllabus Library by Paper Code and Subject",
  description:
    "Browse approved syllabus PDFs and structured syllabus pages by paper code, subject, and university on ExamArchive.",
  keywords: [
    "syllabus library",
    "paper code syllabus",
    "university syllabus pdf",
    "FYUGP syllabus",
    "CBCS syllabus",
  ],
  alternates: { canonical: "/syllabus" },
  openGraph: {
    title: "Syllabus Library | ExamArchive",
    description:
      "Explore approved syllabus PDFs and paper-code syllabus pages for faster exam preparation.",
    url: "https://examarchive.dev/syllabus",
    type: "website",
  },
};

export default async function SyllabusPage() {
  const user = await getServerUser();
  const isAdmin = user?.role === "admin" || user?.role === "moderator" || user?.role === "founder";
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  let syllabi: Syllabus[] = [];
  try {
    const db = adminDatabases();
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.syllabus,
      [
        Query.equal("approval_status", "approved"),
        Query.orderDesc("$createdAt"),
      ],
    );
    syllabi = documents.map(toSyllabus).filter((s) => !s.is_hidden);
  } catch {
    // collection may not exist yet
  }

  return (
    <MainLayout
      title="Syllabus"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Syllabus" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "visitor"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <div className="space-y-8">
        <header className="rounded-2xl bg-surface-container p-6 shadow-lift border border-outline-variant/30">
          <div className="flex items-center gap-3 text-xs font-semibold text-on-surface-variant">
            <span className="rounded-full bg-surface px-3 py-1 border border-outline-variant/30">{PROGRAMME_LABEL}</span>
            <span className="rounded-full bg-surface px-3 py-1 border border-outline-variant/30">{SEMESTER_LABEL}</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-on-surface">Curriculum Structure</h1>
          <p className="mt-3 max-w-2xl text-base text-on-surface-variant leading-relaxed">
            Comprehensive overview of core papers, electives, and skill enhancement modules for the current academic session.
          </p>
        </header>

        <div className="space-y-4">
          {FEATURED_PAPERS.map((paper) => (
            <article
              key={paper.code}
              className="rounded-2xl border border-outline-variant/30 bg-surface p-5 shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-wide text-primary">{paper.code}</p>
                  <h2 className="text-xl font-bold text-on-surface">{paper.title}</h2>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {paper.tag}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 rounded-xl bg-surface-container px-3 py-2 text-sm font-semibold text-primary">
                  <span className="material-symbols-outlined text-base">star</span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-on-surface-variant">Credits</p>
                    <p className="text-base text-on-surface">{formatTwoDigits(paper.credits)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-surface-container px-3 py-2 text-sm font-semibold text-primary">
                  <span className="material-symbols-outlined text-base">developer_board</span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-on-surface-variant">Units</p>
                    <p className="text-base text-on-surface">{formatTwoDigits(paper.units)}</p>
                  </div>
                </div>
                {paper.mentors.length > 0 && (
                  <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {paper.mentors.join(" • ")}
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-outline-variant/20 pt-4 text-sm">
                {paperExists(paper.code) ? (
                  <Link href={`/syllabus/paper/${paper.code}`} className="font-semibold text-primary hover:underline">
                    View Syllabus →
                  </Link>
                ) : (
                  <span className="font-semibold text-on-surface-variant">Syllabus coming soon</span>
                )}
                {paper.lab && (
                  <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm align-middle">science</span>
                    Labs included
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-surface-container p-4 shadow-lift border border-outline-variant/30">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Total Semester Credits</p>
            <p className="mt-2 text-4xl font-black text-on-surface">{TOTAL_CREDITS}</p>
          </div>
          <div className="rounded-2xl bg-surface-container p-4 shadow-lift border border-outline-variant/30">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Total Papers</p>
            <p className="mt-2 text-2xl font-black text-on-surface">{formatTwoDigits(FEATURED_PAPERS.length)} Modules</p>
          </div>
          <div className="rounded-2xl bg-surface-container p-4 shadow-lift border border-outline-variant/30">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Faculty Reach</p>
            <p className="mt-2 text-2xl font-black text-on-surface">+{TOTAL_MENTORS} Mentors</p>
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-lift border border-outline-variant/30">
          <h2 className="text-lg font-semibold text-on-surface">Browse the full syllabus library</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Explore approved syllabus PDFs or the structured library below.
          </p>
          <div className="mt-4">
            <SyllabusClient syllabi={syllabi} isAdmin={isAdmin} />
          </div>
        </div>
      </div>
    </section>
    </MainLayout>
  );
}
