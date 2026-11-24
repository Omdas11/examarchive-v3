/**
 * Course selection data for the FYUGP programme.
 *
 * Based on the choosing format rules from the institution's academic regulations:
 * - The same subject cannot be DSC, DSM, and IDC simultaneously.
 * - Two DSMs must be selected: one first minor and one second minor.
 * - One literature as DSC + other literature(s) as DSM/IDC is not allowed.
 * - SEC (Skill Enhancement Course) is chosen from the DSC/DSM subject pool.
 */

/**
 * Strictly supported subject set for course preference selection.
 * This intentionally mirrors the currently available subjects in syllabus-registry
 * so users only select tracks that have real papers/syllabus coverage.
 */
export const AVAILABLE_SUBJECTS: ReadonlyArray<string> = [
  "Assamese",
  "Bengali",
  "Botany",
  "Chemistry",
  "Commerce",
  "Economics",
  "English",
  "History",
  "Mathematics",
  "Philosophy",
  "Physics",
  "Political Science",
  "Zoology",
];

/** Subjects that are only available as DSM (not DSC). */
export const DSM_ONLY_SUBJECTS: ReadonlyArray<string> = [];

/** Literature subjects — applying to the literature constraint. */
export const LITERATURE_SUBJECTS: ReadonlyArray<string> = [
  "English",
  "Arabic",
  "Bengali",
  "Hindi",
  "Sanskrit",
  "Urdu",
  "Manipuri",
  "Bodo",
  "Assamese",
  "Persian",
];

/** All subjects available per DSC/DSM cluster. */
export const CLUSTERS: Record<string, ReadonlyArray<string>> = {
  "Cluster-I": AVAILABLE_SUBJECTS,
};

export type ClusterName = keyof typeof CLUSTERS;

/**
 * Flat, deduplicated, sorted list of all DSC/DSM subjects across all clusters.
 * Used when displaying subjects without cluster grouping.
 */
export const ALL_DSC_DSM_SUBJECTS: ReadonlyArray<string> = Array.from(
  new Set(Object.values(CLUSTERS).flat()),
).sort();

/** Subjects available per IDC basket. */
export const IDC_BASKETS: Record<string, ReadonlyArray<string>> = {
  "Available Subjects": AVAILABLE_SUBJECTS,
};

export type IDCBasketName = keyof typeof IDC_BASKETS;

/**
 * Flat, deduplicated, sorted list of all IDC subjects across all baskets.
 * Used when displaying IDC subjects without basket grouping.
 */
export const ALL_IDC_SUBJECTS: ReadonlyArray<string> = Array.from(
  new Set(Object.values(IDC_BASKETS).flat()),
).sort();

export const AEC_OPTIONS: ReadonlyArray<string> = ["English", "Bengali", "Other"];

/** Current semester options (FYUGP 1st–8th). Stored as "1".."8". */
export const SEMESTER_OPTIONS: ReadonlyArray<string> = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
];

