/**
 * Question index for question-paper markdown.
 *
 * A question-paper md file is three parts, in order:
 *
 *   1. YAML frontmatter — paper_code, title, exam, year, semester,
 *      subject, full_marks, pass_marks, time. Nothing else.
 *   2. The readable transcript, exactly as the paper reads: `#` title,
 *      UNIT—I..V (or SECTION—A/B) headings, numbered questions with
 *      (a)/(b)/(c) sub-questions, `$...$` maths, and the "Answer any
 *      two/one of the following" instruction lines.
 *   3. A `## Question index` table, one row per sub-question:
 *      | No. | Question | Marks | ID | Unit | Group | Keywords |
 *
 * The table is DERIVED, never hand-written: it is rebuilt from the
 * transcript by `buildQuestionIndex`. The one human/AI input is the
 * Keywords cell — keywords written in an existing table are preserved
 * by question ID when the table is regenerated. The Group column
 * carries the answering rule ("Answer any 2" / "Answer any 1") parsed
 * from the transcript's instruction lines, so the rule stays queryable
 * for machines while the transcript keeps it for humans.
 *
 * The ID is `<paper_code>-Q<label>` with the label compacted, e.g.
 * `COMDSC-352T-Q1a` for question 1(a). It is unique across the site
 * and maps straight back to the PDF.
 *
 * Pure and dependency-free. The transcript parser reuses the
 * deterministic formatter (`formatQuestionMd`) so lone marks lines
 * and sub-questions sharing a line are normalised before parsing.
 */
import { formatQuestionMd } from "./md-verification-format";

export interface QuestionRow {
  /** Paper's own label, e.g. "1(a)" (or "1" for a question with no parts). */
  label: string;
  /** Question text, `$...$` maths kept, trailing marks stripped. */
  question: string;
  /** Marks for this sub-question, or null when the paper states none. */
  marks: number | null;
  /** Roman numeral of the UNIT section, or the letter for SECTION papers. */
  unit: string;
  /** Answering rule, e.g. "Answer any 2", "" when the paper states none. */
  group: string;
  /** `<paper_code>-Q<label>` compacted, e.g. "COMDSC-352T-Q1a". */
  id: string;
  /** Comma-separated topic words, "" when none were written yet. */
  keywords: string;
}

export interface QuestionFrontmatter {
  paper_code?: string;
  title?: string;
  exam?: string;
  year?: number;
  semester?: number;
  subject?: string;
  full_marks?: number;
  pass_marks?: number;
  time?: string;
}

const FM_FIELDS = [
  "paper_code",
  "title",
  "exam",
  "year",
  "semester",
  "subject",
  "full_marks",
  "pass_marks",
  "time",
] as const;

const TABLE_HEADING = "## Question index";
const TABLE_HEADER =
  "| No. | Question | Marks | ID | Unit | Group | Keywords |";
const TABLE_SEPARATOR = "| --- | --- | --- | --- | --- | --- | --- |";

// "UNIT—I" / "UNIT—II" / "SECTION—A" (em dash, en dash, or hyphen).
const UNIT_HEADING = /^(UNIT|SECTION)\s*[—–-]\s*([A-Za-z0-9]+)\s*$/;

// "1. Answer any two of the following questions : 10" — the trailing
// number is the group's marks. "Answer any one" works the same.
const INSTRUCTION_LINE =
  /^(\d+)\.\s+Answer\s+any\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+of\s+the\s+following\b[^\n]*$/i;

// A numbered line that is not an instruction: a direct question.
const NUMBERED_LINE = /^(\d+)\.\s+(.+)$/;

// "(a) What is ...?" — a sub-question of the current question number.
const SUB_QUESTION_LINE = /^\(([a-d])\)\s+(.+)$/;

// "$2\times 2=4$" — the first number is the marks per sub-question.
const TIMES_MARKS = /^\$(\d+)\s*\\times\s*(\d+)\s*=\s*(\d+)\$$/;
// "$2+8=10$" — the total is the marks for the question.
const PLUS_MARKS = /^\$(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)\$$/;
// A bare trailing number on an instruction line, e.g. "... questions : 10".
const TRAILING_MARKS = /:\s*(\d+)\s*$/;

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function wordToNumber(word: string): number | null {
  const lower = word.toLowerCase();
  if (WORD_NUMBERS[lower] !== undefined) return WORD_NUMBERS[lower];
  const n = parseInt(word, 10);
  return Number.isNaN(n) ? null : n;
}

