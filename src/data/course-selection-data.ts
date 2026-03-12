/**
 * Course selection data for the FYUGP programme.
 *
 * Based on the choosing format rules from the institution's academic regulations:
 * - DSC and DSM must be from the same cluster (Cluster I, II, or III).
 * - The same subject cannot be DSC, DSM, and IDC simultaneously.
 * - Two DSMs must be selected: one first minor and one second minor.
 * - One literature as DSC + other literature(s) as DSM/IDC is not allowed.
 */

/** Subjects that are only available as DSM (not DSC) in their cluster. */
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
  /** Chosen cluster (e.g. "Cluster-I"). */
  cluster: string;
  /** Discipline Specific Core subject. */
  dsc: string;
  /** First DSM (Discipline Specific Minor). */
  dsm1: string;
  /** Second DSM. */
  dsm2: string;
  /** IDC basket name (e.g. "Natural Sciences (NS)"). */
  idcBasket: string;
  /** IDC subject. */
  idc: string;
  /** Ability Enhancement Course option. */
  aec: string;
  /** Value Added Course option. */
  vac: string;
  /** ISO timestamp when preferences were saved. */
  savedAt: string;
}

/** localStorage key used to persist course preferences. */
export const COURSE_PREFS_KEY = "ea_course_prefs";

/** Read course preferences from localStorage (browser-only). */
export function loadCoursePrefs(): CoursePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COURSE_PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CoursePreferences;
  } catch {
    return null;
  }
}

/** Save course preferences to localStorage. */
export function saveCoursePrefs(prefs: CoursePreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COURSE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

/** Clear saved course preferences from localStorage. */
export function clearCoursePrefs(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(COURSE_PREFS_KEY);
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
  if (prefs.idc) subjects.add(prefs.idc);
  return Array.from(subjects);
}
