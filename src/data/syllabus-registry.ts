/**
 * Central Syllabus Metadata Registry
 *
 * Each entry represents a course paper with its canonical metadata.
 * When users upload a syllabus PDF they only need to enter paper_code +
 * university; the rest of the metadata (paper_name, semester, subject,
 * credits, programme) auto-fills from this registry.
 *
 * To add new entries, append objects conforming to SyllabusRegistryEntry
 * below. Group entries by university for readability.
 *
 * See docs/syllabus-system.md for the full schema specification.
 */

export interface SyllabusRegistryEntry {
  /** Unique paper identifier, e.g. "CC-1.1CH" or "DSC101". */
  paper_code: string;
  /** Full descriptive name of the paper. */
  paper_name: string;
  /** Semester number (1–8). */
  semester: number;
  /** Subject / disciplinary area (e.g. "Chemistry", "Political Science"). */
  subject: string;
  /** Credit weighting for the paper. */
  credits: number;
  /** Academic programme framework (e.g. "CBCS", "FYUG", "Annual"). */
  programme: string;
  /** University or institution that offers this paper. */
  university: string;
}

// ── Registry entries ────────────────────────────────────────────────────────

export const SYLLABUS_REGISTRY: SyllabusRegistryEntry[] = [
  // ── University of Delhi – CBCS (B.Sc.) ─────────────────────────────────
  {
    paper_code: "CC-1.1CH",
    paper_name: "Inorganic Chemistry I",
    semester: 1,
    subject: "Chemistry",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-1.2CH",
    paper_name: "Organic Chemistry I",
    semester: 1,
    subject: "Chemistry",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-2.1CH",
    paper_name: "Physical Chemistry I",
    semester: 2,
    subject: "Chemistry",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-3.1CH",
    paper_name: "Inorganic Chemistry II",
    semester: 3,
    subject: "Chemistry",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-3.2CH",
    paper_name: "Organic Chemistry II",
    semester: 3,
    subject: "Chemistry",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-4.1CH",
    paper_name: "Physical Chemistry II",
    semester: 4,
    subject: "Chemistry",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-1.1MA",
    paper_name: "Calculus and Geometry",
    semester: 1,
    subject: "Mathematics",
    credits: 6,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-2.1MA",
    paper_name: "Algebra",
    semester: 2,
    subject: "Mathematics",
    credits: 6,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-3.1MA",
    paper_name: "Real Analysis",
    semester: 3,
    subject: "Mathematics",
    credits: 6,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-4.1MA",
    paper_name: "Differential Equations",
    semester: 4,
    subject: "Mathematics",
    credits: 6,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-5.1MA",
    paper_name: "Multivariate Calculus",
    semester: 5,
    subject: "Mathematics",
    credits: 6,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-6.1MA",
    paper_name: "Ring Theory and Linear Algebra I",
    semester: 6,
    subject: "Mathematics",
    credits: 6,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-1.1PH",
    paper_name: "Mathematical Physics I",
    semester: 1,
    subject: "Physics",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-2.1PH",
    paper_name: "Mechanics",
    semester: 2,
    subject: "Physics",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-3.1PH",
    paper_name: "Electricity and Magnetism",
    semester: 3,
    subject: "Physics",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-4.1PH",
    paper_name: "Waves and Optics",
    semester: 4,
    subject: "Physics",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-5.1PH",
    paper_name: "Quantum Mechanics and Applications",
    semester: 5,
    subject: "Physics",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  {
    paper_code: "CC-6.1PH",
    paper_name: "Thermal Physics",
    semester: 6,
    subject: "Physics",
    credits: 4,
    programme: "CBCS",
    university: "University of Delhi",
  },
  // ── University of Delhi – FYUG ──────────────────────────────────────────
  {
    paper_code: "FYUG-101",
    paper_name: "English Language and Communication",
    semester: 1,
    subject: "English",
    credits: 4,
    programme: "FYUG",
    university: "University of Delhi",
  },
  {
    paper_code: "FYUG-102",
    paper_name: "Environmental Science",
    semester: 1,
    subject: "Environmental Science",
    credits: 2,
    programme: "FYUG",
    university: "University of Delhi",
  },
  {
    paper_code: "FYUG-CS101",
    paper_name: "Fundamentals of Computing",
    semester: 1,
    subject: "Computer Science",
    credits: 4,
    programme: "FYUG",
    university: "University of Delhi",
  },
  {
    paper_code: "FYUG-CS201",
    paper_name: "Data Structures",
    semester: 2,
    subject: "Computer Science",
    credits: 4,
    programme: "FYUG",
    university: "University of Delhi",
  },
  {
    paper_code: "FYUG-CS301",
    paper_name: "Database Management Systems",
    semester: 3,
    subject: "Computer Science",
    credits: 4,
    programme: "FYUG",
    university: "University of Delhi",
  },
  {
    paper_code: "FYUG-CS401",
    paper_name: "Operating Systems",
    semester: 4,
    subject: "Computer Science",
    credits: 4,
    programme: "FYUG",
    university: "University of Delhi",
  },
  {
    paper_code: "FYUG-CS501",
    paper_name: "Computer Networks",
    semester: 5,
    subject: "Computer Science",
    credits: 4,
    programme: "FYUG",
    university: "University of Delhi",
  },
  {
    paper_code: "FYUG-CS601",
    paper_name: "Compiler Design",
    semester: 6,
    subject: "Computer Science",
    credits: 4,
    programme: "FYUG",
    university: "University of Delhi",
  },
  {
    paper_code: "FYUG-EC101",
    paper_name: "Principles of Microeconomics",
    semester: 1,
    subject: "Economics",
    credits: 6,
    programme: "FYUG",
    university: "University of Delhi",
  },
  {
    paper_code: "FYUG-EC201",
    paper_name: "Macroeconomics I",
    semester: 2,
    subject: "Economics",
    credits: 6,
    programme: "FYUG",
    university: "University of Delhi",
  },
  {
    paper_code: "FYUG-EC301",
    paper_name: "Intermediate Microeconomics",
    semester: 3,
    subject: "Economics",
    credits: 6,
    programme: "FYUG",
    university: "University of Delhi",
  },
  {
    paper_code: "FYUG-EC401",
    paper_name: "Intermediate Macroeconomics",
    semester: 4,
    subject: "Economics",
    credits: 6,
    programme: "FYUG",
    university: "University of Delhi",
  },
  // ── Generic / Multi-university entries ─────────────────────────────────
  {
    paper_code: "GEN-ENG101",
    paper_name: "English Communication Skills",
    semester: 1,
    subject: "English",
    credits: 2,
    programme: "CBCS",
    university: "General",
  },
  {
    paper_code: "GEN-EVS101",
    paper_name: "Environmental Studies",
    semester: 2,
    subject: "Environmental Science",
    credits: 2,
    programme: "CBCS",
    university: "General",
  },
];

/**
 * Look up a registry entry by paper code and optional university.
 * Returns the first matching entry, or undefined if not found.
 */
export function findByPaperCode(
  paperCode: string,
  university?: string,
): SyllabusRegistryEntry | undefined {
  const code = paperCode.trim().toUpperCase();
  return SYLLABUS_REGISTRY.find((e) => {
    const codeMatch = e.paper_code.toUpperCase() === code;
    if (!codeMatch) return false;
    if (university) {
      return e.university.toLowerCase() === university.toLowerCase();
    }
    return true;
  });
}

/**
 * Return all entries for a given university, optionally filtered by programme.
 */
export function getByUniversity(
  university: string,
  programme?: string,
): SyllabusRegistryEntry[] {
  return SYLLABUS_REGISTRY.filter((e) => {
    const uniMatch = e.university.toLowerCase() === university.toLowerCase();
    if (!uniMatch) return false;
    if (programme) return e.programme.toLowerCase() === programme.toLowerCase();
    return true;
  });
}

/**
 * Return all entries grouped by semester.
 */
export function groupBySemester(
  entries: SyllabusRegistryEntry[],
): Map<number, SyllabusRegistryEntry[]> {
  const map = new Map<number, SyllabusRegistryEntry[]>();
  for (const e of entries) {
    const list = map.get(e.semester) ?? [];
    list.push(e);
    map.set(e.semester, list);
  }
  return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
}
