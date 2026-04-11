import matter from "gray-matter";

export interface IngestionFrontmatter {
  entry_type?: "syllabus" | "question";
  entry_id?: string;
  question_id?: string;
  college?: string;
  university: string;
  course: string;
  stream: string;
  group?: string;
  session?: string;
  exam_session?: string;
  exam_month?: string;
  attempt_type?: string;
  type: string;
  paper_code: string;
  paper_name: string;
  subject: string;
  semester_code?: string;
  semester_no?: number;
  credits?: number;
  marks_total?: number;
  syllabus_pdf_url?: string;
  question_pdf_url?: string;
  source_reference?: string;
  status?: string;
  aliases?: string[];
  keywords?: string[];
  tags?: string[];
  notes?: string;
  version?: number;
  last_updated?: string;
  year?: number;
  exam_year?: number;
  linked_syllabus_entry_id?: string;
  link_status?: string;
  ocr_text_path?: string;
  ai_summary_status?: string;
  difficulty_estimate?: string;
}

export interface ParsedSyllabusRow {
  unit_number: number;
  syllabus_content: string;
  lectures?: number;
  tags: string[];
  line: number;
}

export interface ParsedQuestionRow {
  question_no: string;
  question_subpart: string;
  year?: number;
  question_content: string;
  marks?: number;
  tags: string[];
  line: number;
}

export interface IngestionParseError {
  line: number;
  message: string;
}

export interface IngestionParseResult {
  entryType: "syllabus" | "question" | null;
  frontmatter: IngestionFrontmatter | null;
  syllabus: ParsedSyllabusRow[];
  questions: ParsedQuestionRow[];
  errors: IngestionParseError[];
}

function splitRow(line: string): string[] {
  if (!line.includes("|")) return [];
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  if (cells.length === 0) return [];
  if (cells.every((cell) => cell === "")) return [];
  return cells;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/`/g, "").replace(/\s+/g, "_").trim();
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function deriveSubjectFromPaperCode(paperCode: string): string {
  const normalized = paperCode.trim().toUpperCase();
  return /^[A-Z]{3}/.test(normalized) ? normalized.slice(0, 3) : "";
}

const FIXED_UNIVERSITY = "Assam University";
const FIXED_COURSE = "FYUG";

function findHeadingLine(lines: string[], title: string): number {
  const target = `## ${title}`.toLowerCase();
  return lines.findIndex((line) => line.trim().toLowerCase() === target);
}

function collectSectionLines(lines: string[], startHeadingIndex: number): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];
  for (let i = startHeadingIndex + 1; i < lines.length; i += 1) {
    const text = lines[i];
    if (text.trim().startsWith("## ")) break;
    out.push({ line: i + 1, text });
  }
  return out;
}

function parseTableRows(
  sectionLines: Array<{ line: number; text: string }>,
): Array<{ line: number; row: Record<string, string> }> {
  const tableLines = sectionLines.filter((line) => line.text.trim().startsWith("|"));
  if (tableLines.length < 2) {
    return [];
  }
  const headers = splitRow(tableLines[0].text).map(normalizeHeader);
  const dataLines = tableLines.slice(2);
  return dataLines
    .map(({ line, text }) => {
      const cells = splitRow(text);
      if (cells.length === 0) return null;
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = (cells[idx] || "").trim();
      });
      return { line, row };
    })
    .filter((item): item is { line: number; row: Record<string, string> } => Boolean(item));
}