/** "1" -> "1st Semester", "2" -> "2nd Semester", ...; "" -> "". */
export function semesterLabel(semester: string | number | null | undefined): string {
  if (semester === "" || semester === null || semester === undefined) return "";
  const n = typeof semester === "number" ? semester : parseInt(semester, 10);
  if (!Number.isFinite(n) || n < 1 || n > 8) return "";
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix} Semester`;
}

/** "1" -> "1st Sem", ...; "" -> "". Short form for table cells. */
export function semesterShort(semester: string | number | null | undefined): string {
  const label = semesterLabel(semester);
  return label ? label.replace(" Semester", " Sem") : "";
}

export const VAC_OPTIONS: ReadonlyArray<string> = [
  "UI",
  "NSS",
  "NCC",
  "Sports",
  "DTS",
  "HW",
  "Yoga",
  "GCS",
];

/** Stored user course preferences. */
export interface CoursePreferences {
  /** Current semester ("1".."8"); "" when not set yet. */
  semester: string;
  /** Discipline Specific Core subject. */
  dsc: string;
  /** First DSM (Discipline Specific Minor). */
  dsm1: string;
  /** Second DSM. */
  dsm2: string;
  /** SEC (Skill Enhancement Course) subject. */
  sec: string;
  /** IDC subject (from the combined IDC subject pool). */
  idc: string;
  /** Ability Enhancement Course option. */
  aec: string;
  /** Value Added Course option. */
  vac: string;
  /** ISO timestamp when preferences were saved. */
  savedAt: string;
  /** @deprecated Retained for backward compat with v1 prefs that stored cluster. */
  cluster?: string;
  /** @deprecated Retained for backward compat. Use `idc` instead. */
  idcBasket?: string;
}

export type CoursePreferenceCategory =
  | "DSC"
  | "DSM"
  | "SEC"
  | "IDC"
  | "AEC"
  | "VAC";

const COURSE_PREFERENCE_CATEGORIES = [
  "DSC",
  "DSM",
  "SEC",
  "IDC",
  "AEC",
  "VAC",
] as const;

/** localStorage key used to persist course preferences. */
export const COURSE_PREFS_KEY = "ea_course_prefs";
export const COURSE_PREFS_UPDATED_EVENT = "ea-course-prefs-updated";

function dispatchCoursePrefsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COURSE_PREFS_UPDATED_EVENT));
}

/** Read course preferences from localStorage (browser-only). */
export function loadCoursePrefs(): CoursePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COURSE_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CoursePreferences> | null;
    if (!parsed) return null;
    return {
      semester: parsed.semester ?? "",
      dsc: parsed.dsc ?? "",
      dsm1: parsed.dsm1 ?? "",
      dsm2: parsed.dsm2 ?? "",
      sec: parsed.sec ?? "",
      idc: parsed.idc ?? "",
      aec: parsed.aec ?? "",
      vac: parsed.vac ?? "",
      savedAt: parsed.savedAt ?? "",
      cluster: parsed.cluster,
      idcBasket: parsed.idcBasket,
    };
  } catch {
    return null;
  }
}

/** Save course preferences to localStorage (and mirror them to the server). */
export function saveCoursePrefs(prefs: CoursePreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COURSE_PREFS_KEY, JSON.stringify(prefs));
    dispatchCoursePrefsUpdated();
  } catch {
    // Ignore storage errors
  }
  // Mirror to the server (best-effort; local prefs stay the source of truth).
  void syncCoursePrefsToServer(prefs).then((ok) => {
    if (!ok) return;
    try {
      localStorage.setItem(COURSE_PREFS_SYNCED_KEY, prefs.savedAt);
    } catch {
      // Ignore storage errors
    }
  });
}

/** Clear saved course preferences from localStorage (and from the server). */
export function clearCoursePrefs(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(COURSE_PREFS_KEY);
    localStorage.removeItem(COURSE_PREFS_SYNCED_KEY);
    dispatchCoursePrefsUpdated();
  } catch {
    // Ignore storage errors
  }
  // Remove the server copy too (best-effort).
  void fetch("/api/profile/course-prefs", { method: "DELETE" }).catch(() => undefined);
}

/** localStorage key marking which savedAt value was last synced to the server. */
export const COURSE_PREFS_SYNCED_KEY = "ea_course_prefs_synced";

/**
 * POST the 7 course fields to /api/profile/course-prefs.
 * Best-effort: returns false on any failure (including a guest 401).
 */
export async function syncCoursePrefsToServer(prefs: CoursePreferences): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/profile/course-prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        semester: prefs.semester ?? "",
        dsc: prefs.dsc ?? "",
        dsm1: prefs.dsm1 ?? "",
        dsm2: prefs.dsm2 ?? "",
        sec: prefs.sec ?? "",
        idc: prefs.idc ?? "",
        aec: prefs.aec ?? "",
        vac: prefs.vac ?? "",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * One-time sync of local course prefs to the server. Safe to call on mount.
 * - Local prefs exist and were never synced (or changed since the last sync)
 *   -> POST them, then mark them synced.
 * - No local prefs -> GET the server copy and restore it locally (new device).
 * No-ops after the first successful sync. Failures are silent; local prefs
 * keep working without the server.
 */
export async function syncLocalCoursePrefsIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const prefs = loadCoursePrefs();
    if (prefs) {
      if (localStorage.getItem(COURSE_PREFS_SYNCED_KEY) === prefs.savedAt) return;
      const ok = await syncCoursePrefsToServer(prefs);
      if (ok) localStorage.setItem(COURSE_PREFS_SYNCED_KEY, prefs.savedAt);
      return;
    }
    const res = await fetch("/api/profile/course-prefs");
    if (!res.ok) return;
    const data = (await res.json()) as { prefs?: Partial<CoursePreferences> | null };
    if (data.prefs && (data.prefs.dsc || data.prefs.dsm1 || data.prefs.dsm2 || data.prefs.semester)) {
      const now = new Date().toISOString();
      saveCoursePrefs({
        semester: data.prefs.semester ?? "",
        dsc: data.prefs.dsc ?? "",
        dsm1: data.prefs.dsm1 ?? "",
        dsm2: data.prefs.dsm2 ?? "",
        sec: data.prefs.sec ?? "",
        idc: data.prefs.idc ?? "",
        aec: data.prefs.aec ?? "",
        vac: data.prefs.vac ?? "",
        savedAt: now,
      });
      localStorage.setItem(COURSE_PREFS_SYNCED_KEY, now);
    }
  } catch {
    // Best-effort only; local prefs keep working without the server.
  }
}

/**
 * Return the subjects a user is enrolled in based on their course prefs.
 * Useful for filtering browse / syllabus results.
 */
export function getEnrolledSubjects(prefs: CoursePreferences): string[] {
  const subjects = new Set<string>();
  if (prefs.dsc) subjects.add(prefs.dsc);
  if (prefs.dsm1) subjects.add(prefs.dsm1);
  if (prefs.dsm2) subjects.add(prefs.dsm2);
  if (prefs.sec) subjects.add(prefs.sec);
  if (prefs.idc) subjects.add(prefs.idc);
  return Array.from(subjects);
}

function normalizeCourseValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/ and /g, " & ")
    .replace(/[^a-z0-9&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesNormalizedField(field: string, normalizedValue: string): boolean {
  if (field === normalizedValue) return true;
  return (` ${field} `).includes(` ${normalizedValue} `);
}

export function getCoursePreferenceMap(
  prefs: CoursePreferences,
): Record<CoursePreferenceCategory, string[]> {
  return {
    DSC: prefs.dsc ? [prefs.dsc] : [],
    DSM: [prefs.dsm1, prefs.dsm2].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    ),
    SEC: prefs.sec ? [prefs.sec] : [],
    IDC: prefs.idc ? [prefs.idc] : [],
    AEC: prefs.aec ? [prefs.aec] : [],
    VAC: prefs.vac ? [prefs.vac] : [],
  };
}

export function normalizeCoursePreferenceCategory(
  rawCategory?: string | null,
  fallbackCode?: string | null,
): CoursePreferenceCategory | null {
  const upperCategory = rawCategory?.trim().toUpperCase();
  if (upperCategory && COURSE_PREFERENCE_CATEGORIES.includes(upperCategory as CoursePreferenceCategory)) {
    return upperCategory as CoursePreferenceCategory;
  }

  const upperCode = fallbackCode?.trim().toUpperCase() ?? "";
  for (const token of COURSE_PREFERENCE_CATEGORIES) {
    if (upperCode.includes(token)) return token;
  }

  return null;
}

export function matchesCoursePreferenceSelection({
  prefs,
  category,
  fallbackCode,
  subjectFields,
  valueFields = [],
}: {
  prefs: CoursePreferences;
  category?: string | null;
  fallbackCode?: string | null;
  subjectFields: Array<string | null | undefined>;
  valueFields?: Array<string | null | undefined>;
}): boolean {
  const normalizedCategory = normalizeCoursePreferenceCategory(category, fallbackCode);
  if (!normalizedCategory) return false;

  const selectedValues = getCoursePreferenceMap(prefs)[normalizedCategory];
  if (selectedValues.length === 0) return false;

  if (
    normalizedCategory === "AEC" &&
    selectedValues.some((value) => normalizeCourseValue(value) === "other")
  ) {
    return true;
  }

  const normalizedSubjectFields = subjectFields
    .filter((field): field is string => typeof field === "string")
    .map(normalizeCourseValue)
    .filter((field) => field.length > 0);
  const normalizedValueFields = valueFields
    .filter((field): field is string => typeof field === "string")
    .map(normalizeCourseValue)
    .filter((field) => field.length > 0);

  const normalizedFields =
    normalizedCategory === "VAC" ? normalizedValueFields : normalizedSubjectFields;

  if (normalizedFields.length === 0) return false;

  return selectedValues.some((value) => {
    const normalizedValue = normalizeCourseValue(value);
    return normalizedFields.some((field) => matchesNormalizedField(field, normalizedValue));
  });
}
