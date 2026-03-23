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
  getMentorInitials,
} from "@/data/featured-curriculum";
import { cn } from "@/lib/utils";
const paperExists = (code?: string) => {
  if (!code) return false;
  return SYLLABUS_REGISTRY.some((entry) => entry.paper_code.toUpperCase() === code.toUpperCase());
};
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

  const tagStyles: Record<string, string> = {
    DSC: "bg-primary/10 text-primary",
    DSM: "bg-secondary/20 text-secondary",
    SEC: "bg-tertiary-fixed text-on-tertiary-fixed",
  };
  const mentorDotTones = ["bg-primary/30", "bg-secondary/30", "bg-primary/20"];

  return (
    <MainLayout
      title="Academic Curator"
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "visitor"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <div className="space-y-8">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-on-surface-variant">
              <span className="rounded-full bg-tertiary-fixed px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-on-tertiary-fixed">
                {PROGRAMME_LABEL}
              </span>
              <span className="text-on-surface-variant">•</span>
              <span className="text-sm font-semibold text-on-surface-variant">{SEMESTER_LABEL}</span>
            </div>
            <h1 className="text-4xl font-extrabold text-on-surface">Curriculum Structure</h1>
            <p className="max-w-2xl text-base text-on-surface-variant leading-relaxed">
              Comprehensive overview of core papers, electives, and skill enhancement modules for the current academic session.
            </p>
          </header>

          <div className="space-y-6">
            {FEATURED_PAPERS.map((paper) => {
              const mentorInitials = paper.mentors.map(getMentorInitials).filter(Boolean).slice(0, 2);
              const registryCode = paper.registryCode;
              const hasRegistry = paperExists(registryCode);
              return (
                <article
                  key={paper.code}
                  className="rounded-3xl border border-outline-variant/20 bg-surface p-6 shadow-lift"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold tracking-[0.2em] text-primary">{paper.code}</p>
                      <h2 className="text-2xl font-semibold text-on-surface">{paper.title}</h2>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        tagStyles[paper.tag] ?? "bg-surface-container text-on-surface",
                      )}
                    >
                      {paper.tag}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-base">star</span>
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Credits</p>
                        <p className="text-lg font-semibold text-on-surface">{formatTwoDigits(paper.credits)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-base">grid_view</span>
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Units</p>
                        <p className="text-lg font-semibold text-on-surface">{formatTwoDigits(paper.units)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-outline-variant/15 pt-4 text-sm">
                    {hasRegistry ? (
                      <Link
                        href={`/syllabus/paper/${registryCode!}`}
                        className="flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        View Syllabus
                        <span className="material-symbols-outlined text-base">chevron_right</span>
                      </Link>
                    ) : (
                      <span className="flex items-center gap-1 font-semibold text-primary">
                        View Syllabus
                        <span className="material-symbols-outlined text-base">chevron_right</span>
                      </span>
                    )}

                    {paper.lab ? (
                      <span className="flex items-center gap-2 text-xs italic text-on-surface-variant">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-on-surface text-surface">
                          <span className="material-symbols-outlined text-[12px]">science</span>
                        </span>
                        Labs included
                      </span>
                    ) : mentorInitials.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {mentorInitials.map((initials, index) => (
                            <span
                              key={`${paper.code}-${initials}-${index}`}
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ring-surface",
                                index === 0 ? "bg-primary/10 text-primary" : "bg-secondary/20 text-secondary",
                              )}
                            >
                              {initials}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-primary/10 p-5 text-primary shadow-lift">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">Total Semester Credits</p>
              <p className="mt-3 text-4xl font-black text-primary">{TOTAL_CREDITS}</p>
            </div>
            <div className="rounded-2xl bg-primary/5 p-5 text-on-surface shadow-lift">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Total Papers</p>
              <p className="mt-3 text-2xl font-black text-on-surface">{formatTwoDigits(FEATURED_PAPERS.length)} Modules</p>
            </div>
            <div className="rounded-2xl bg-primary/15 p-5 text-on-surface shadow-lift">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Faculty Reach</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {mentorDotTones.map((tone, index) => (
                    <span
                      key={`mentor-dot-${index}`}
                      className={cn("h-6 w-6 rounded-full border border-surface", tone)}
                    />
                  ))}
                </div>
                <p className="text-lg font-semibold text-on-surface">+{TOTAL_MENTORS} Mentors</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-5 shadow-lift border border-outline-variant/30">
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
