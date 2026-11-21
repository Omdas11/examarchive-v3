"use client";

import { useState, useMemo, useCallback, useEffect, type FormEvent } from "react";
import PaperCard from "@/components/PaperCard";
import CustomSelect from "@/components/CustomSelect";
import Breadcrumb from "@/components/Breadcrumb";
import { SkeletonGrid } from "@/components/SkeletonCard";
import type { Paper } from "@/types";
import {
  COURSE_PREFS_UPDATED_EVENT,
  loadCoursePrefs,
  matchesCoursePreferenceSelection,
  syncLocalCoursePrefsIfNeeded,
  type CoursePreferences,
} from "@/data/course-selection-data";
import { getProgramme } from "@/lib/programme";
import { IconCheck } from "@/components/Icons";

interface BrowseClientProps {
  initialPapers: Paper[];
  availableYears: number[];
  availableStreams: string[];
  availablePaperTypes: string[];
  availableUniversities: string[];
  availableSemesters: string[];
  /** Pre-selected university/institute filter (e.g. Haflong Government College). */
  defaultUniversity?: string | null;
  isAdmin: boolean;
  /** True when the viewer is signed in; gates the one-time course-prefs sync. */
  isLoggedIn?: boolean;
  initialSearch?: string;
  initialDepartment?: string | null;
  initialYear?: number | null;
  initialSemester?: string | null;
  initialProgramme?: string;
}

const PROGRAMMES = ["FYUGP", "CBCS", "ALL"];

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

/** Search that ignores hyphens, spaces, dots and case, so "COMDSC" also
    finds "COM-DSC" and "com dsc 152" finds "COMDSC-152T". */
function normalizeSearch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Papers shown per page in the browse grid. */
const PAGE_SIZE = 24;

/** Request-a-paper form shown when no paper matches the current filters.
    Email is required — it is the only way to send the student the paper
    once it is added. Prefilled from the active search/filters. */
