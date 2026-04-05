"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Syllabus } from "@/types";
import { getMentorInitials } from "@/data/featured-curriculum";
import type { SyllabusTablePaperSummary } from "@/lib/syllabus-table";

const DEPARTMENT_FILTERS = ["All Departments", "Science", "Arts"];

const CARD_META: Record<
  string,
  { icon: string; accent: string; badge?: string; year?: string; university?: string; verified?: boolean }
> = {};

function MentorGroup({ mentors }: { mentors: string[] }) {
  const initials = mentors.map(getMentorInitials).filter(Boolean);
  const visible = initials.slice(0, 2);
  const remaining = Math.max(0, initials.length - visible.length);

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {visible.map((m, idx) => {
          const tone =
            idx === 0
              ? "bg-primary text-primary-foreground"
              : idx === 1
                ? "bg-amber-500 text-white"
                : "bg-surface-container text-on-surface";
          return (
            <span
              key={`${m}-${idx}`}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold ring-4 ring-surface shadow-sm",
                tone,
              )}
            >
              {m}
            </span>
          );
        })}
      </div>
      {remaining > 0 && (
        <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold text-on-surface-variant">+{remaining}</span>
      )}
    </div>
  );
}

type SyllabusCard = {
  code?: string | null;
  title: string;
  credits?: number | null;
  units?: number | null;
  mentors?: string[];
  registryCode?: string | null;
  fileUrl?: string | null;
  year?: number | null;
  university?: string | null;
};

function FeaturedCard({
  code,
  title,
  credits,
  units,
  mentors = [],
  registryCode,
  fileUrl,
  year,
  university,
  availableCodes,
}: SyllabusCard & { availableCodes: Set<string> }) {
  const meta = code ? CARD_META[code] ?? { icon: "description", accent: "bg-surface-container text-primary" } : { icon: "description", accent: "bg-surface-container text-primary" };
  const candidateCode = registryCode ?? code ?? undefined;
  const hasRegistry = candidateCode ? availableCodes.has(candidateCode.toUpperCase()) : false;
  const href = fileUrl ?? (hasRegistry && candidateCode ? `/syllabus/paper/${candidateCode}` : undefined);

  return (
    <article className="rounded-[32px] border border-surface-container-high/30 bg-gradient-to-b from-surface to-surface-container-low shadow-xl shadow-primary/10 ring-1 ring-primary/5">
      <div className="grid grid-cols-[auto_1fr] gap-4 p-6 md:p-7">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-[0_10px_24px_-12px_rgba(0,0,0,0.25)]",
            meta.accent,
          )}
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-3xl">{meta.icon}</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-2xl font-semibold text-on-surface">{title}</h3>
            {meta.badge && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-700 shadow-inner">
                {meta.badge}
              </span>
            )}
          </div>

          <p className="flex items-center gap-2 text-base font-medium text-on-surface-variant">
            <span className="material-symbols-outlined text-lg">apartment</span>
            {university || meta.university || "Assam University"}
            <span className="text-on-surface-variant/60">•</span>
            <span>{year ?? meta.year ?? "2024-25"}</span>
          </p>

          {meta.verified && (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="material-symbols-outlined text-sm">verified</span>
              Verified by Faculty
            </div>
          )}

          {(credits ?? units) && (
            <div className="flex items-center gap-6 text-sm text-on-surface-variant">
              {credits != null && (
                <div className="flex items-center gap-1">
                   <span className="material-symbols-outlined text-base">star</span>
                   <span className="font-semibold text-on-surface">{credits ?? "—"}</span>
                   <span className="text-xs text-on-surface-variant/70">Credits</span>
                 </div>
               )}
               {units != null && (
                 <div className="flex items-center gap-1">
                   <span className="material-symbols-outlined text-base">grid_view</span>
                   <span className="font-semibold text-on-surface">{units ?? "—"}</span>
                   <span className="text-xs text-on-surface-variant/70">Units</span>
                 </div>
               )}
             </div>
           )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-outline-variant/40 px-6 py-5 md:px-7">
        <MentorGroup mentors={mentors} />
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-3 text-base font-semibold text-on-primary shadow-lg shadow-primary/30 transition hover:translate-y-[-1px] hover:shadow-primary/40"
          >
            Open PDF
            <span className="material-symbols-outlined text-base">open_in_new</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-2xl bg-surface-container px-7 py-3 text-base font-semibold text-on-surface-variant">
            Open PDF
            <span className="material-symbols-outlined text-base">lock</span>
          </span>
        )}
      </div>
    </article>
  );
}

