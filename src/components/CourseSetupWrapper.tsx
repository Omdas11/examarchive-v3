"use client";

/**
 * CourseSetupWrapper
 *
 * Client component mounted in the root layout. Detects when a logged-in user
 * has not yet set up their course preferences and shows the CourseSelectionModal
 * automatically.
 *
 * Preferences are persisted in localStorage under the key `ea_course_prefs`.
 * If the user dismisses ("Skip for now") a flag is set in `ea_course_prefs_skipped`
 * so the popup is not shown again on the same session.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { loadCoursePrefs, type CoursePreferences } from "@/data/course-selection-data";

// Lazy-load the modal so it does not inflate the initial bundle
const CourseSelectionModal = dynamic(
  () => import("@/components/CourseSelectionModal"),
  { ssr: false },
);

interface CourseSetupWrapperProps {
  /** True when a user is currently authenticated. */
  isLoggedIn: boolean;
}

const SKIPPED_KEY = "ea_course_prefs_skipped";

export default function CourseSetupWrapper({
  isLoggedIn,
}: CourseSetupWrapperProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [existingPrefs, setExistingPrefs] = useState<CoursePreferences | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;

    const prefs = loadCoursePrefs();
    setExistingPrefs(prefs);

    // Show the modal automatically when prefs are missing and not previously
    // skipped in this browser session.
    if (!prefs) {
      const skipped = sessionStorage.getItem(SKIPPED_KEY);
      if (!skipped) {
        setModalOpen(true);
      }
    }
  }, [isLoggedIn]);

  function handleClose(saved: boolean) {
    setModalOpen(false);
    if (!saved) {
      // Mark as skipped for this session so it doesn't auto-reappear
      sessionStorage.setItem(SKIPPED_KEY, "1");
    } else {
      // Reload prefs after save
      setExistingPrefs(loadCoursePrefs());
    }
  }

  if (!isLoggedIn) return null;

  return (
    <CourseSelectionModal
      open={modalOpen}
      onClose={handleClose}
      initialPrefs={existingPrefs}
    />
  );
}
