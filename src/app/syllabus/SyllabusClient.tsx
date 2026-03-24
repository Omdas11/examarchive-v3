"use client";

import { useState, useMemo, useEffect } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import type { Syllabus } from "@/types";
import { toRoman } from "@/lib/utils";
import { SYLLABUS_REGISTRY, groupBySemester, getAllUniversities } from "@/data/syllabus-registry";
import type { SyllabusRegistryEntry } from "@/data/syllabus-registry";
import { PAPER_TYPE_COLORS } from "@/components/PaperCard";
import { makeAccentGradient } from "@/lib/gradients";
import {
  COURSE_PREFS_UPDATED_EVENT,
  loadCoursePrefs,
  matchesCoursePreferenceSelection,
} from "@/data/course-selection-data";

type Tab = "pdfs" | "library";

interface SyllabusClientProps {
  syllabi: Syllabus[];
  isAdmin?: boolean;
}

/** Format a semester value for display (e.g. "1" → "Semester I"). */
function semLabel(sem: string | number | null | undefined): string {
  if (sem == null || sem === "") return "";
  const n = typeof sem === "number" ? sem : parseInt(String(sem), 10);
  if (!isNaN(n)) return `Semester ${toRoman(n)}`;
  return String(sem);
}

/** A single uploaded syllabus PDF card — styled like Browse page cards. */
function statusTone(approval?: Syllabus["approval_status"]) {
  switch (approval) {
    case "approved":
      return { bg: "bg-primary-container", text: "text-on-primary", ring: "ring-primary/30", label: "Approved" };
    case "pending":
      return { bg: "bg-secondary-container", text: "text-on-secondary", ring: "ring-secondary/30", label: "Pending review" };
    case "rejected":
      return { bg: "bg-error-container", text: "text-on-error", ring: "ring-error/30", label: "Rejected" };
    default:
      return { bg: "bg-surface-container-high", text: "text-on-surface-variant", ring: "ring-outline-variant/40", label: "Unknown status" };
  }
}

