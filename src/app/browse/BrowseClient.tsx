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
  getEnrolledSubjects,
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

const PROGRAMMES = ["ALL", "FYUGP", "CBCS", "Other"];

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

  const enrolledSubjects = useMemo(
    () => (coursePrefs ? getEnrolledSubjects(coursePrefs) : []),
    [coursePrefs],
  );

  const filtered = useMemo(() => {
    let list = initialPapers.filter((p) => !hiddenIds.has(p.id));

    // "My Courses" filter — show only papers matching enrolled subjects
    if (myCoursesActive && enrolledSubjects.length > 0) {
      const lower = enrolledSubjects.map((s) => s.toLowerCase());
      list = list.filter(
        (p) =>
          lower.some(
            (s) =>
              p.department.toLowerCase().includes(s) ||
              p.course_name.toLowerCase().includes(s) ||
              (p.title ?? "").toLowerCase().includes(s) ||
              (p.course_code ?? "").toLowerCase().includes(s),
          ),
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
  }, [initialPapers, hiddenIds, debouncedSearch, activeProgramme, activePaperType, activeStream, activeYear, activeUniversity, sortKey, myCoursesActive, enrolledSubjects]);

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
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="browse-search" className="sr-only">
            Search papers
          </label>
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--color-text-muted)" }}
            aria-hidden="true"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            id="browse-search"
            type="search"
            placeholder="Search papers by title, code, or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field flex-1 pl-10"
          />
        </div>
        <CustomSelect
          name="sort"
          options={SORT_OPTIONS}
          placeholder="Sort by"
          value={sortKey}
          onChange={(v) => setSortKey(v as SortKey)}
          className="sm:w-44"
        />
      </div>

      {/* My Courses banner — shown when course prefs are set */}
      {coursePrefs && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
          style={{
            background: myCoursesActive
              ? "color-mix(in srgb, var(--nav-teal) 10%, var(--color-surface))"
              : "color-mix(in srgb, var(--color-border) 30%, var(--color-surface))",
            border: `1px solid ${myCoursesActive ? "var(--nav-teal)" : "var(--color-border)"}`,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-xs font-semibold"
              style={{ color: myCoursesActive ? "var(--nav-teal)" : "var(--color-text-muted)" }}
            >
              🎓 My Courses:
            </span>
            <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
              DSC: {coursePrefs.dsc} · DSM: {coursePrefs.dsm1}, {coursePrefs.dsm2}
              {coursePrefs.sec ? ` · SEC: ${coursePrefs.sec}` : ""}
              {coursePrefs.idc ? ` · IDC: ${coursePrefs.idc}` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMyCoursesActive((v) => !v)}
            className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors"
            style={{
              background: myCoursesActive ? "var(--nav-teal)" : "transparent",
              color: myCoursesActive ? "#fff" : "var(--nav-teal)",
              border: "1.5px solid var(--nav-teal)",
            }}
          >
            {myCoursesActive ? "✓ Filtered" : "Filter by my courses"}
          </button>
        </div>
      )}

      {/* Filter chips — hidden when "My Courses" filter is active */}
      {!myCoursesActive && (
        <div className="mt-4 space-y-2">
          {/* University filter */}
          {universities.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] uppercase tracking-wider font-semibold self-center mr-1" style={{ color: "var(--color-text-muted)" }}>University</span>
              <button
                type="button"
                onClick={() => setActiveUniversity(null)}
                className={`filter-chip${activeUniversity === null ? " active" : ""}`}
              >
                All
              </button>
              {universities.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setActiveUniversity(activeUniversity === u ? null : u)}
                  className={`filter-chip${activeUniversity === u ? " active" : ""}`}
                >
                  {u}
                </button>
              ))}
            </div>
          )}

          {/* Programme filter */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold self-center mr-1" style={{ color: "var(--color-text-muted)" }}>Stream</span>
            {PROGRAMMES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setActiveProgramme(p); setActivePaperType(null); }}
                className={`filter-chip${activeProgramme === p ? " active" : ""}`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Paper type filter chips */}
          {availablePaperTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] uppercase tracking-wider font-semibold self-center mr-1" style={{ color: "var(--color-text-muted)" }}>Category</span>
              {availablePaperTypes.map((pt) => {
                const colors = PAPER_TYPE_COLORS[pt];
                const isActive = activePaperType === pt;
                return (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setActivePaperType(isActive ? null : pt)}
                    className={`filter-chip${isActive ? " active" : ""}`}
                    style={
                      isActive && colors
                        ? { borderColor: colors.text, color: colors.text, background: colors.bg }
                        : undefined
                    }
                  >
                    {pt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Stream filter */}
          {streams.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] uppercase tracking-wider font-semibold self-center mr-1" style={{ color: "var(--color-text-muted)" }}>Dept</span>
              {streams.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setActiveStream(activeStream === s ? null : s)}
                  className={`filter-chip${activeStream === s ? " active" : ""}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Year filter */}
          {years.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] uppercase tracking-wider font-semibold self-center mr-1" style={{ color: "var(--color-text-muted)" }}>Year</span>
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setActiveYear(activeYear === y ? null : y)}
                  className={`filter-chip${activeYear === y ? " active" : ""}`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {filtered.length} paper{filtered.length !== 1 ? "s" : ""} found
      </p>

      {/* Papers grid with skeleton loading */}
      {showSkeleton ? (
        <SkeletonGrid count={6} />
      ) : filtered.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className="relative group">
              <PaperCard paper={p} />
              {isAdmin && (
                <button
                  type="button"
                  title="Hide this paper"
                  disabled={deleting === p.id}
                  onClick={() => handleSoftDelete(p.id)}
                  className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: "var(--color-primary)",
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
        <div className="mt-12 text-center">
          <svg className="mx-auto h-12 w-12 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
          </svg>
          <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>No papers found.</p>
        </div>
      )}
    </>
  );
}
