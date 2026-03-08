"use client";

import { useState, useMemo } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import type { Syllabus } from "@/types";
import { toRoman } from "@/lib/utils";
import { SYLLABUS_REGISTRY, groupBySemester, getAllUniversities } from "@/data/syllabus-registry";
import type { SyllabusRegistryEntry } from "@/data/syllabus-registry";
import { PAPER_TYPE_COLORS } from "@/components/PaperCard";

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

  return (
    <div className="relative group card overflow-hidden flex hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
      {/* Coloured accent bar — colour-coded by programme */}
      <div
        className="w-1 shrink-0 rounded-l-lg"
        style={{ background: programmeAccentColor(s.programme) }}
        aria-hidden="true"
      />

      {/* Card body */}
      <a
        href={s.file_url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 p-4 flex flex-col gap-2"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {/* Subject / paper name — prominent, always first */}
        <p className="text-sm font-semibold leading-snug line-clamp-2">{displayTitle}</p>

        {/* Programme & paper-code badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {s.programme && (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={programmeBadgeStyle(s.programme)}
            >
              {s.programme}
            </span>
          )}
          {displayCode && (
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-mono"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
            >
              {displayCode}
            </span>
          )}
        </div>

        {/* Meta: university, semester, dept */}
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {[
            s.university || "Unknown University",
            s.semester ? semLabel(s.semester) : null,
            s.department || null,
            s.year && s.year > 0 ? String(s.year) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {/* Open PDF indicator */}
        {s.file_url && (
          <div className="flex justify-end pt-1">
            <span
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: "var(--color-primary)" }}
            >
              Open PDF
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </span>
          </div>
        )}
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
function PaperLibrary() {
  const [filterUniversity, setFilterUniversity] = useState<string>("ALL");
  const [filterProg, setFilterProg] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterSubject, setFilterSubject] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("semester");

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
      if (filterUniversity !== "ALL" && e.university !== filterUniversity) return false;
      if (filterProg !== "ALL" && e.programme !== filterProg) return false;
      if (filterCategory !== "ALL" && e.category !== filterCategory) return false;
      if (filterSubject !== "ALL" && e.subject !== filterSubject) return false;
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
  }, [filterUniversity, filterProg, filterCategory, filterSubject, sortKey]);

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

  return (
    <div className="mt-6 space-y-4">
      {/* University filter */}
      {universities.length > 2 && (
        <div className="flex flex-wrap gap-1">
          {universities.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => handleUniversityClick(u)}
              className={`toggle-btn${filterUniversity === u ? " active" : ""}`}
            >
              {u}
            </button>
          ))}
        </div>
      )}

      {/* Programme filter */}
      <div className="flex flex-wrap gap-1">
        {programmes.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handleProgClick(p)}
            className={`toggle-btn${filterProg === p ? " active" : ""}`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Category filter */}
      {categories.length > 2 && (
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => {
            const colors = c !== "ALL" && CAT_COLORS[c] ? CAT_COLORS[c] : null;
            return (
              <button
                key={c}
                type="button"
                onClick={() => handleCategoryClick(c)}
                className={`toggle-btn${filterCategory === c ? " active" : ""}`}
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
        <div className="flex flex-wrap gap-1">
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterSubject(s)}
              className={`toggle-btn${filterSubject === s ? " active" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Sort controls + count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {filtered.length} paper{filtered.length !== 1 ? "s" : ""} in registry
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Sort:</span>
          {(["semester", "code", "name", "credits"] as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortKey(key)}
              className="text-[11px] px-2 py-0.5 rounded-full border transition-colors"
              style={
                sortKey === key
                  ? { background: "var(--color-primary)", color: "#fff", borderColor: "var(--color-primary)" }
                  : { background: "transparent", color: "var(--color-text-muted)", borderColor: "var(--color-border)" }
              }
            >
              {key === "semester" ? "Semester" : key === "code" ? "Code" : key === "name" ? "Name" : "Credits"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--color-text-muted)" }}>
          No papers match the selected filters.
        </p>
      ) : (
        Array.from(groupedBySubject.entries()).map(([subject, subjectEntries]) => {
          // Sub-group by semester within each subject
          const bySem = groupBySemester(subjectEntries);
          return (
            <div key={subject}>
              {/* Subject heading */}
              <h3
                className="text-base font-bold mt-6 mb-3 pb-1 flex items-center gap-2"
                style={{ borderBottom: "2px solid var(--color-primary)" }}
              >
                <span style={{ color: "var(--color-primary)" }}>{subject}</span>
                <span
                  className="text-[11px] font-normal rounded-full px-2 py-0.5"
                  style={{ background: "var(--color-accent-soft)", color: "var(--color-text-muted)" }}
                >
                  {subjectEntries.length} paper{subjectEntries.length !== 1 ? "s" : ""}
                </span>
              </h3>

              {sortKey === "semester" ? (
                // Group by semester when sorting by semester
                Array.from(bySem.entries()).map(([sem, entries]) => (
                  <div key={sem} className="mb-4">
                    <h4
                      className="text-sm font-semibold mb-2 pb-1"
                      style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                    >
                      {semLabel(sem)}
                    </h4>
                    <PaperTable entries={entries} catColors={CAT_COLORS} />
                  </div>
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

/** Reusable paper rows table. */
function PaperTable({
  entries,
  catColors,
}: {
  entries: SyllabusRegistryEntry[];
  catColors: typeof PAPER_TYPE_COLORS;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr
            className="text-xs uppercase text-left"
            style={{ color: "var(--color-text-muted)" }}
          >
            <th className="pb-2 pr-3 font-medium">Paper Code</th>
            <th className="pb-2 pr-3 font-medium">Paper Name</th>
            <th className="pb-2 pr-3 font-medium">Cat.</th>
            <th className="pb-2 pr-3 font-medium">Credits</th>
            <th className="pb-2 font-medium">Units</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e: SyllabusRegistryEntry) => {
            const colors = e.category && catColors[e.category] ? catColors[e.category] : null;
            const hasUnits = (e.units?.length ?? 0) > 0;
            return (
              <tr
                key={e.paper_code}
                className="border-t transition-colors hover:opacity-80"
                style={{ borderColor: "var(--color-border)" }}
              >
                <td className="py-2 pr-3">
                  <Link
                    href={`/syllabus/paper/${encodeURIComponent(e.paper_code)}`}
                    className="font-mono text-xs font-semibold hover:underline"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {e.paper_code}
                  </Link>
                </td>
                <td className="py-2 pr-3">
                  <Link
                    href={`/syllabus/paper/${encodeURIComponent(e.paper_code)}`}
                    className="hover:underline text-xs"
                  >
                    {e.paper_name}
                  </Link>
                </td>
                <td className="py-2 pr-3">
                  {e.category && colors ? (
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: colors.bg, color: colors.text }}
                    >
                      {e.category}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {e.category ?? "—"}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {e.credits}
                </td>
                <td className="py-2 text-xs">
                  {hasUnits ? (
                    <span style={{ color: "#16a34a" }}>✓ {e.units!.length}</span>
                  ) : (
                    <span style={{ color: "var(--color-text-muted)" }}>—</span>
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
    <div className="mt-6">
      {/* Tabs */}
      <div
        className="flex gap-0 border-b"
        style={{ borderColor: "var(--color-border)" }}
        role="tablist"
      >
        <button
          role="tab"
          aria-selected={activeTab === "pdfs"}
          type="button"
          onClick={() => setActiveTab("pdfs")}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative"
          style={
            activeTab === "pdfs"
              ? {
                  color: "var(--color-primary)",
                  borderBottom: "2px solid var(--color-primary)",
                  marginBottom: "-1px",
                }
              : { color: "var(--color-text-muted)" }
          }
        >
          Available Syllabus PDFs
          {visibleSyllabi.length > 0 && (
            <span
              className="inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.25rem] h-5 text-[10px] font-semibold"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
            >
              {visibleSyllabi.length}
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "library"}
          type="button"
          onClick={() => setActiveTab("library")}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative"
          style={
            activeTab === "library"
              ? {
                  color: "var(--color-primary)",
                  borderBottom: "2px solid var(--color-primary)",
                  marginBottom: "-1px",
                }
              : { color: "var(--color-text-muted)" }
          }
        >
          Paper Syllabus Library
          <span
            className="inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.25rem] h-5 text-[10px] font-semibold"
            style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
          >
            {SYLLABUS_REGISTRY.length}
          </span>
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "pdfs" && (
        <div role="tabpanel" aria-label="Available Syllabus PDFs" className="mt-6 space-y-10">
          {/* Departmental Syllabus section */}
          {deptSyllabi.length > 0 && (
            <div>
              <h2
                className="text-base font-bold mb-1 pb-1 flex items-center gap-2"
                style={{ borderBottom: "2px solid var(--color-primary)" }}
              >
                <span style={{ color: "var(--color-primary)" }}>Departmental Syllabus</span>
                <span
                  className="text-[11px] font-normal rounded-full px-2 py-0.5"
                  style={{ background: "var(--color-accent-soft)", color: "var(--color-text-muted)" }}
                >
                  {deptSyllabi.length}
                </span>
              </h2>
              <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
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
                  className="text-base font-bold mb-1 pb-1 flex items-center gap-2"
                  style={{ borderBottom: "2px solid var(--color-primary)" }}
                >
                  <span style={{ color: "var(--color-primary)" }}>Semester Syllabi</span>
                  <span
                    className="text-[11px] font-normal rounded-full px-2 py-0.5"
                    style={{ background: "var(--color-accent-soft)", color: "var(--color-text-muted)" }}
                  >
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
