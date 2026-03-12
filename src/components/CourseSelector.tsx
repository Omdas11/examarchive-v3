"use client";

import { useState, useEffect } from "react";

/** Storage key for the course preference in localStorage. */
export const COURSE_PREF_KEY = "ea_my_course";

export interface CoursePref {
  programme: string;
  semester: number;
  category: string;
}

export const PROGRAMMES = ["FYUGP", "CBCS", "HONOURS", "NEP"] as const;
export type Programme = (typeof PROGRAMMES)[number];

/**
 * Returns the available paper categories for a given programme and semester.
 *
 * FYUGP rules (mirrors the actual FYUG curriculum structure):
 *  - All semesters: DSC, DSM-1, DSM-2, SEC
 *  - Semesters 1–3: IDC, AEC, VAC are added
 *  - Semester 4+: IDC and VAC are removed (AEC still present)
 *  - Semester 5+: AEC is also removed
 */
export function getCategoriesForProgramme(
  programme: string,
  semester: number,
): string[] {
  const prog = programme.toUpperCase();

  if (prog === "FYUGP" || prog === "FYUG") {
    const base = ["DSC", "DSM-1", "DSM-2", "SEC"];
    if (semester < 4) {
      // Semesters 1-3: full set
      return [...base, "IDC", "AEC", "VAC"];
    } else if (semester === 4) {
      // Semester 4: IDC and VAC removed, AEC still present
      return [...base, "AEC"];
    } else {
      // Semester 5+: AEC also removed
      return base;
    }
  }

  if (prog === "CBCS") {
    return ["CC", "DSC", "DSE", "GEC", "SEC"];
  }

  if (prog === "HONOURS") {
    return ["Core", "Elective", "AECC", "SEC"];
  }

  if (prog === "NEP") {
    return ["Major", "Minor", "IDC", "SEC", "VAC"];
  }

  return [];
}

interface CourseSelectorProps {
  /** Called whenever the course preference changes. */
  onChange?: (pref: CoursePref | null) => void;
  /** Show a compact inline version (for use inside cards). */
  compact?: boolean;
}

/**
 * A client-side course preference selector.
 * Saves the selection to `localStorage` under `ea_my_course`.
 */
export default function CourseSelector({
  onChange,
  compact = false,
}: CourseSelectorProps) {
  const [pref, setPref] = useState<CoursePref | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage after mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(COURSE_PREF_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CoursePref;
        setPref(parsed);
        onChange?.(parsed);
      }
    } catch {
      // ignore parse errors
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function save(updated: CoursePref | null) {
    if (updated) {
      localStorage.setItem(COURSE_PREF_KEY, JSON.stringify(updated));
    } else {
      localStorage.removeItem(COURSE_PREF_KEY);
    }
    setPref(updated);
    onChange?.(updated);
  }

  function handleProgrammeChange(prog: string) {
    const defaultSem = 1;
    const cats = getCategoriesForProgramme(prog, defaultSem);
    save({ programme: prog, semester: defaultSem, category: cats[0] ?? "" });
  }

  function handleSemesterChange(sem: number) {
    const prog = pref?.programme ?? "";
    const cats = getCategoriesForProgramme(prog, sem);
    // If the currently selected category is no longer valid, reset to first
    const currentCat = pref?.category ?? "";
    const newCat = cats.includes(currentCat) ? currentCat : (cats[0] ?? "");
    save({ programme: prog, semester: sem, category: newCat });
  }

  function handleCategoryChange(cat: string) {
    if (!pref) return;
    save({ ...pref, category: cat });
  }

  function handleClear() {
    save(null);
  }

  const categories = pref
    ? getCategoriesForProgramme(pref.programme, pref.semester)
    : [];

  const maxSemesters = pref?.programme === "CBCS" ? 6 : 8;

  if (!mounted) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 items-center">
        {pref ? (
          <>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
            >
              {pref.programme} · Sem {pref.semester}
              {pref.category ? ` · ${pref.category}` : ""}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs underline"
              style={{ color: "var(--color-text-muted)" }}
            >
              Change
            </button>
          </>
        ) : (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            No course selected
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Programme */}
      <div>
        <label className="block text-sm font-medium mb-2">Programme</label>
        <div className="flex flex-wrap gap-2">
          {PROGRAMMES.map((prog) => (
            <button
              key={prog}
              type="button"
              onClick={() => handleProgrammeChange(prog)}
              className="toggle-btn"
              style={
                pref?.programme === prog
                  ? {
                      background: "var(--nav-teal)",
                      borderColor: "var(--nav-teal)",
                      color: "#fff",
                    }
                  : undefined
              }
            >
              {prog}
            </button>
          ))}
        </div>
      </div>

      {/* Semester — only shown once a programme is selected */}
      {pref?.programme && (
        <div>
          <label className="block text-sm font-medium mb-2">Semester</label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: maxSemesters }, (_, i) => i + 1).map((sem) => (
              <button
                key={sem}
                type="button"
                onClick={() => handleSemesterChange(sem)}
                className="toggle-btn"
                style={
                  pref.semester === sem
                    ? {
                        background: "var(--nav-teal)",
                        borderColor: "var(--nav-teal)",
                        color: "#fff",
                      }
                    : undefined
                }
              >
                Sem {sem}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category — only shown for FYUGP and programmes with categories */}
      {pref?.programme && categories.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">Paper Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className="toggle-btn"
                style={
                  pref.category === cat
                    ? {
                        background: "var(--nav-teal)",
                        borderColor: "var(--nav-teal)",
                        color: "#fff",
                      }
                    : undefined
                }
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Show FYUGP-specific rule info */}
          {(pref.programme === "FYUGP" || pref.programme === "FYUG") && (
            <p className="text-[11px] mt-2" style={{ color: "var(--color-text-muted)" }}>
              {pref.semester < 4
                ? "IDC, AEC, and VAC are available in Semesters 1–3."
                : pref.semester === 4
                ? "IDC and VAC are removed from Semester 4 onwards."
                : "AEC is also removed from Semester 5 onwards."}
            </p>
          )}
        </div>
      )}

      {/* Clear */}
      {pref && (
        <div>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs"
            style={{ color: "var(--color-text-muted)", textDecoration: "underline" }}
          >
            Clear course preference
          </button>
        </div>
      )}

      {/* No programme selected hint */}
      {!pref && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Select your programme above to personalise the Syllabus section.
        </p>
      )}
    </div>
  );
}