function RequestPaperForm({
  streams,
  semesters,
  years,
  initialCode,
  initialSemester,
  initialYear,
  initialDepartment,
}: {
  streams: string[];
  semesters: string[];
  years: number[];
  initialCode: string;
  initialSemester: string | null;
  initialYear: number | null;
  initialDepartment: string | null;
}) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [semester, setSemester] = useState<string>(initialSemester ?? "");
  const [year, setYear] = useState<string>(initialYear ? String(initialYear) : "");
  const [department, setDepartment] = useState<string>(initialDepartment ?? "");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!code.trim() && !name.trim()) {
      setError("Please enter the course code or the paper name.");
      return;
    }
    setError("");
    setStatus("sending");
    try {
      const res = await fetch("/api/request-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_code: code.trim() || null,
          paper_name: name.trim() || null,
          semester: semester || null,
          year: year ? Number(year) : null,
          department: department || null,
          email: email.trim(),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && json.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
        setError(json.error ?? "Could not send the request. Please try again.");
      }
    } catch {
      setStatus("error");
      setError("Network error. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/50 px-5 py-6 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-600 text-white mx-auto flex items-center justify-center mb-3 shadow-lg shadow-emerald-600/30">
          <span className="material-symbols-outlined font-black text-2xl">check</span>
        </div>
        <h4 className="text-base font-extrabold tracking-tight">Request received</h4>
        <p className="mt-1 text-sm font-medium text-on-surface-variant">
          We will email you at <span className="font-bold text-on-surface">{email}</span> when this paper is added.
        </p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-full border border-outline-variant/10 bg-surface px-4 py-3 text-sm font-medium outline-none placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary/20";
  const labelCls = "block text-xs font-bold uppercase tracking-wider opacity-60 mb-1.5";

  return (
    <form onSubmit={submit} className="mt-6 text-left">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="req-code" className={labelCls}>Course code</label>
          <input
            id="req-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. COMDSC-301T"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="req-name" className={labelCls}>Paper name</label>
          <input
            id="req-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Financial Management"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="req-semester" className={labelCls}>Semester</label>
          <select
            id="req-semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className={inputCls}
          >
            <option value="">Select semester</option>
            {semesters.map((s) => (
              <option key={s} value={s}>Sem {s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="req-year" className={labelCls}>Year</label>
          <select
            id="req-year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={inputCls}
          >
            <option value="">Select year</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="req-department" className={labelCls}>Department</label>
          <select
            id="req-department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={inputCls}
          >
            <option value="">Select department</option>
            {streams.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="req-email" className={labelCls}>Your email *</label>
          <input
            id="req-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-5 w-full rounded-full bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
      >
        {status === "sending" ? "Sending request…" : "Request this paper"}
      </button>
      <p className="mt-2 text-center text-xs font-medium opacity-50">
        Your email is only used to send you this paper. We never share it.
      </p>
    </form>
  );
}

export default function BrowseClient({
  initialPapers,
  availableYears,
  availableStreams,
  availablePaperTypes,
  availableUniversities,
  availableSemesters,
  defaultUniversity = null,
  isAdmin,
  isLoggedIn = false,
  initialSearch = "",
  initialDepartment = null,
  initialYear = null,
  initialSemester = null,
  initialProgramme = "ALL",
}: BrowseClientProps) {
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 250);
  const [activeProgramme, setActiveProgramme] = useState(
    PROGRAMMES.includes(initialProgramme) ? initialProgramme : "ALL"
  );
  const [activePaperType, setActivePaperType] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(
    initialDepartment ? initialDepartment.toUpperCase() : null
  );
  const [activeYear, setActiveYear] = useState<number | null>(initialYear);
  const [activeSemester, setActiveSemester] = useState<string | null>(initialSemester);
  const [activeUniversity, setActiveUniversity] = useState<string | null>(defaultUniversity);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [coursePrefs, setCoursePrefs] = useState<CoursePreferences | null>(null);
  const [myCoursesActive, setMyCoursesActive] = useState(false);
  const [page, setPage] = useState(1);

  // Simulate initial skeleton loading — no mountedRef guard so this works
  // correctly under React Strict Mode's double-invoke of effects.
  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // Load course preferences from localStorage and keep in sync with changes
  useEffect(() => {
    setCoursePrefs(loadCoursePrefs());
    // One-time sync of any older local prefs to the server (logged-in only).
    if (isLoggedIn) void syncLocalCoursePrefsIfNeeded();

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

  // Reset to the first page whenever the result set changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeProgramme, activePaperType, activeStream, activeYear, activeSemester, activeUniversity, sortKey, myCoursesActive]);

  // Sync filter state to URL — makes each filter combo a shareable sub-page
  // e.g. /browse?department=bengali&year=2024&semester=4&programme=FYUGP
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    if (activeStream) params.set("department", activeStream.toLowerCase());
    if (activeYear) params.set("year", String(activeYear));
    if (activeSemester) params.set("semester", activeSemester);
    if (activeProgramme !== "ALL") params.set("programme", activeProgramme);
    const qs = params.toString();
    const newUrl = qs ? `/browse?${qs}` : "/browse";
    window.history.replaceState(null, "", newUrl);
  }, [debouncedSearch, activeStream, activeYear, activeSemester, activeProgramme]);

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
      const q = normalizeSearch(debouncedSearch);
      list = list.filter(
        (p) =>
          normalizeSearch(p.title ?? "").includes(q) ||
          normalizeSearch(p.course_code ?? "").includes(q) ||
          normalizeSearch(p.course_name).includes(q),
      );
    }

    if (!myCoursesActive && activeProgramme !== "ALL") {
      list = list.filter((p) => getProgramme(p) === activeProgramme);
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

    if (!myCoursesActive && activeSemester) {
      list = list.filter((p) => p.semester === activeSemester);
    }

    if (!myCoursesActive && activeUniversity) {
      list = list.filter((p) => p.institute === activeUniversity);
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
  }, [initialPapers, hiddenIds, debouncedSearch, activeProgramme, activePaperType, activeStream, activeYear, activeSemester, activeUniversity, sortKey, myCoursesActive, coursePrefs]);

  // Pagination — slice the filtered list into pages.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  /** Compact page-number list: 1 … window … N */
  const pageNumbers = useMemo(() => {
    const nums: (number | "…")[] = [];
    for (let n = 1; n <= totalPages; n++) {
      if (n === 1 || n === totalPages || Math.abs(n - safePage) <= 1) {
        nums.push(n);
      } else if (nums[nums.length - 1] !== "…") {
        nums.push("…");
      }
    }
    return nums;
  }, [totalPages, safePage]);

  const handleSoftDelete = useCallback(async (paperId: string) => {
    if (!confirm("Hide this paper from Browse? It can be restored from the admin panel.")) return;
    setDeleting(paperId);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "soft-delete", id: paperId }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
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
  const semesters = availableSemesters.length > 0 ? availableSemesters : [];

  /** Any search or filter active — controls the "Clear filters" button. */
  const hasActiveFilters =
    debouncedSearch.trim() !== "" ||
    activeProgramme !== "ALL" ||
    activePaperType !== null ||
    activeStream !== null ||
    activeYear !== null ||
    activeSemester !== null ||
    activeUniversity !== defaultUniversity ||
    myCoursesActive;

  /** Reset every filter and the search box back to the page defaults. */
  const clearFilters = useCallback(() => {
    setSearch("");
    setActiveProgramme("ALL");
    setActivePaperType(null);
    setActiveStream(null);
    setActiveYear(null);
    setActiveSemester(null);
    setActiveUniversity(defaultUniversity);
    setMyCoursesActive(false);
  }, [defaultUniversity]);

  // Build breadcrumb items based on active filters
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/browse" },
    ...(activeUniversity ? [{ label: activeUniversity }] : []),
    ...(activeProgramme !== "ALL" ? [{ label: activeProgramme }] : []),
    ...(activePaperType ? [{ label: activePaperType }] : []),
    ...(activeStream ? [{ label: activeStream }] : []),
    ...(activeSemester ? [{ label: `Sem ${activeSemester}` }] : []),
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
            placeholder="Search by title, code, or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-full py-3.5 pl-12 pr-12 text-base font-medium outline-none placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary/20 focus:bg-surface transition-all shadow-sm"
          />
          {/* Clear search — appears once the student has typed something */}
          {search.length > 0 && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container active:scale-95"
            >
              <span className="material-symbols-outlined text-lg font-bold">close</span>
            </button>
          )}
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
            {myCoursesActive ? <span className="inline-flex items-center gap-1"><IconCheck size={14} /> Active Filter</span> : "Enable My Courses"}
          </button>
        </div>
      )}

      {/* Filter chips — hidden when "My Courses" filter is active */}
      {!myCoursesActive && (
        <div className="mt-6 space-y-4">
          {/* College label — hardcoded to Haflong Government College */}
          <div className="flex gap-2 items-center">
            <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] font-black opacity-40 mr-2">College</span>
            <div className="flex gap-2 overflow-x-auto flex-nowrap no-scrollbar py-0.5">
              <span className="shrink-0 rounded-full px-5 py-2 text-xs font-bold border bg-primary text-white border-primary shadow-lg shadow-primary/20">
                Haflong Government College
              </span>
            </div>
          </div>

          {/* Programme filter */}
          <div className="flex gap-2 items-center">
            <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] font-black opacity-40 mr-2">Programme</span>
            <div className="flex gap-2 overflow-x-auto flex-nowrap no-scrollbar py-0.5">
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
          </div>

          {/* Paper type filter chips */}
          {availablePaperTypes.length > 0 && (
            <div className="flex gap-2 items-center">
              <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] font-black opacity-40 mr-2">Category</span>
              <div className="flex gap-2 overflow-x-auto flex-nowrap no-scrollbar py-0.5">
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
            </div>
          )}

          {/* Stream filter */}
          {streams.length > 0 && (
            <div className="flex gap-2 items-center">
              <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] font-black opacity-40 mr-2">Department</span>
              <div className="flex gap-2 overflow-x-auto flex-nowrap no-scrollbar py-0.5">
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
            </div>
          )}

          {/* Year filter */}
          {years.length > 0 && (
            <div className="flex gap-2 items-center">
              <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] font-black opacity-40 mr-2">Year</span>
              <div className="flex gap-2 overflow-x-auto flex-nowrap no-scrollbar py-0.5">
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
            </div>
          )}

          {/* Semester filter — completes the University > Department > Semester > Paper-code drilldown */}
          {semesters.length > 0 && (
            <div className="flex gap-2 items-center">
              <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] font-black opacity-40 mr-2">Semester</span>
              <div className="flex gap-2 overflow-x-auto flex-nowrap no-scrollbar py-0.5">
              {semesters.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setActiveSemester(activeSemester === s ? null : s)}
                  className={`filter-chip rounded-full px-5 py-2 text-xs font-bold border transition-all ${activeSemester === s ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-surface text-on-surface-variant border-outline-variant/10 hover:border-primary/30"}`}
                >
                  Sem {s}
                </button>
              ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live result count + clear-filters button — sits right above the list
          so a student sees the filters worked without scrolling. */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-on-surface">
          {filtered.length === 0
            ? "Showing 0 papers"
            : `Showing ${pageStart}–${pageEnd} of ${filtered.length} paper${filtered.length !== 1 ? "s" : ""}`}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-bold border border-outline-variant/20 bg-surface text-on-surface-variant hover:border-primary/40 hover:text-primary transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-base leading-none">filter_alt_off</span>
            Clear filters
          </button>
        )}
      </div>

      {/* Papers grid with skeleton loading */}
      {showSkeleton ? (
        <SkeletonGrid count={6} />
      ) : paged.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((p) => (
            <div key={p.id} className="relative group">
              <PaperCard paper={p} />
              {isAdmin && (
                <button
                  type="button"
                  title="Hide this paper"
                  disabled={deleting === p.id}
                  onClick={() => handleSoftDelete(p.id)}
                  className="absolute top-4 right-4 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest shadow-lg opacity-0 group-hover:opacity-100 transition-all active:scale-90 z-[60]"
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
        <div className="mt-6 rounded-[2rem] border border-dashed border-outline-variant/30 bg-surface-container-low px-5 py-8 sm:px-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-surface mx-auto flex items-center justify-center text-on-surface-variant/20 mb-4 shadow-inner">
              <span className="material-symbols-outlined font-black text-3xl">sentiment_dissatisfied</span>
            </div>
            <h3 className="text-lg font-extrabold tracking-tight">No Resources Found</h3>
            <p className="mt-2 text-sm font-medium text-on-surface-variant opacity-70">
              Nothing matches these filters. Request the paper below and we will email you a copy when it is added.
            </p>
          </div>
          <RequestPaperForm
            streams={streams}
            semesters={semesters}
            years={years}
            initialCode={
              /\d/.test(debouncedSearch) ||
              /^[A-Za-z]{3}(DSC|DSM|SEC|IDC|AEC|VAC|DSE|GEC|HCC|CC)/i.test(debouncedSearch)
                ? debouncedSearch.trim().toUpperCase()
                : ""
            }
            initialSemester={activeSemester}
            initialYear={activeYear}
            initialDepartment={activeStream}
          />
        </div>
      )}

      {/* Pagination controls */}
      {!showSkeleton && totalPages > 1 && (
        <nav aria-label="Browse pages" className="mt-10 flex items-center justify-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => setPage(safePage - 1)}
            className="rounded-full px-5 py-2 text-xs font-bold border transition-all disabled:opacity-30 bg-surface text-on-surface-variant border-outline-variant/10 hover:border-primary/30"
          >
            ← Prev
          </button>
          {pageNumbers.map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-2 text-xs font-bold opacity-40">…</span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === safePage ? "page" : undefined}
                className={`rounded-full w-9 h-9 text-xs font-bold border transition-all ${n === safePage ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-surface text-on-surface-variant border-outline-variant/10 hover:border-primary/30"}`}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => setPage(safePage + 1)}
            className="rounded-full px-5 py-2 text-xs font-bold border transition-all disabled:opacity-30 bg-surface text-on-surface-variant border-outline-variant/10 hover:border-primary/30"
          >
            Next →
          </button>
        </nav>
      )}
    </>
  );
}
