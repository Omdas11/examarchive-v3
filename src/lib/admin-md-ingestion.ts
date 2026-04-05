import matter from "gray-matter";

export interface IngestionFrontmatter {
  university: string;
  course: string;
  stream: string;
  type: string;
  paper_code: string;
  paper_name: string;
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
  const get = (key: keyof IngestionFrontmatter) => {
    const value = data[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const frontmatter: IngestionFrontmatter = {
    university: get("university"),
    course: get("course"),
    stream: get("stream"),
    type: get("type"),
    paper_code: get("paper_code"),
    paper_name: get("paper_name"),
  };

  (Object.keys(frontmatter) as Array<keyof IngestionFrontmatter>).forEach((key) => {
    if (!frontmatter[key]) {
      errors.push({ line: 1, message: `Missing required frontmatter field: ${key}` });
    }
  });

  return errors.some((err) => err.message.startsWith("Missing required frontmatter field"))
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

  if (syllabusHeading === -1) {
    errors.push({ line: 1, message: "Missing required section: ## Syllabus" });
  }
  if (questionsHeading === -1) {
    errors.push({ line: 1, message: "Missing required section: ## Questions" });
  }

  const syllabus: ParsedSyllabusRow[] = [];
  const questions: ParsedQuestionRow[] = [];

  if (syllabusHeading !== -1) {
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

  if (questionsHeading !== -1) {
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

  return { frontmatter, syllabus, questions, errors };
}
