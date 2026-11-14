import { extractSubjectCode } from "@/lib/syllabus-table";

/**
 * The 13 Haflong Government College departments in the syllabus library.
 *
 * Single source of truth for the /syllabus department directory, the
 * /syllabus/[department] pages, and the sitemap. The `subjectCode` is the
 * 3-letter code used in paper codes and in the Syllabus_Table `subject`
 * field (e.g. PHYDSC401T -> PHY); `name` matches the `department` field
 * of the syllabus collection's departmental PDFs.
 *
 * Verified against live data 2026-11-05: 13 departments, 511 syllabus
 * papers, 2,789 published syllabus-table rows.
 */
export interface SyllabusDeptInfo {
  slug: string;
  name: string;
  subjectCode: string;
  blurb: string;
  keywords: string[];
}

export const SYLLABUS_DEPARTMENTS: Record<string, SyllabusDeptInfo> = {
  assamese: {
    slug: "assamese",
    name: "Assamese",
    subjectCode: "ASM",
    blurb:
      "DSC, honours and MIL papers.",
    keywords: ["Assam University Assamese syllabus", "Assamese FYUG syllabus", "Assamese syllabus PDF"],
  },
  bengali: {
    slug: "bengali",
    name: "Bengali",
    subjectCode: "BEN",
    blurb:
      "Honours (HCC), DSC, Generic Elective and MIL papers.",
    keywords: ["Assam University Bengali syllabus", "Bengali FYUG syllabus", "Bengali syllabus PDF"],
  },
  botany: {
    slug: "botany",
    name: "Botany",
    subjectCode: "BOT",
    blurb:
      "Plant Physiology, Genetics and Ecology — honours and DSC papers.",
    keywords: ["Assam University Botany syllabus", "Botany FYUG syllabus", "Botany syllabus PDF"],
  },
  chemistry: {
    slug: "chemistry",
    name: "Chemistry",
    subjectCode: "CHM",
    blurb:
      "Organic, Inorganic and Physical Chemistry — honours and DSC papers.",
    keywords: ["Assam University Chemistry syllabus", "Chemistry FYUG syllabus", "Chemistry syllabus PDF"],
  },
  commerce: {
    slug: "commerce",
    name: "Commerce",
    subjectCode: "COM",
    blurb:
      "Accounting and Business Studies papers.",
    keywords: ["Assam University Commerce syllabus", "Commerce FYUG syllabus", "B.Com syllabus PDF"],
  },
  economics: {
    slug: "economics",
    name: "Economics",
    subjectCode: "ECO",
    blurb:
      "Microeconomics and Macroeconomics papers.",
    keywords: ["Assam University Economics syllabus", "Economics FYUG syllabus", "Economics syllabus PDF"],
  },
  english: {
    slug: "english",
    name: "English",
    subjectCode: "ENG",
    blurb:
      "British Poetry, Communication Skills, SEC and honours papers.",
    keywords: ["Assam University English syllabus", "English FYUG syllabus", "English syllabus PDF"],
  },
  history: {
    slug: "history",
    name: "History",
    subjectCode: "HIS",
    blurb:
      "Ancient, Medieval and Modern India, and Assam History papers.",
    keywords: ["Assam University History syllabus", "History FYUG syllabus", "History syllabus PDF"],
  },
  mathematics: {
    slug: "mathematics",
    name: "Mathematics",
    subjectCode: "MTM",
    blurb:
      "Algebra, Calculus and Differential Equations — honours and DSC papers.",
    keywords: ["Assam University Mathematics syllabus", "Maths FYUG syllabus", "Mathematics syllabus PDF"],
  },
  philosophy: {
    slug: "philosophy",
    name: "Philosophy",
    subjectCode: "PHI",
    blurb:
      "Logic, Ethics and Indian Philosophy papers.",
    keywords: ["Assam University Philosophy syllabus", "Philosophy FYUG syllabus", "Philosophy syllabus PDF"],
  },
  physics: {
    slug: "physics",
    name: "Physics",
    subjectCode: "PHY",
    blurb:
      "Mathematical Physics, Mechanics and Quantum Mechanics — honours and DSC papers.",
    keywords: ["Assam University Physics syllabus", "Physics FYUG syllabus", "Physics syllabus PDF"],
  },
  "political-science": {
    slug: "political-science",
    name: "Political Science",
    subjectCode: "POL",
    blurb:
      "Political Theory and Indian Government papers.",
    keywords: ["Assam University Political Science syllabus", "Political Science FYUG syllabus", "Political Science syllabus PDF"],
  },
  zoology: {
    slug: "zoology",
    name: "Zoology",
    subjectCode: "ZOO",
    blurb:
      "Animal Diversity, Physiology and Genetics — honours and DSC papers.",
    keywords: ["Assam University Zoology syllabus", "Zoology FYUG syllabus", "Zoology syllabus PDF"],
  },
};

export const SYLLABUS_DEPARTMENT_SLUGS = Object.keys(SYLLABUS_DEPARTMENTS);

/** Department slug for a paper code (e.g. PHYDSC401T -> "physics"). */
export function syllabusDeptSlugForPaperCode(paperCode: string): string | undefined {
  const subjectCode = extractSubjectCode(paperCode);
  return Object.values(SYLLABUS_DEPARTMENTS).find(
    (d) => d.subjectCode === subjectCode,
  )?.slug;
}

/** Department info for a 3-letter subject code (e.g. "PHY" -> physics). */
export function syllabusDeptBySubjectCode(subjectCode: string): SyllabusDeptInfo | undefined {
  const code = subjectCode.trim().toUpperCase();
  return Object.values(SYLLABUS_DEPARTMENTS).find((d) => d.subjectCode === code);
}

/**
 * Resolve a Syllabus_Table `subject` field value to its department.
 *
 * The data is inconsistent: Mathematics rows store the 3-letter code
 * ("MTM") but the other 12 departments store the full name ("Physics",
 * "Political Science", ...). So match the value against the subject code
 * first, then against the department name. Returns undefined when the
 * value matches no department.
 */
export function syllabusDeptForSubjectValue(subject: string): SyllabusDeptInfo | undefined {
  const v = subject.trim().toUpperCase();
  if (!v) return undefined;
  const byCode = Object.values(SYLLABUS_DEPARTMENTS).find((d) => d.subjectCode === v);
  if (byCode) return byCode;
  return Object.values(SYLLABUS_DEPARTMENTS).find((d) => d.name.toUpperCase() === v);
}