function parseFrontmatter(data: Record<string, unknown>, errors: IngestionParseError[]): IngestionFrontmatter | null {
  const getString = (...keys: string[]) => {
    for (const key of keys) {
      const value = data[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
    return "";
  };

  const getOptionalString = (...keys: string[]) => {
    const value = getString(...keys);
    return value.length > 0 ? value : undefined;
  };

  const getNumber = (...keys: string[]) => {
    for (const key of keys) {
      const value = data[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return undefined;
  };

  const getStringArray = (...keys: string[]) => {
    for (const key of keys) {
      const value = data[key];
      if (Array.isArray(value)) {
        const parsed = value
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter(Boolean);
        if (parsed.length > 0) return parsed;
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
        if (parsed.length > 0) return parsed;
      }
    }
    return undefined;
  };

  const entryTypeRaw = getString("entry_type").toLowerCase();
  const entryType = entryTypeRaw === "syllabus" || entryTypeRaw === "question"
    ? entryTypeRaw
    : undefined;
  if (entryTypeRaw && !entryType) {
    errors.push({ line: 1, message: 'Invalid entry_type. Expected "syllabus" or "question".' });
  }

  const paperCode = getString("paper_code");
  const subject = getString("subject", "subject_code") || deriveSubjectFromPaperCode(paperCode);
  const frontmatter: IngestionFrontmatter = {
    entry_type: entryType,
    entry_id: getOptionalString("entry_id"),
    question_id: getOptionalString("question_id"),
    college: getOptionalString("college"),
    university: getString("university"),
    course: getString("course"),
    stream: getString("stream"),
    group: getOptionalString("group"),
    session: getOptionalString("session"),
    exam_session: getOptionalString("exam_session"),
    exam_month: getOptionalString("exam_month"),
    attempt_type: getOptionalString("attempt_type"),
    type: getString("type", "paper_type"),
    paper_code: paperCode,
    paper_name: getString("paper_name", "paper_title"),
    subject,
    semester_code: getOptionalString("semester_code"),
    semester_no: getNumber("semester_no"),
    credits: getNumber("credits"),
    marks_total: getNumber("marks_total"),
    syllabus_pdf_url: getOptionalString("syllabus_pdf_url"),
    question_pdf_url: getOptionalString("question_pdf_url"),
    source_reference: getOptionalString("source_reference"),
    status: getOptionalString("status"),
    aliases: getStringArray("aliases"),
    keywords: getStringArray("keywords"),
    tags: getStringArray("tags"),
    notes: getOptionalString("notes"),
    version: getNumber("version"),
    last_updated: getOptionalString("last_updated"),
    year: getNumber("year"),
    exam_year: getNumber("exam_year"),
    linked_syllabus_entry_id: getOptionalString("linked_syllabus_entry_id"),
    link_status: getOptionalString("link_status"),
    ocr_text_path: getOptionalString("ocr_text_path"),
    ai_summary_status: getOptionalString("ai_summary_status"),
    difficulty_estimate: getOptionalString("difficulty_estimate"),
  };

  const hasMissingRequiredField = (["university", "course", "stream", "type", "paper_code", "paper_name", "subject"] as const).some((key) => {
    if (!frontmatter[key] || String(frontmatter[key]).trim().length === 0) {
      errors.push({ line: 1, message: `Missing required frontmatter field: ${key}` });
      return true;
    }
    return false;
  });

  let hasScopeValidationError = false;
  if (frontmatter.university !== FIXED_UNIVERSITY) {
    errors.push({ line: 1, message: `Invalid university. Expected "${FIXED_UNIVERSITY}".` });
    hasScopeValidationError = true;
  }
  if (frontmatter.course !== FIXED_COURSE) {
    errors.push({ line: 1, message: `Invalid course. Expected "${FIXED_COURSE}".` });
    hasScopeValidationError = true;
  }

  return hasMissingRequiredField || hasScopeValidationError
    ? null
    : frontmatter;
}

export function parseDemoDataEntryMarkdown(source: string): IngestionParseResult {
  const errors: IngestionParseError[] = [];
  const parsed = matter(source);
  const lines = parsed.content.split(/\r?\n/);

  const frontmatter = parseFrontmatter(parsed.data as Record<string, unknown>, errors);
  const syllabusHeading = findHeadingLine(lines, "Syllabus");
  const questionsHeading = findHeadingLine(lines, "Questions");
  const explicitType = frontmatter?.entry_type;
  const hasSyllabus = syllabusHeading !== -1;
  const hasQuestions = questionsHeading !== -1;
  const hasMixedSections = hasSyllabus && hasQuestions;
  let entryType: IngestionParseResult["entryType"] = null;

  if (hasMixedSections) {
    errors.push({
      line: 1,
      message:
        "One file cannot contain both ## Syllabus and ## Questions. Split into two files: <paper_code>-syllabus.md and <paper_code>-questions-<exam_year>.md.",
    });
  } else if (explicitType === "syllabus") {
    entryType = "syllabus";
  } else if (explicitType === "question") {
    entryType = "question";
  } else if (hasSyllabus) {
    entryType = "syllabus";
  } else if (hasQuestions) {
    entryType = "question";
  }

  if (entryType === "syllabus" && syllabusHeading === -1) {
    errors.push({ line: 1, message: "Missing required section: ## Syllabus" });
  }
  if (entryType === "question" && questionsHeading === -1) {
    errors.push({ line: 1, message: "Missing required section: ## Questions" });
  }
  if (!entryType && !hasMixedSections) {
    errors.push({
      line: 1,
      message: 'Unable to determine entry type. Add `entry_type: syllabus|question` or include "## Syllabus"/"## Questions".',
    });
  }

  const syllabus: ParsedSyllabusRow[] = [];
  const questions: ParsedQuestionRow[] = [];

  if (entryType === "syllabus" && syllabusHeading !== -1) {
    const section = collectSectionLines(lines, syllabusHeading);
    const rows = parseTableRows(section);
    if (rows.length === 0) {
      errors.push({ line: syllabusHeading + 1, message: "Syllabus table is missing or empty." });
    }
    for (const { line, row } of rows) {
      const unitNumberRaw = row.unit_number || "";
      const unitNumber = Number(unitNumberRaw);
      if (!Number.isInteger(unitNumber) || unitNumber < 1) {
        errors.push({ line, message: `Invalid unit_number "${unitNumberRaw}".` });
        continue;
      }
      const syllabusContent = (row.syllabus_content || "").trim();
      if (!syllabusContent) {
        errors.push({ line, message: "syllabus_content is required." });
        continue;
      }
      const lecturesRaw = (row.lectures || "").trim();
      const lectures = lecturesRaw ? Number(lecturesRaw) : undefined;
      if (lecturesRaw && (
        typeof lectures !== "number" ||
        Number.isNaN(lectures) ||
        !Number.isInteger(lectures) ||
        lectures < 0
      )) {
        errors.push({ line, message: `Invalid lectures value "${lecturesRaw}".` });
        continue;
      }
      syllabus.push({
        unit_number: unitNumber,
        syllabus_content: syllabusContent,
        lectures,
        tags: parseTags(row.tags || ""),
        line,
      });
    }
  }

  if (entryType === "question" && questionsHeading !== -1) {
    const section = collectSectionLines(lines, questionsHeading);
    const rows = parseTableRows(section);
    if (rows.length === 0) {
      errors.push({ line: questionsHeading + 1, message: "Questions table is missing or empty." });
    }
    for (const { line, row } of rows) {
      const questionNo = (row.question_no || "").trim();
      const questionSubpart = (row.question_subpart || "").trim();
      const yearRaw = (row.year || "").trim();
      const year = yearRaw ? Number(yearRaw) : undefined;
      const questionContent = (row.question_content || "").trim();
      if (yearRaw && (!Number.isInteger(year) || (year ?? 0) < 1900 || (year ?? 0) > 2100)) {
        errors.push({ line, message: `Invalid year value "${yearRaw}".` });
        continue;
      }
      if (!questionNo) {
        errors.push({ line, message: "question_no is required." });
        continue;
      }
      if (!questionContent) {
        errors.push({ line, message: "question_content is required." });
        continue;
      }
      const marksRaw = (row.marks || "").trim();
      const marks = marksRaw ? Number(marksRaw) : undefined;
      if (marksRaw && (
        typeof marks !== "number" ||
        Number.isNaN(marks) ||
        !Number.isFinite(marks) ||
        marks < 0
      )) {
        errors.push({ line, message: `Invalid marks value "${marksRaw}".` });
        continue;
      }
      questions.push({
        question_no: questionNo,
        question_subpart: questionSubpart,
        year,
        question_content: questionContent,
        marks,
        tags: parseTags(row.tags || ""),
        line,
      });
    }
  }

  return { entryType, frontmatter, syllabus, questions, errors };
}
