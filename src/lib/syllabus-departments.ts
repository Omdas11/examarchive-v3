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
      "Assam University Assamese FYUG syllabus — DSC, honours and MIL papers from Haflong Government College. Unit-wise syllabus with lectures, free PDF downloads.",
    keywords: ["Assam University Assamese syllabus", "Assamese FYUG syllabus", "Assamese syllabus PDF"],
  },
  bengali: {
    slug: "bengali",
    name: "Bengali",
    subjectCode: "BEN",
    blurb:
      "Assam University Bengali FYUG syllabus — Honours (HCC), DSC, Generic Elective and MIL papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University Bengali syllabus", "Bengali FYUG syllabus", "Bengali syllabus PDF"],
  },
  botany: {
    slug: "botany",
    name: "Botany",
    subjectCode: "BOT",
    blurb:
      "Assam University Botany FYUG syllabus — Plant Physiology, Genetics, Ecology honours and DSC papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University Botany syllabus", "Botany FYUG syllabus", "Botany syllabus PDF"],
  },
  chemistry: {
    slug: "chemistry",
    name: "Chemistry",
    subjectCode: "CHM",
    blurb:
      "Assam University Chemistry FYUG syllabus — Organic, Inorganic and Physical Chemistry honours and DSC papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University Chemistry syllabus", "Chemistry FYUG syllabus", "Chemistry syllabus PDF"],
  },
  commerce: {
    slug: "commerce",
    name: "Commerce",
    subjectCode: "COM",
    blurb:
      "Assam University Commerce FYUG syllabus — Accounting and Business Studies papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University Commerce syllabus", "Commerce FYUG syllabus", "B.Com syllabus PDF"],
  },
  economics: {
    slug: "economics",
    name: "Economics",
    subjectCode: "ECO",
    blurb:
      "Assam University Economics FYUG syllabus — Microeconomics and Macroeconomics papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University Economics syllabus", "Economics FYUG syllabus", "Economics syllabus PDF"],
  },
  english: {
    slug: "english",
    name: "English",
    subjectCode: "ENG",
    blurb:
      "Assam University English FYUG syllabus — British Poetry, Communication Skills, SEC and honours papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University English syllabus", "English FYUG syllabus", "English syllabus PDF"],
  },
  history: {
    slug: "history",
    name: "History",
    subjectCode: "HIS",
    blurb:
      "Assam University History FYUG syllabus — Ancient, Medieval, Modern India and Assam History papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University History syllabus", "History FYUG syllabus", "History syllabus PDF"],
  },
  mathematics: {
    slug: "mathematics",
    name: "Mathematics",
    subjectCode: "MTM",
    blurb:
      "Assam University Mathematics FYUG syllabus — Algebra, Calculus and Differential Equations honours and DSC papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University Mathematics syllabus", "Maths FYUG syllabus", "Mathematics syllabus PDF"],
  },
  philosophy: {
    slug: "philosophy",
    name: "Philosophy",
    subjectCode: "PHI",
    blurb:
      "Assam University Philosophy FYUG syllabus — Logic, Ethics and Indian Philosophy papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University Philosophy syllabus", "Philosophy FYUG syllabus", "Philosophy syllabus PDF"],
  },
  physics: {
    slug: "physics",
    name: "Physics",
    subjectCode: "PHY",
    blurb:
      "Assam University Physics FYUG syllabus — Mathematical Physics, Mechanics and Quantum Mechanics honours and DSC papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University Physics syllabus", "Physics FYUG syllabus", "Physics syllabus PDF"],
  },
  "political-science": {
    slug: "political-science",
    name: "Political Science",
    subjectCode: "POL",
    blurb:
      "Assam University Political Science FYUG syllabus — Political Theory and Indian Government papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University Political Science syllabus", "Political Science FYUG syllabus", "Political Science syllabus PDF"],
  },
  zoology: {
    slug: "zoology",
    name: "Zoology",
    subjectCode: "ZOO",
    blurb:
      "Assam University Zoology FYUG syllabus — Animal Diversity, Physiology and Genetics honours and DSC papers from Haflong Government College. Unit-wise syllabus, free PDF downloads.",
    keywords: ["Assam University Zoology syllabus", "Zoology FYUG syllabus", "Zoology syllabus PDF"],
  },
};

export const SYLLABUS_DEPARTMENT_SLUGS = Object.keys(SYLLABUS_DEPARTMENTS);
