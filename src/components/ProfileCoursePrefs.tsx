"use client";

/**
 * ProfileCoursePrefs
 *
 * Client component that reads course preferences from localStorage and
 * renders them as a card. Used on the Profile page and in the Sidebar.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  COURSE_PREFS_UPDATED_EVENT,
  loadCoursePrefs,
  type CoursePreferences,
} from "@/data/course-selection-data";

interface ProfileCoursePrefsProps {
  /** When true, shows a compact single-line summary suitable for the sidebar. */
  compact?: boolean;
}

export default function ProfileCoursePrefs({ compact = false }: ProfileCoursePrefsProps) {
  const [prefs, setPrefs] = useState<CoursePreferences | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPrefs(loadCoursePrefs());

    function handleStorage(e: StorageEvent) {
      if (e.key === "ea_course_prefs") {
        setPrefs(loadCoursePrefs());
      }
    }
    function handleCoursePrefsUpdated() {
      setPrefs(loadCoursePrefs());
    }
    window.addEventListener("storage", handleStorage);
    window.addEventListener(COURSE_PREFS_UPDATED_EVENT, handleCoursePrefsUpdated);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(COURSE_PREFS_UPDATED_EVENT, handleCoursePrefsUpdated);
    };
  }, []);

  // Avoid hydration mismatch
  if (!mounted) return null;

  if (compact) {
    return (
      <div className="card p-3">
        <h3
          className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
          style={{ color: "var(--nav-teal)" }}
        >
          🎓 My Courses
        </h3>
        {prefs ? (
          <div className="space-y-1 text-xs">
            {[
              { label: "DSC", value: prefs.dsc },
              { label: "DSM 1", value: prefs.dsm1 },
              { label: "DSM 2", value: prefs.dsm2 },
              ...(prefs.sec ? [{ label: "SEC", value: prefs.sec }] : []),
              ...(prefs.idc ? [{ label: "IDC", value: prefs.idc }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-1">
                <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
                <span
                  className="font-medium truncate max-w-[110px]"
                  title={value}
                  style={{ color: "var(--color-text)" }}
                >
                  {value || "—"}
                </span>
              </div>
            ))}
            <Link
              href="/settings"
              className="block mt-2 text-[11px] underline"
              style={{ color: "var(--nav-teal)" }}
            >
              Edit courses →
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Not set up yet.
            </p>
            <Link
              href="/settings"
              className="block mt-1 text-[11px] underline"
              style={{ color: "var(--nav-teal)" }}
            >
              Set up courses →
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Full card view for profile page
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-base font-semibold">My Course Selection</h2>
        <Link
          href="/settings"
          className="text-xs font-medium underline"
          style={{ color: "var(--color-primary)" }}
        >
          {prefs ? "Edit" : "Set up"}
        </Link>
      </div>
      {prefs ? (
        <dl className="space-y-2 text-sm">
          {[
            { label: "DSC (Core)", value: prefs.dsc },
            { label: "DSM 1 (First Minor)", value: prefs.dsm1 },
            { label: "DSM 2 (Second Minor)", value: prefs.dsm2 },
            { label: "SEC (Skill Enhancement)", value: prefs.sec },
            { label: "IDC (Interdisciplinary)", value: prefs.idc },
            { label: "AEC (Ability Enhancement)", value: prefs.aec },
            { label: "VAC (Value Added)", value: prefs.vac },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-2">
              <dt style={{ color: "var(--color-text-muted)" }}>{label}</dt>
              <dd className="font-medium text-right">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>
            You haven&apos;t set up your course preferences yet.
          </p>
          <Link href="/settings" className="btn-primary text-sm px-4 py-2">
            Set Up My Courses
          </Link>
        </div>
      )}
    </div>
  );
}
