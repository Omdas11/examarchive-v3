/**
 * Course selection data for the FYUGP programme.
 *
 * Based on the choosing format rules from the institution's academic regulations:
 * - The same subject cannot be DSC, DSM, and IDC simultaneously.
 * - Two DSMs must be selected: one first minor and one second minor.
 * - One literature as DSC + other literature(s) as DSM/IDC is not allowed.
 * - SEC (Skill Enhancement Course) is chosen from the DSC/DSM subject pool.
 */

/** Subjects that are only available as DSM (not DSC). */
export const DSM_ONLY_SUBJECTS: ReadonlyArray<string> = [
  "Industrial Fish and Fisheries",
];

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

/** All subjects available per DSC/DSM cluster (Annexure III). */
export const CLUSTERS: Record<string, ReadonlyArray<string>> = {
  "Cluster-I": [
    "Physics",
    "Chemistry",
    "Mathematics",
    "Statistics",
    "Geology",
    "Computer Science",
    "Computer Application",
    "Economics",
  ],
  "Cluster-II": [
    "Botany",
    "Zoology",
    "Anthropology",
    "Chemistry",
    "Statistics",
    "Mathematics",
    "Biotechnology",
    "Computer Science",
    "Computer Application",
    "Industrial Fish and Fisheries",
    "Ecology and Environmental Science",
    "Information Technology",
  ],
  "Cluster-III": [
    "Political Science",
    "History",
    "Economics",
    "Philosophy",
    "Geography",
    "Sociology",
    "Business Administration",
    "English",
    "Arabic",
    "Bengali",
    "Hindi",
    "Sanskrit",
    "Urdu",
    "Manipuri",
    "Bodo",
    "Assamese",
    "Education",
    "Persian",
    "Commerce",
    "Ecology and Environmental Science",
    "Computer Application",
    "Statistics",
    "Mathematics",
    "Mass Communication",
  ],
};

export type ClusterName = keyof typeof CLUSTERS;

/**
 * Flat, deduplicated, sorted list of all DSC/DSM subjects across all clusters.
 * Used when displaying subjects without cluster grouping.
 */
export const ALL_DSC_DSM_SUBJECTS: ReadonlyArray<string> = Array.from(
  new Set(Object.values(CLUSTERS).flat()),
).sort();

/** Subjects available per IDC basket (Annexure II). */
export const IDC_BASKETS: Record<string, ReadonlyArray<string>> = {
  "Natural Sciences (NS)": [
    "Physics",
    "Chemistry",
    "Mathematics",
    "Botany",
    "Zoology",
    "Geology",
    "Anthropology",
    "Ecology & Environmental Science",
    "Biotechnology",
    "Computer Science",
    "Microbiology",
    "Statistics",
    "Geography",
    "Computer Application (only Science component)",
    "Industrial Fish and Fisheries",
    "Information Technology",
  ],
  "Social Sciences (SS)": [
    "Political Science",
    "History",
    "Sociology",
    "Philosophy",
    "Lib. Science",
    "Economics",
    "Geography",
    "Education",
    "Anthropology",
  ],
  "Humanities (HN)": [
    "Sanskrit",
    "Urdu",
    "Arabic",
    "English",
    "Bengali",
    "Hindi",
    "Manipuri",
    "Visual Arts",
    "Performing Arts",
    "Persian",
    "Assamese",
    "Bodo",
    "Mass Communication",
    "French",
    "Hmar",
    "Nepali",
    "Mizo",
  ],
  "Commerce and Management (CM)": ["Commerce", "Business Administration"],
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

/** Save course preferences to localStorage. */
export function saveCoursePrefs(prefs: CoursePreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COURSE_PREFS_KEY, JSON.stringify(prefs));
    dispatchCoursePrefsUpdated();
  } catch {
    // Ignore storage errors
  }
}

/** Clear saved course preferences from localStorage. */
export function clearCoursePrefs(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(COURSE_PREFS_KEY);
    dispatchCoursePrefsUpdated();
  } catch {
    // Ignore storage errors
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesNormalizedField(field: string, normalizedValue: string): boolean {
  if (field === normalizedValue) return true;
  return new RegExp(`(^| )${escapeRegExp(normalizedValue)}( |$)`).test(field);
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
