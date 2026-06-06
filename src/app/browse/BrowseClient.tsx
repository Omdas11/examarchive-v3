"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import PaperCard from "@/components/PaperCard";
import { PAPER_TYPE_COLORS } from "@/components/PaperCard";
import CustomSelect from "@/components/CustomSelect";
import Breadcrumb from "@/components/Breadcrumb";
import { SkeletonGrid } from "@/components/SkeletonCard";
import type { Paper } from "@/types";
import {
  COURSE_PREFS_UPDATED_EVENT,
  loadCoursePrefs,
  matchesCoursePreferenceSelection,
  type CoursePreferences,
} from "@/data/course-selection-data";

interface BrowseClientProps {
  initialPapers: Paper[];
  availableYears: number[];
  availableStreams: string[];
  availablePaperTypes: string[];
  availableUniversities: string[];
  isAdmin: boolean;
  initialSearch?: string;
}

const PROGRAMMES = ["FYUGP", "CBCS", "ALL", "Other"];

type SortKey = "newest" | "oldest" | "title_asc" | "title_desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title_asc", label: "Title A → Z" },
  { value: "title_desc", label: "Title Z → A" },
];

/** Debounce hook */
function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function BrowseClient({
  initialPapers,
  availableYears,
  availableStreams,
  availablePaperTypes,
  availableUniversities,
  isAdmin,
  initialSearch = "",
}: BrowseClientProps) {
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 250);
  const [activeProgramme, setActiveProgramme] = useState("ALL");
  const [activePaperType, setActivePaperType] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [activeUniversity, setActiveUniversity] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [coursePrefs, setCoursePrefs] = useState<CoursePreferences | null>(null);
  const [myCoursesActive, setMyCoursesActive] = useState(false);

  // Simulate initial skeleton loading — no mountedRef guard so this works
  // correctly under React Strict Mode's double-invoke of effects.
  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // Load course preferences from localStorage and keep in sync with changes
  useEffect(() => {
    setCoursePrefs(loadCoursePrefs());

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

  const filtered = useMemo(() => {
    let list = initialPapers.filter((p) => !hiddenIds.has(p.id));

    // "My Courses" filter — show only papers matching the saved subject for the paper type
    if (myCoursesActive && coursePrefs) {
      list = list.filter(
        (p) =>
          matchesCoursePreferenceSelection({
            prefs: coursePrefs,
            category: p.paper_type,
            fallbackCode: p.course_code,
            subjectFields: [p.department, p.course_name],
            valueFields: [p.title, p.course_name, p.course_code],
          }),
      );
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (p) =>
          (p.title ?? "").toLowerCase().includes(q) ||
          (p.course_code ?? "").toLowerCase().includes(q) ||
          p.course_name.toLowerCase().includes(q),
      );
    }

    if (!myCoursesActive && activeProgramme !== "ALL") {
      if (activeProgramme === "Other") {
        list = list.filter(
          (p) => !p.programme || (p.programme !== "FYUGP" && p.programme !== "CBCS"),
        );
      } else {
        list = list.filter((p) => p.programme === activeProgramme);
      }
    }

    if (!myCoursesActive && activePaperType) {
      list = list.filter((p) => p.paper_type === activePaperType);
    }

    if (!myCoursesActive && activeStream) {
      list = list.filter(
        (p) =>
          p.department.toUpperCase().includes(activeStream) ||
          p.course_name.toUpperCase().includes(activeStream),
      );
    }

    if (!myCoursesActive && activeYear) {
      list = list.filter((p) => p.year === activeYear);
    }

    if (!myCoursesActive && activeUniversity) {
      list = list.filter((p) => p.institution === activeUniversity);
    }

    switch (sortKey) {
      case "newest":
        list = [...list].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        break;
      case "oldest":
        list = [...list].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        break;
      case "title_asc":
        list = [...list].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title_desc":
        list = [...list].sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return list;
  }, [initialPapers, hiddenIds, debouncedSearch, activeProgramme, activePaperType, activeStream, activeYear, activeUniversity, sortKey, myCoursesActive, coursePrefs]);

  const handleSoftDelete = useCallback(async (paperId: string) => {
    if (!confirm("Hide this paper from Browse? It can be restored from the admin panel.")) return;
    setDeleting(paperId);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "soft-delete", id: paperId }),
      });
      const json = await res.json();
      if (json.success) {
        setHiddenIds((prev) => new Set([...prev, paperId]));
      } else {
        alert(json.error ?? "Delete failed");
      }
    } catch {
      alert("Network error");
    } finally {
      setDeleting(null);
    }
  }, []);

  const streams = availableStreams.length > 0 ? availableStreams : [];
  const years = availableYears.length > 0 ? availableYears : [];
  const universities = availableUniversities.length > 0 ? availableUniversities : [];

  // Build breadcrumb items based on active filters
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/browse" },
    ...(activeUniversity ? [{ label: activeUniversity }] : []),
    ...(activeProgramme !== "ALL" ? [{ label: activeProgramme }] : []),
    ...(activePaperType ? [{ label: activePaperType }] : []),
    ...(activeStream ? [{ label: activeStream }] : []),
    ...(activeYear ? [{ label: String(activeYear) }] : []),
  ];

  return (
    <>
      {/* Breadcrumb navigation */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Search input — debounced live search */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1 group">
          <label htmlFor="browse-search" className="sr-only">
            Search papers
          </label>
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 text-primary group-focus-within:scale-110 transition-transform"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined font-bold text-lg">search</span>
          </span>
          <input
            id="browse-search"
            type="search"
            placeholder="Search papers by title, code, or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-full py-3.5 pl-12 pr-6 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface transition-all shadow-sm"
          />
        </div>
        <CustomSelect
          name="sort"
          options={SORT_OPTIONS}
          placeholder="Sort by"
          value={sortKey}
          onChange={(v) => setSortKey(v as SortKey)}
          className="sm:w-52"
        />
      </div>

      {/* My Courses banner — shown when course prefs are set */}
      {coursePrefs && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl p-4 border border-primary/10 shadow-sm"
          style={{
            background: myCoursesActive
              ? "var(--brand-emerald-soft)"
              : "var(--color-bg)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-lift text-primary shrink-0">
              <span className="material-symbols-outlined font-bold text-xl">school</span>
            </div>
            <div className="min-w-0">
              <span
                className="text-xs font-black uppercase tracking-widest block"
                style={{ color: "var(--brand-emerald-dark)" }}
              >
                My Academic Profile
              </span>
              <span className="text-xs font-medium truncate block opacity-70" style={{ color: "var(--color-text-muted)" }}>
                {coursePrefs.dsc} · {coursePrefs.dsm1}, {coursePrefs.dsm2}
                {coursePrefs.sec ? ` · ${coursePrefs.sec}` : ""}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMyCoursesActive((v) => !v)}
            className="shrink-0 rounded-full px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95"
            style={{
              background: myCoursesActive ? "var(--color-primary)" : "var(--color-surface)",
              color: myCoursesActive ? "#fff" : "var(--color-primary)",
              border: "1px solid var(--color-primary)",
            }}
          >
            {myCoursesActive ? "✓ Active Filter" : "Enable My Courses"}
          </button>
        </div>
      )}

      {/* Filter chips — hidden when "My Courses" filter is active */}
      {!myCoursesActive && (
        <div className="mt-6 space-y-4">
          {/* University filter */}
          {universities.length > 1 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] uppercase tracking-[0.15em] font-black opacity-40 mr-2">University</span>
              <button
                type="button"
                onClick={() => setActiveUniversity(null)}
                className={`filter-chip rounded-full px-5 py-2 text-xs font-bold border transition-all ${activeUniversity === null ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-surface text-on-surface-variant border-outline-variant/10 hover:border-primary/30"}`}
              >
                All
              </button>
              {universities.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setActiveUniversity(activeUniversity === u ? null : u)}
                  className={`filter-chip rounded-full px-5 py-2 text-xs font-bold border transition-all ${activeUniversity === u ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-surface text-on-surface-variant border-outline-variant/10 hover:border-primary/30"}`}
                >
                  {u}
                </button>
              ))}
            </div>
          )}

          {/* Programme filter */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] uppercase tracking-[0.15em] font-black opacity-40 mr-2">Stream</span>
            {PROGRAMMES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setActiveProgramme(p); setActivePaperType(null); }}
                className={`filter-chip rounded-full px-5 py-2 text-xs font-bold border transition-all ${activeProgramme === p ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-surface text-on-surface-variant border-outline-variant/10 hover:border-primary/30"}`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Paper type filter chips */}
          {availablePaperTypes.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] uppercase tracking-[0.15em] font-black opacity-40 mr-2">Category</span>
              {availablePaperTypes.map((pt) => {
                const isActive = activePaperType === pt;
                return (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setActivePaperType(isActive ? null : pt)}
                    className={`filter-chip rounded-full px-5 py-2 text-xs font-bold border transition-all ${isActive ? "bg-secondary text-white border-secondary shadow-lg shadow-secondary/20" : "bg-surface text-on-surface-variant border-outline-variant/10 hover:border-secondary/30"}`}
                  >
                    {pt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Stream filter */}
          {streams.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] uppercase tracking-[0.15em] font-black opacity-40 mr-2">Department</span>
              {streams.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setActiveStream(activeStream === s ? null : s)}
                  className={`filter-chip rounded-full px-5 py-2 text-xs font-bold border transition-all ${activeStream === s ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-surface text-on-surface-variant border-outline-variant/10 hover:border-primary/30"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Year filter */}
          {years.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] uppercase tracking-[0.15em] font-black opacity-40 mr-2">Year</span>
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setActiveYear(activeYear === y ? null : y)}
                  className={`filter-chip rounded-full px-5 py-2 text-xs font-bold border transition-all ${activeYear === y ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-surface text-on-surface-variant border-outline-variant/10 hover:border-primary/30"}`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
        Showing {filtered.length} paper{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Papers grid with skeleton loading */}
      {showSkeleton ? (
        <SkeletonGrid count={6} />
      ) : filtered.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className="relative group">
              <PaperCard paper={p} />
              {isAdmin && (
                <button
                  type="button"
                  title="Hide this paper"
                  disabled={deleting === p.id}
                  onClick={() => handleSoftDelete(p.id)}
                  className="absolute top-4 right-4 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest shadow-lg opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                  style={{
                    background: "var(--danger-red)",
                    color: "#fff",
                  }}
                >
                  {deleting === p.id ? "…" : "Hide"}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-20 text-center py-20 bg-surface-container-low rounded-[3rem] border border-dashed border-outline-variant/30">
          <div className="w-16 h-16 rounded-full bg-surface mx-auto flex items-center justify-center text-on-surface-variant/20 mb-4 shadow-inner">
            <span className="material-symbols-outlined font-black text-3xl">sentiment_dissatisfied</span>
          </div>
          <h3 className="text-lg font-extrabold tracking-tight">No Resources Found</h3>
          <p className="mt-2 text-sm font-medium text-on-surface-variant opacity-60">Try adjusting your filters or search query</p>
        </div>
      )}
    </>
  );
}