function SyllabusPdfCard({
  s,
  isAdmin,
  onHide,
}: {
  s: Syllabus;
  isAdmin?: boolean;
  onHide?: (id: string) => void;
}) {
  const [hiding, setHiding] = useState(false);

  async function handleHide() {
    if (!confirm("Hide this syllabus PDF from public view? It can be restored from the admin panel.")) return;
    setHiding(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hide-syllabus", id: s.id }),
      });
      const data = await res.json();
      if (data.success) {
        onHide?.(s.id);
      } else {
        alert(data.error ?? "Action failed");
      }
    } catch {
      alert("Network error");
    } finally {
      setHiding(false);
    }
  }

  const displayTitle = s.course_name || s.subject || "Unnamed Syllabus";
  const displayCode = s.course_code;
  const submittedOn = s.created_at
    ? new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const tone = statusTone(s.approval_status);

  return (
    <div className="relative group overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface shadow-lift ring-1 ring-surface-container-high/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-ambient">
      <div
        className="h-1 w-full"
        style={{ background: makeAccentGradient(programmeAccentColor(s.programme)) }}
        aria-hidden="true"
      />

      <a
        href={s.file_url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-col gap-3 p-4 sm:p-5"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {s.programme && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={programmeBadgeStyle(s.programme)}
              >
                {s.programme}
              </span>
            )}
            {displayCode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {displayCode}
              </span>
            )}
            {s.approval_status && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
              >
                {tone.label}
              </span>
            )}
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-container-high text-sm font-semibold text-primary ring-1 ring-outline-variant/40">
            {s.year && s.year > 0 ? s.year : "PDF"}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-base font-semibold leading-snug text-on-surface line-clamp-2">{displayTitle}</p>
          <p className="text-sm text-on-surface-variant line-clamp-1">
            {[
              s.university || "Unknown University",
              s.semester ? semLabel(s.semester) : null,
              s.department || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-on-surface-variant">
          {s.course_name && s.course_name !== displayTitle && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1">
              {s.course_name}
            </span>
          )}
          {s.subject && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1">
              {s.subject}
            </span>
          )}
          {s.department && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1">
              {s.department}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-on-surface-variant">
          <div className="flex flex-wrap items-center gap-3">
            {submittedOn && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {submittedOn}
              </span>
            )}
            {s.uploaded_by_username && (
              <span className="inline-flex items-center gap-1 truncate max-w-[140px]" title={`@${s.uploaded_by_username}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5Z" /><path d="M3 21c0-3.866 3.134-7 7-7h4c3.866 0 7 3.134 7 7" />
                </svg>
                @{s.uploaded_by_username}
              </span>
            )}
          </div>

          {s.file_url && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-transform duration-150 group-hover:translate-x-0.5">
              Open PDF
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </span>
          )}
        </div>
      </a>

      {/* Admin hide button — neutral grey to indicate moderation, not a destructive action */}
      {isAdmin && (
        <button
          type="button"
          title="Hide this syllabus from public view"
          disabled={hiding}
          onClick={handleHide}
          className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "#6b7280", color: "#fff" }}
        >
          {hiding ? "…" : "Hide"}
        </button>
      )}
    </div>
  );
}

type SortKey = "code" | "name" | "semester" | "credits";

/** Colour-code the accent bar by programme type. */
const PROGRAMME_COLORS: Record<string, string> = {
  FYUGP: "#3b82f6",  // blue — covers both "FYUG" and "FYUGP" via substring match below
  CBCS: "#10b981",   // emerald
  NEP: "#f59e0b",    // amber
  HONOURS: "#8b5cf6", // violet
};

function programmeAccentColor(programme?: string): string {
  if (!programme) return "var(--color-primary)";
  const upper = programme.toUpperCase();
  // Check "FYUG" first so that both "FYUG" and "FYUGP" resolve to the same blue colour
  // (substring match: "FYUGP".includes("FYUG") === true)
  if (upper.includes("FYUG")) return PROGRAMME_COLORS.FYUGP;
  for (const [key, color] of Object.entries(PROGRAMME_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return "var(--color-primary)";
}

/** Badge colours for programme pill. */
function programmeBadgeStyle(programme?: string): CSSProperties {
  if (!programme) return { background: "var(--color-border)", color: "var(--color-text-muted)" };
  const upper = programme.toUpperCase();
  if (upper.includes("FYUG")) return { background: "#dbeafe", color: "#1d4ed8" };
  if (upper.includes("CBCS")) return { background: "#d1fae5", color: "#065f46" };
  if (upper.includes("NEP"))  return { background: "#fef3c7", color: "#92400e" };
  if (upper.includes("HONOURS")) return { background: "#ede9fe", color: "#5b21b6" };
  return { background: "var(--color-border)", color: "var(--color-text-muted)" };
}



/** Tab 2: Paper Syllabus Library from the registry. */
export function PaperLibrary() {
  const [filterUniversity, setFilterUniversity] = useState<string>("ALL");
  const [filterProg, setFilterProg] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterSubject, setFilterSubject] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("semester");
  const [myCoursesActive, setMyCoursesActive] = useState(false);
  const [coursePrefs, setCoursePrefs] = useState(() => loadCoursePrefs());

  // Keep course prefs in sync when localStorage changes (e.g. from Settings page)
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === "ea_course_prefs") {
        setCoursePrefs(loadCoursePrefs());
      }
    }
    function handleCoursePrefsUpdated() {
      setCoursePrefs(loadCoursePrefs());
    }
    window.addEventListener("storage", handleStorage);
    window.addEventListener(COURSE_PREFS_UPDATED_EVENT, handleCoursePrefsUpdated);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(COURSE_PREFS_UPDATED_EVENT, handleCoursePrefsUpdated);
    };
  }, []);

  const universities = ["ALL", ...getAllUniversities()];
  const programmes = useMemo(() => ["ALL", ...Array.from(new Set(
    SYLLABUS_REGISTRY
      .filter((e) => filterUniversity === "ALL" || e.university === filterUniversity)
      .map((e) => e.programme),
  )).sort()], [filterUniversity]);

  const categories = useMemo(() => [
    "ALL",
    ...Array.from(
      new Set(
        SYLLABUS_REGISTRY.filter((e) => {
          if (filterUniversity !== "ALL" && e.university !== filterUniversity) return false;
          if (filterProg !== "ALL" && e.programme !== filterProg) return false;
          return true;
        })
          .map((e) => e.category)
          .filter(Boolean),
      ),
    ).sort() as string[],
  ], [filterUniversity, filterProg]);

  const subjects = useMemo(() => [
    "ALL",
    ...Array.from(
      new Set(
        SYLLABUS_REGISTRY.filter((e) => {
          if (filterUniversity !== "ALL" && e.university !== filterUniversity) return false;
          if (filterProg !== "ALL" && e.programme !== filterProg) return false;
          if (filterCategory !== "ALL" && e.category !== filterCategory) return false;
          return true;
        }).map((e) => e.subject),
      ),
    ).sort(),
  ], [filterUniversity, filterProg, filterCategory]);

  const filtered = useMemo(() => {
    const entries = SYLLABUS_REGISTRY.filter((e) => {
      if (!myCoursesActive && filterUniversity !== "ALL" && e.university !== filterUniversity) return false;
      if (!myCoursesActive && filterProg !== "ALL" && e.programme !== filterProg) return false;
      if (!myCoursesActive && filterCategory !== "ALL" && e.category !== filterCategory) return false;
      if (!myCoursesActive && filterSubject !== "ALL" && e.subject !== filterSubject) return false;
      // My Courses filter — match selected subject against the correct category
      if (myCoursesActive && coursePrefs) {
        if (
          !matchesCoursePreferenceSelection({
            prefs: coursePrefs,
            category: e.category,
            fallbackCode: e.paper_code,
            subjectFields: [e.subject],
            valueFields: [e.paper_name, e.paper_code],
          })
        ) {
          return false;
        }
      }
      return true;
    });
    return [...entries].sort((a, b) => {
      switch (sortKey) {
        case "code": return a.paper_code.localeCompare(b.paper_code);
        case "name": return a.paper_name.localeCompare(b.paper_name);
        case "credits": return b.credits - a.credits;
        case "semester":
        default: return a.semester - b.semester;
      }
    });
  }, [filterUniversity, filterProg, filterCategory, filterSubject, sortKey, myCoursesActive, coursePrefs]);

  // When grouping by subject, sort=semester still applies within each group.
  // Group: subject → semester → entries
  const groupedBySubject = useMemo(() => {
    const map = new Map<string, SyllabusRegistryEntry[]>();
    for (const entry of filtered) {
      const subj = entry.subject;
      if (!map.has(subj)) map.set(subj, []);
      map.get(subj)!.push(entry);
    }
    return map;
  }, [filtered]);

  function handleUniversityClick(u: string) {
    setFilterUniversity(u);
    setFilterProg("ALL");
    setFilterCategory("ALL");
    setFilterSubject("ALL");
  }

  function handleProgClick(p: string) {
    setFilterProg(p);
    setFilterCategory("ALL");
    setFilterSubject("ALL");
  }

  function handleCategoryClick(c: string) {
    setFilterCategory(c);
    setFilterSubject("ALL");
  }

  const CAT_COLORS = PAPER_TYPE_COLORS;
  const chipClass = (active: boolean) =>
    `inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-primary text-on-primary ring-1 ring-primary/40"
        : "bg-surface-container text-on-surface-variant ring-1 ring-outline-variant/50 hover:bg-surface-container-high hover:text-on-surface"
    }`;

  return (
    <div className="mt-6 space-y-5">
      {/* My Courses banner — shown when course prefs are set */}
      {coursePrefs && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container px-3 py-2.5 ring-1 ring-surface-container-high/40">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-xs font-semibold ${myCoursesActive ? "text-primary" : "text-on-surface-variant"}`}>
              🎓 My Courses:
            </span>
            <span className="text-xs truncate text-on-surface-variant">
              DSC: {coursePrefs.dsc} · DSM: {coursePrefs.dsm1}, {coursePrefs.dsm2}
              {coursePrefs.sec ? ` · SEC: ${coursePrefs.sec}` : ""}
              {coursePrefs.idc ? ` · IDC: ${coursePrefs.idc}` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMyCoursesActive((v) => !v)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ring-1 ${
              myCoursesActive
                ? "bg-primary text-on-primary ring-primary/40"
                : "bg-surface text-primary ring-primary/40 hover:bg-primary/10"
            }`}
          >
            {myCoursesActive ? "✓ Filtered" : "Filter by my courses"}
          </button>
        </div>
      )}

      {/* University, programme, category, subject filters — hidden when My Courses is active */}
      {!myCoursesActive && (<>
      {/* University filter */}
      {universities.length > 2 && (
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-2">
          {universities.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => handleUniversityClick(u)}
              className={chipClass(filterUniversity === u)}
            >
              {u}
            </button>
          ))}
        </div>
      )}

      {/* Programme filter */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-2">
        {programmes.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handleProgClick(p)}
            className={chipClass(filterProg === p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Category filter */}
      {categories.length > 2 && (
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-2">
          {categories.map((c) => {
            const colors = c !== "ALL" && CAT_COLORS[c] ? CAT_COLORS[c] : null;
            return (
              <button
                key={c}
                type="button"
                onClick={() => handleCategoryClick(c)}
                className={chipClass(filterCategory === c)}
                style={
                  filterCategory === c && colors
                    ? { borderColor: colors.text, color: colors.text, background: colors.bg }
                    : undefined
                }
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      {/* Subject filter */}
      {subjects.length > 2 && (
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-2">
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterSubject(s)}
              className={chipClass(filterSubject === s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      </>)}

      {/* Sort controls + count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-on-surface-variant">
          {filtered.length} paper{filtered.length !== 1 ? "s" : ""} in registry
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-on-surface-variant">Sort:</span>
          {(["semester", "code", "name", "credits"] as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortKey(key)}
              className={`text-[11px] px-2.5 py-1 rounded-full ring-1 transition-colors ${
                sortKey === key
                  ? "bg-primary text-on-primary ring-primary/40"
                  : "bg-surface-container text-on-surface-variant ring-outline-variant/40 hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              {key === "semester" ? "Semester" : key === "code" ? "Code" : key === "name" ? "Name" : "Credits"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-on-surface-variant">
          No papers match the selected filters.
        </p>
      ) : (
        Array.from(groupedBySubject.entries()).map(([subject, subjectEntries]) => {
          // Sub-group by semester within each subject
          const bySem = groupBySemester(subjectEntries);
          return (
            <div key={subject}>
              {/* Subject heading */}
              <h3 className="mb-3 mt-6 flex items-center gap-2 border-b border-outline-variant/40 pb-2 text-base font-semibold text-on-surface">
                <span className="text-primary">{subject}</span>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-normal text-on-surface-variant">
                  {subjectEntries.length} paper{subjectEntries.length !== 1 ? "s" : ""}
                </span>
              </h3>

              {sortKey === "semester" ? (
                // Group by semester with collapsible accordion
                Array.from(bySem.entries()).map(([sem, entries]) => (
                  <SemesterAccordion key={sem} label={semLabel(sem)} count={entries.length}>
                    <PaperTable entries={entries} catColors={CAT_COLORS} />
                  </SemesterAccordion>
                ))
              ) : (
                <PaperTable entries={subjectEntries} catColors={CAT_COLORS} />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/** Collapsible semester accordion for progressive disclosure. */
function SemesterAccordion({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3">
      <button
        id={`accordion-header-${label}`}
        type="button"
        className="flex w-full items-center justify-between rounded-2xl border border-outline-variant/35 bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`accordion-body-${label}`}
      >
        <span className="flex items-center gap-2">
          {label}
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-normal text-on-surface-variant">
            {count}
          </span>
        </span>
        <svg
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        role="region"
        aria-labelledby={`accordion-header-${label}`}
        hidden={!open}
      >
        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
}

/** Reusable paper rows table with zebra striping and sticky headers. */
function PaperTable({
  entries,
  catColors,
}: {
  entries: SyllabusRegistryEntry[];
  catColors: typeof PAPER_TYPE_COLORS;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Paper Code</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Paper Name</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Cat.</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Credits</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Units</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e: SyllabusRegistryEntry) => {
            const colors = e.category && catColors[e.category] ? catColors[e.category] : null;
            const hasUnits = (e.units?.length ?? 0) > 0;
            return (
              <tr
                key={e.paper_code}
                className="border-t border-outline-variant/30 transition-colors odd:bg-surface even:bg-surface-container-low hover:bg-surface-container"
              >
                <td className="py-2 pr-3">
                  <Link
                    href={`/syllabus/paper/${encodeURIComponent(e.paper_code)}`}
                    className="px-3 font-mono text-xs font-semibold text-primary hover:underline"
                  >
                    {e.paper_code}
                  </Link>
                </td>
                <td className="px-3 py-2 pr-3">
                  <Link
                    href={`/syllabus/paper/${encodeURIComponent(e.paper_code)}`}
                    className="text-xs text-on-surface hover:underline"
                  >
                    {e.paper_name}
                  </Link>
                </td>
                <td className="px-3 py-2 pr-3">
                  {e.category && colors ? (
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-outline-variant/40"
                      style={{ background: colors.bg, color: colors.text }}
                    >
                      {e.category}
                    </span>
                  ) : (
                    <span className="text-xs text-on-surface-variant">
                      {e.category ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 pr-3 text-xs text-on-surface-variant">
                  {e.credits}
                </td>
                <td className="px-3 py-2 text-xs">
                  {hasUnits ? (
                    <span className="font-medium" style={{ color: "var(--success-green)" }}>✓ {e.units!.length}</span>
                  ) : (
                    <span className="text-on-surface-variant">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SyllabusClient({ syllabi, isAdmin }: SyllabusClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("pdfs");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const visibleSyllabi = syllabi.filter((s) => !hiddenIds.has(s.id));

  // Departmental syllabi have no semester (covers all semesters)
  function isDeptSyllabus(s: Syllabus): boolean {
    return !s.semester || s.semester === "";
  }

  const deptSyllabi = visibleSyllabi.filter(isDeptSyllabus);
  const singleSyllabi = visibleSyllabi.filter((s) => !isDeptSyllabus(s));

  function handleHide(id: string) {
    setHiddenIds((prev) => new Set([...prev, id]));
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-low p-5 ring-1 ring-surface-container-high/40 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Syllabus hub</p>
            <h1 className="mt-1 text-2xl font-semibold text-on-surface sm:text-3xl">Syllabus Explorer</h1>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
              Discover approved syllabus PDFs and structured paper-wise syllabus data with expressive Material 3 styling.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              PDFs {visibleSyllabi.length}
            </span>
            <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface-variant">
              Library {SYLLABUS_REGISTRY.length}
            </span>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div
        className="inline-flex flex-wrap gap-1 rounded-2xl border border-outline-variant/35 bg-surface-container p-1"
        role="tablist"
      >
        <button
          role="tab"
          aria-selected={activeTab === "pdfs"}
          type="button"
          onClick={() => setActiveTab("pdfs")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "pdfs"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          }`}
        >
          Available Syllabus PDFs
          {visibleSyllabi.length > 0 && (
            <span className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${activeTab === "pdfs" ? "bg-on-primary/15 text-on-primary" : "bg-surface-container-high text-primary"}`}>
              {visibleSyllabi.length}
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "library"}
          type="button"
          onClick={() => setActiveTab("library")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "library"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          }`}
        >
          Paper Syllabus Library
          <span className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${activeTab === "library" ? "bg-on-primary/15 text-on-primary" : "bg-surface-container-high text-primary"}`}>
            {SYLLABUS_REGISTRY.length}
          </span>
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "pdfs" && (
        <div role="tabpanel" aria-label="Available Syllabus PDFs" className="mt-2 space-y-8">
          {/* Departmental Syllabus section */}
          {deptSyllabi.length > 0 && (
            <div>
              <h2 className="mb-1 flex items-center gap-2 border-b border-outline-variant/40 pb-2 text-base font-semibold text-on-surface">
                <span className="text-primary">Departmental Syllabus</span>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-normal text-on-surface-variant">
                  {deptSyllabi.length}
                </span>
              </h2>
              <p className="mb-4 text-xs text-on-surface-variant">
                Full programme syllabi covering all semesters (e.g. Physics FYUG Full Syllabus).
              </p>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
              >
                {deptSyllabi.map((s) => (
                  <SyllabusPdfCard key={s.id} s={s} isAdmin={isAdmin} onHide={handleHide} />
                ))}
              </div>
            </div>
          )}

          {/* Individual semester syllabi */}
          {singleSyllabi.length > 0 ? (
            <div>
              {deptSyllabi.length > 0 && (
                <h2
                  className="mb-1 flex items-center gap-2 border-b border-outline-variant/40 pb-2 text-base font-semibold text-on-surface"
                >
                  <span className="text-primary">Semester Syllabi</span>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-normal text-on-surface-variant">
                    {singleSyllabi.length}
                  </span>
                </h2>
              )}
              <div
                className="grid gap-4 mt-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
              >
                {singleSyllabi.map((s) => (
                  <SyllabusPdfCard
                    key={s.id}
                    s={s}
                    isAdmin={isAdmin}
                    onHide={handleHide}
                  />
                ))}
              </div>
            </div>
          ) : (
            deptSyllabi.length === 0 && (
              <div className="mt-8 text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 opacity-30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
                <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  No approved syllabi yet.
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <a href="/upload?type=syllabus" style={{ color: "var(--color-primary)" }}>
                    Upload a syllabus
                  </a>{" "}
                  to get started.
                </p>
              </div>
            )
          )}
        </div>
      )}

      {activeTab === "library" && (
        <div role="tabpanel" aria-label="Paper Syllabus Library">
          <PaperLibrary />
        </div>
      )}
    </div>
  );
}