export default function SyllabusCatalogClient({ syllabi }: { syllabi: Syllabus[] }) {
  const [activeTab, setActiveTab] = useState<"pdfs" | "library">("pdfs");
  const [activeFilter, setActiveFilter] = useState(DEPARTMENT_FILTERS[0]);
  const [libraryPapers, setLibraryPapers] = useState<SyllabusTablePaperSummary[]>([]);
  const [librarySubjects, setLibrarySubjects] = useState<
    Array<{ subjectCode: string; papers: number; units: number }>
  >([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLibrary() {
      setLibraryLoading(true);
      try {
        const res = await fetch("/api/syllabus/table");
        if (!res.ok) throw new Error(`Failed with status ${res.status}: ${res.statusText}`);
        const data = await res.json();
        if (!cancelled) {
          setLibraryPapers(Array.isArray(data.papers) ? data.papers : []);
          setLibrarySubjects(Array.isArray(data.subjects) ? data.subjects : []);
          setLibraryError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[syllabus] table fetch failed", err);
          setLibraryError("Unable to load syllabus library right now. Please try again shortly.");
        }
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    }
    loadLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedAvailable: SyllabusCard[] = useMemo(() => {
    const base = syllabi.map((s) => ({
      code: s.course_code ?? s.course_name ?? s.subject,
      title: s.subject || s.course_name || "Syllabus",
      credits: null,
      units: null,
      mentors: [],
      registryCode: s.course_code,
      fileUrl: s.file_url,
      year: s.year,
      university: s.university,
    }));
    return base;
  }, [syllabi]);

  const availableCodes = useMemo(
    () => new Set(libraryPapers.map((e) => (e.paperCode || "").toUpperCase()).filter(Boolean)),
    [libraryPapers],
  );

  const filteredAvailable = useMemo(() => {
    if (activeFilter === "All Departments") return normalizedAvailable;
    const matcher = activeFilter.toLowerCase();
    return normalizedAvailable.filter((p) => (p.title ?? "").toLowerCase().includes(matcher) || (p.code ?? "").toLowerCase().includes(matcher));
  }, [activeFilter, normalizedAvailable]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <div className="space-y-8 rounded-[36px] bg-gradient-to-b from-surface to-surface-container-lowest p-5 shadow-inner shadow-primary/5 ring-1 ring-primary/5">
        <header className="space-y-5 rounded-[28px] bg-surface p-6 shadow-sm shadow-primary/10 ring-1 ring-surface-container-high/40">
          <h1 className="text-4xl font-black leading-tight text-on-surface">Syllabus Catalog</h1>
          <p className="max-w-2xl text-base text-on-surface-variant">
            Access verified curriculum and exam structures for your department.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-container-low p-2 text-sm font-semibold shadow-inner ring-1 ring-surface-container-high/40">
            <button
              className={cn(
                "rounded-xl px-3 py-3 transition",
                activeTab === "pdfs"
                  ? "bg-primary text-on-primary shadow-lg shadow-primary/30"
                  : "text-on-surface-variant hover:bg-surface",
              )}
              onClick={() => setActiveTab("pdfs")}
            >
              Available Syllabus PDFs
            </button>
            <button
              className={cn(
                "rounded-xl px-3 py-3 transition",
                activeTab === "library"
                  ? "bg-primary text-on-primary shadow-lg shadow-primary/30"
                  : "text-on-surface-variant hover:bg-surface",
              )}
              onClick={() => setActiveTab("library")}
            >
              Syllabus from Syllabus_Table
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {DEPARTMENT_FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-sm font-semibold transition shadow-sm ring-1 ring-transparent",
                  activeFilter === filter
                    ? "bg-primary text-on-primary shadow-md shadow-primary/30"
                    : "bg-surface-container text-on-surface hover:bg-surface-container-high",
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </header>

        {activeTab === "pdfs" ? (
          <div className="space-y-6">
            {filteredAvailable.length === 0 ? (
              <div className="rounded-3xl border border-outline-variant/40 bg-surface p-6 text-center text-sm text-on-surface-variant">
                No approved syllabus PDFs are available yet. Upload a syllabus to get started.
              </div>
            ) : (
              filteredAvailable.map((paper, idx) => (
                <FeaturedCard key={paper.code ?? idx} {...paper} availableCodes={availableCodes} />
              ))
            )}
          </div>
        ) : (
          <div className="rounded-3xl bg-surface p-4 shadow-sm shadow-primary/5 ring-1 ring-surface-container-high/40">
            {libraryLoading ? (
              <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                Loading syllabus library from Syllabus_Table…
              </div>
            ) : libraryError ? (
              <div className="rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error">
                {libraryError}
              </div>
            ) : (
              <div className="space-y-4">
                {librarySubjects.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {librarySubjects.map((subject) => (
                      <a
                        key={subject.subjectCode}
                        href={`/api/syllabus/table?subjectCode=${encodeURIComponent(subject.subjectCode)}&mode=pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Download departmental syllabus PDF for ${subject.subjectCode} containing ${subject.papers} papers`}
                        className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                      >
                        {subject.subjectCode} Dept PDF ({subject.papers})
                      </a>
                    ))}
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  {libraryPapers.map((paper) => (
                    <article
                      key={paper.paperCode}
                      className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4"
                    >
                      <p className="text-sm font-semibold text-on-surface">{paper.paperCode}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{paper.paperName}</p>
                      <p className="mt-2 text-[11px] text-on-surface-variant">
                        {paper.university} · {paper.course} · {paper.stream} · {paper.type}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/syllabus/paper/${encodeURIComponent(paper.paperCode)}`}
                          className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary"
                        >
                          Open Details
                        </Link>
                        <a
                          href={`/api/syllabus/table?paperCode=${encodeURIComponent(paper.paperCode)}&mode=pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface ring-1 ring-outline-variant/40"
                        >
                          Download MD PDF
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
