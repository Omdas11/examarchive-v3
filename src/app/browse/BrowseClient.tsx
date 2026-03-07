"use client";

import { useState, useMemo } from "react";
import PaperCard from "@/components/PaperCard";
import { PAPER_TYPE_COLORS } from "@/components/PaperCard";
import type { Paper } from "@/types";

interface BrowseClientProps {
  initialPapers: Paper[];
  availableYears: number[];
  availableStreams: string[];
  availablePaperTypes: string[];
  isAdmin: boolean;
}

const PROGRAMMES = ["ALL", "FYUGP", "CBCS", "Other"];

type SortKey = "newest" | "oldest" | "title_asc" | "title_desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title_asc", label: "Title A → Z" },
  { value: "title_desc", label: "Title Z → A" },
];

export default function BrowseClient({
  initialPapers,
  availableYears,
  availableStreams,
  availablePaperTypes,
  isAdmin,
}: BrowseClientProps) {
  const [search, setSearch] = useState("");
  const [activeProgramme, setActiveProgramme] = useState("ALL");
  const [activePaperType, setActivePaperType] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = initialPapers.filter((p) => !hiddenIds.has(p.id));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.course_code.toLowerCase().includes(q) ||
          p.course_name.toLowerCase().includes(q),
      );
    }

    if (activeProgramme !== "ALL") {
      if (activeProgramme === "Other") {
        list = list.filter(
          (p) => !p.programme || (p.programme !== "FYUGP" && p.programme !== "CBCS"),
        );
      } else {
        list = list.filter((p) => p.programme === activeProgramme);
      }
    }

    if (activePaperType) {
      list = list.filter((p) => p.paper_type === activePaperType);
    }

    if (activeStream) {
      list = list.filter(
        (p) =>
          p.department.toUpperCase().includes(activeStream) ||
          p.course_name.toUpperCase().includes(activeStream),
      );
    }

    if (activeYear) {
      list = list.filter((p) => p.year === activeYear);
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
  }, [initialPapers, hiddenIds, search, activeProgramme, activePaperType, activeStream, activeYear, sortKey]);

  async function handleSoftDelete(paperId: string) {
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
  }

  const activeSort = SORT_OPTIONS.find((o) => o.value === sortKey)!;
  const streams = availableStreams.length > 0 ? availableStreams : [];
  const years = availableYears.length > 0 ? availableYears : [];

  return (
    <>
      {/* Programme toggles */}
      <div className="mt-6 flex flex-wrap gap-2">
        {PROGRAMMES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setActiveProgramme(p); setActivePaperType(null); }}
            className={`toggle-btn${activeProgramme === p ? " active" : ""}`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Paper type toggles — shown when there are types from the data OR programme is FYUGP/CBCS */}
      {availablePaperTypes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {availablePaperTypes.map((pt) => {
            const colors = PAPER_TYPE_COLORS[pt];
            const isActive = activePaperType === pt;
            return (
              <button
                key={pt}
                type="button"
                onClick={() => setActivePaperType(isActive ? null : pt)}
                className={`toggle-btn${isActive ? " active" : ""}`}
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

      {/* Stream toggles */}
      {streams.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {streams.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActiveStream(activeStream === s ? null : s)}
              className={`toggle-btn${activeStream === s ? " active" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Year toggles */}
      {years.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setActiveYear(activeYear === y ? null : y)}
              className={`toggle-btn${activeYear === y ? " active" : ""}`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Search + sort row */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Search papers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field flex-1"
        />

        {/* Sort dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((o) => !o)}
            className="toggle-btn whitespace-nowrap"
            style={sortOpen ? { borderColor: "var(--color-primary)", color: "var(--color-primary)" } : undefined}
          >
            {activeSort.label} ▾
          </button>
          {sortOpen && (
            <ul
              className="absolute right-0 mt-1 z-50 rounded-lg py-1 shadow-lg min-w-[160px]"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
              role="listbox"
            >
              {SORT_OPTIONS.map((opt) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === sortKey}
                  onMouseDown={() => { setSortKey(opt.value); setSortOpen(false); }}
                  className="cursor-pointer px-4 py-2 text-sm transition-colors hover:opacity-70"
                  style={opt.value === sortKey ? { color: "var(--color-primary)", fontWeight: 600 } : undefined}
                >
                  {opt.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {filtered.length} paper{filtered.length !== 1 ? "s" : ""} found
      </p>

      {/* Papers grid */}
      {filtered.length > 0 ? (
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