/** Split a `| a | b |` row into cells, honouring `\|` escapes. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.replace(/^\|/, "").replace(/\|\s*$/, "");
  return inner
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

/** A line that is only a table row, header, or separator. */
function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|");
}

/**
 * Parse the frontmatter block at the top of the md, if any. Tolerant of
 * the blank lines the formatter puts between lines: lines are collected
 * until the closing `---`, blanks skipped. Returns the fields found and
 * the md with the block removed.
 */
export function parseFrontmatter(md: string): {
  fm: QuestionFrontmatter;
  rest: string;
} {
  const fm: QuestionFrontmatter = {};
  const lines = md.split("\n");
  if (lines[0]?.trim() !== "---") return { fm, rest: md };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "---") {
      end = i;
      break;
    }
    if (!t) continue;
    const kv = t.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    if (!(FM_FIELDS as readonly string[]).includes(key)) continue;
    let val = kv[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (
      key === "year" ||
      key === "semester" ||
      key === "full_marks" ||
      key === "pass_marks"
    ) {
      const n = parseInt(val, 10);
      if (!Number.isNaN(n)) {
        (fm as Record<string, number>)[key] = n;
      }
    } else {
      (fm as Record<string, string>)[key] = val;
    }
  }
  if (end === -1) return { fm, rest: md };
  return { fm, rest: lines.slice(end + 1).join("\n") };
}

/** Split the md (frontmatter already removed) into transcript + index table. */
function splitIndexTable(md: string): {
  transcript: string;
  tableText: string | null;
} {
  const idx = md
    .split("\n")
    .findIndex((line) => line.trim() === TABLE_HEADING);
  if (idx === -1) return { transcript: md, tableText: null };
  const lines = md.split("\n");
  return {
    transcript: lines.slice(0, idx).join("\n"),
    tableText: lines.slice(idx + 1).join("\n"),
  };
}

/**
 * Parse a `## Question index` table into full rows. Handles the current
 * 7-column shape and the older 6-column shape (no Group) — the older
 * shape yields group "".
 */
export function parseIndexTable(md: string): QuestionRow[] {
  const { tableText } = splitIndexTable(parseFrontmatter(md).rest);
  if (!tableText) return [];
  const rows: QuestionRow[] = [];
  for (const line of tableText.split("\n")) {
    if (!isTableLine(line)) continue;
    const cells = splitTableRow(line);
    if (cells.length < 6) continue;
    // Header row and separator row.
    if (/^no\.?$/i.test(cells[0])) continue;
    if (/^-+$/.test(cells[0])) continue;
    const isNewShape = cells.length >= 7;
    const marks = parseInt(cells[2], 10);
    rows.push({
      label: cells[0],
      question: cells[1],
      marks: Number.isNaN(marks) ? null : marks,
      id: cells[3],
      unit: cells[4],
      group: isNewShape ? cells[5] : "",
      keywords: isNewShape ? cells[6] : cells[5],
    });
  }
  return rows;
}

/** Keywords already written in an existing index table, keyed by question ID. */
export function parseIndexTableKeywords(md: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of parseIndexTable(md)) {
    if (row.id && row.keywords) map.set(row.id, row.keywords);
  }
  return map;
}

function stripTrailingMarks(
  text: string,
  groupMarks: number | null,
): { text: string; marks: number | null } {
  // A bare number at the end of the question is its marks — but only
  // when it is a plausible mark (<= 100) and agrees with the group's
  // marks when those are known. A year or a number inside the question
  // never looks like this: it is followed by punctuation or is too big.
  const m = text.match(/^(.*?)\s+(\d+)$/);
  if (!m) return { text, marks: null };
  const n = parseInt(m[2], 10);
  if (n < 1 || n > 100) return { text, marks: null };
  if (groupMarks !== null && groupMarks !== n) return { text, marks: null };
  return { text: m[1].trim(), marks: n };
}

/**
 * Parse a transcript into question rows. The transcript is normalised
 * with the formatter first (lone marks lines join their question,
 * sub-questions sharing a line are split apart). Frontmatter and any
 * existing index table are ignored — they are not transcript.
 */
