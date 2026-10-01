/**
 * Curated official study-resource links for Haflong Government College FYUGP
 * students. Kept as a plain data file so new links can be added without
 * touching any component code. Rendered by src/app/study-resources/page.tsx.
 */

/** Link categories shown as sections on the Study Resources page. */
export type StudyResourceCategory =
  | "Official"
  | "University"
  | "Study Platforms";

/** A single curated study-resource link. */
export interface StudyResource {
  title: string;
  url: string;
  description: string;
  category: StudyResourceCategory;
}

export const STUDY_RESOURCES: ReadonlyArray<StudyResource> = [
  // ── Official: college & university ──────────────────────────────
  {
    title: "Haflong Government College",
    url: "https://haflonggovtcollege.ac.in",
    description:
      "Official college website — admission notices, exam schedules, department updates and official announcements.",
    category: "Official",
  },
  {
    title: "Assam University, Silchar",
    url: "https://aus.ac.in",
    description:
      "University portal — exam routines, results, and official notifications for all affiliated colleges including HGC.",
    category: "Official",
  },
  {
    title: "Assam University FYUGP Syllabus",
    url: "https://aus.ac.in",
    description:
      "Official UG syllabus for the Four Year Undergraduate Programme (NEP 2020). Look under Academics → Syllabus on the university site.",
    category: "University",
  },
  {
    title: "ExamArchive Syllabus Vault",
    url: "https://syllabus.examarchive.dev",
    description:
      "Our own syllabus repository — FYUGP syllabi organized by department and paper code.",
    category: "University",
  },
  // ── Study platforms (free, national) ────────────────────────────
  {
    title: "NCERT e-Pathshala",
    url: "https://epathshala.nic.in",
    description:
      "Free NCERT e-books, audio and video resources — useful for FYUGP foundation and general-education courses.",
    category: "Study Platforms",
  },
  {
    title: "NPTEL",
    url: "https://nptel.ac.in",
    description:
      "Free video courses from IITs and IISc — great for core science subjects like Physics, Chemistry and Mathematics.",
    category: "Study Platforms",
  },
  {
    title: "SWAYAM",
    url: "https://swayam.gov.in",
    description:
      "Government of India's free online courses across school and higher education, with certification options.",
    category: "Study Platforms",
  },
  {
    title: "e-PG Pathshala",
    url: "https://epgp.inflibnet.ac.in",
    description:
      "UGC's free e-content modules — deeper reading material for advanced UG and honours-level topics.",
    category: "Study Platforms",
  },
];

/** Section order for the Study Resources page. */
export const STUDY_RESOURCE_CATEGORIES: ReadonlyArray<StudyResourceCategory> = [
  "Official",
  "University",
  "Study Platforms",
];