export function parseTranscriptToRows(
  md: string,
  paperCode: string,
): QuestionRow[] {
  const { rest } = parseFrontmatter(md);
  const { transcript } = splitIndexTable(rest);
  const formatted = formatQuestionMd(transcript);
  const rows: QuestionRow[] = [];
  let unit = "";
  let qNum = "";
  let group = "";
  let groupMarks: number | null = null;

  for (const raw of formatted.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const unitMatch = line.match(UNIT_HEADING);
    if (unitMatch) {
      unit = unitMatch[2];
      continue;
    }

    const instrMatch = line.match(INSTRUCTION_LINE);
    if (instrMatch) {
      qNum = instrMatch[1];
      const count = wordToNumber(instrMatch[2]);
      group = count !== null ? `Answer any ${count}` : "";
      const trailing = line.match(TRAILING_MARKS);
      groupMarks = trailing ? parseInt(trailing[1], 10) : null;
      continue;
    }

    const timesMatch = line.match(TIMES_MARKS);
    if (timesMatch) {
      // "$2\times 2=4$": each sub-question in this group is worth the
      // first number. Only fills marks the instruction line left blank.
      if (groupMarks === null) groupMarks = parseInt(timesMatch[1], 10);
      continue;
    }

    const plusMatch = line.match(PLUS_MARKS);
    if (plusMatch) {
      // "$2+8=10$": the total is the marks for the question.
      if (groupMarks === null) groupMarks = parseInt(plusMatch[3], 10);
      continue;
    }

    // Page markers and any other HTML comments are not questions.
    if (line.startsWith("<!--")) continue;

    const subMatch = line.match(SUB_QUESTION_LINE);
    if (subMatch && qNum) {
      const label = `${qNum}(${subMatch[1]})`;
      const stripped = stripTrailingMarks(subMatch[2].trim(), groupMarks);
      const marks = stripped.marks ?? groupMarks;
      rows.push({
        label,
        question: stripped.text,
        marks,
        unit,
        group,
        id: `${paperCode}-Q${qNum}${subMatch[1]}`,
        keywords: "",
      });
      continue;
    }

    const numMatch = line.match(NUMBERED_LINE);
    if (numMatch) {
      // A direct question with no sub-parts. It also becomes the
      // current question number for any (a)/(b) lines that follow it.
      qNum = numMatch[1];
      group = "";
      groupMarks = null;
      const stripped = stripTrailingMarks(numMatch[2].trim(), null);
      rows.push({
        label: qNum,
        question: stripped.text,
        marks: stripped.marks,
        unit,
        group: "",
        id: `${paperCode}-Q${qNum}`,
        keywords: "",
      });
      continue;
    }
    // Everything else (title, header lines, "The figures in the
    // margin...", maths on its own line) is not a question.
  }
  return rows;
}

/**
 * The rows for the database: transcript rows with keywords merged in
 * from any index table already in the md, keyed by question ID.
 */
export function parseQuestions(md: string, paperCode: string): QuestionRow[] {
  const keywordsById = parseIndexTableKeywords(md);
  const rows = parseTranscriptToRows(md, paperCode);
  for (const row of rows) {
    row.keywords = keywordsById.get(row.id) ?? "";
  }
  return rows;
}

function yamlScalar(value: string): string {
  // Quote when the value would confuse YAML: a ": " inside it, or a
  // leading marker character.
  if (/:\s/.test(value) || /^[#-]/.test(value)) return JSON.stringify(value);
  return value;
}

function emitFrontmatter(fm: QuestionFrontmatter): string {
  const lines = ["---"];
  for (const key of FM_FIELDS) {
    const value = fm[key];
    if (value === undefined || value === "") continue;
    lines.push(`${key}: ${yamlScalar(String(value))}`);
  }
  lines.push("---");
  return lines.join("\n");
}

function emitIndexTable(rows: QuestionRow[]): string {
  const out = [TABLE_HEADER, TABLE_SEPARATOR];
  for (const row of rows) {
    out.push(
      `| ${row.label} | ${escapeCell(row.question)} | ${row.marks ?? ""} | ${row.id} | ${row.unit} | ${row.group} | ${escapeCell(row.keywords)} |`,
    );
  }
  return out.join("\n");
}

/**
 * Fill frontmatter fields best-effort from the paper's own header lines.
 * Only fields actually found are filled — a missing value is left out,
 * never guessed. Existing frontmatter values always win.
 */
export function ensureFrontmatter(
  existing: QuestionFrontmatter,
  paperCode: string,
  transcript: string,
): QuestionFrontmatter {
  const fm: QuestionFrontmatter = { ...existing };
  if (!fm.paper_code) fm.paper_code = paperCode;
  const lines = transcript
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const titleIdx = lines.findIndex((l) => l.startsWith("# "));
  const titleLine = titleIdx === -1 ? "" : lines[titleIdx].slice(2).trim();
  if (titleLine && !fm.exam) {
    // "# FYUG Even Semester Exam., 2026" — exam name, then the year.
    const m = titleLine.match(/^(.+?),\s*(\d{4})\s*$/);
    if (m) {
      fm.exam = m[1].trim();
      if (!fm.year) fm.year = parseInt(m[2], 10);
    } else {
      fm.exam = titleLine;
    }
  }

  if (!fm.semester) {
    const semLine = lines.find((l) =>
      /^\(\s*\d+(?:st|nd|rd|th)\s+Semester\s*\)$/.test(l),
    );
    const m = semLine?.match(/(\d+)(?:st|nd|rd|th)\s+Semester/);
    if (m) fm.semester = parseInt(m[1], 10);
  }

  if (!fm.subject) {
    // The subject line sits between the title and the paper-code line:
    // one all-caps word, e.g. COMMERCE or BENGALI.
    const codeIdx = lines.findIndex((l) => /Paper Code\s*:/.test(l));
    const before = codeIdx === -1 ? lines : lines.slice(0, codeIdx);
    const subjectLine = before.find(
      (l) =>
        /^[A-Z][A-Z\s&'-]{2,}$/.test(l) &&
        !/^(UNIT|SECTION)\b/.test(l) &&
        !l.startsWith("#"),
    );
    if (subjectLine) fm.subject = subjectLine.trim();
  }

  if (!fm.title) {
    // The paper title is the parenthetical right after the Paper Code
    // line, e.g. "( Consumer Behaviour )".
    const codeIdx = lines.findIndex((l) => /Paper Code\s*:/.test(l));
    if (codeIdx !== -1 && lines[codeIdx + 1]) {
      const m = lines[codeIdx + 1].match(/^\(\s*(.+?)\s*\)$/);
      if (m && !/\d+(?:st|nd|rd|th)\s+Semester/.test(m[1])) {
        fm.title = m[1].trim();
      }
    }
  }

  if (fm.full_marks === undefined) {
    const m = transcript.match(/Full Marks\s*:\s*(\d+)/);
    if (m) fm.full_marks = parseInt(m[1], 10);
  }
  if (fm.pass_marks === undefined) {
    const m = transcript.match(/Pass Marks\s*:\s*(\d+)/);
    if (m) fm.pass_marks = parseInt(m[1], 10);
  }
  if (!fm.time) {
    const m = transcript.match(/Time\s*:\s*(.+?)\s*(?:\n|$)/);
    if (m) fm.time = m[1].trim();
  }
  return fm;
}

/**
 * Convert md to the canonical format: frontmatter ensured, transcript
 * kept exactly as the formatter leaves it, and a freshly generated
 * `## Question index` table at the end (replacing any old one).
 * Keywords already in an existing table survive, keyed by question ID.
 * A file with no questions at all keeps its frontmatter + transcript
 * and gets no table. Regenerating an already-canonical file changes
 * nothing.
 */
export function buildQuestionIndex(md: string, paperCode: string): string {
  const { fm, rest } = parseFrontmatter(md);
  const { transcript, tableText } = splitIndexTable(rest);
  const transcriptOut = formatQuestionMd(transcript).trim();

  let rows: QuestionRow[];
  if (!transcriptOut && tableText) {
    // No transcript left (a table-only file): normalise the table
    // itself instead of rebuilding it from nothing.
    rows = parseIndexTable(md);
  } else {
    rows = parseQuestions(md, paperCode);
  }
  const fmOut = ensureFrontmatter(fm, paperCode, transcript);
  const parts = [emitFrontmatter(fmOut), transcriptOut];
  if (rows.length > 0) {
    parts.push(`${TABLE_HEADING}\n\n${emitIndexTable(rows)}`);
  }
  return parts.filter((p) => p !== "").join("\n\n") + "\n";
}
