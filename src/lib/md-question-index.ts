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
// Bengali papers use গুচ্ছ—N the same way.
const UNIT_HEADING =
  /^(?:(UNIT|SECTION)\s*[—–-]\s*([A-Za-z0-9]+)|গুচ্ছ\s*[—–-]\s*([\d০-৯]+))\s*$/;

// Bengali digits, and the letters used for sub-question markers.
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const BN_PART_TO_LATIN: Record<string, string> = {
  "ক": "a",
  "খ": "b",
  "গ": "c",
  "ঘ": "d",
};

/** Bengali digits to ASCII ("২" -> "2"); ASCII passes through. */
function asciiDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

function asciiNumber(s: string): number | null {
  const n = parseInt(asciiDigits(s), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Bengali য় has two byte forms (single codepoint U+09DF, or য + nukta
 * U+09AF U+09BC) that render identically but never match in a plain
 * search. Fold the two-codepoint form to U+09DF before comparing words.
 */
function foldBnYy(s: string): string {
  return s.replace(/\u09af\u09bc/g, "\u09df");
}

// Bengali count words in "যে কোনো <word> প্রশ্নের উত্তর দাও". The two
// words containing য় are written with explicit codepoints (U+09DF),
// never typed, so the two byte forms of য় cannot slip in.
const BN_COUNT_WORDS = new Map<string, number>([
  ["একটি", 1],
  ["দুটি", 2],
  ["তিনটি", 3],
  ["চারটি", 4],
  ["পাঁচটি", 5],
  ["\u099b\u09df\u099f\u09bf", 6],
  ["সাতটি", 7],
  ["আটটি", 8],
  ["\u09a8\u09df\u099f\u09bf", 9],
  ["দশটি", 10],
]);

// "1. Answer any two of/from the following questions : 10" — the number
// is optional: an unnumbered instruction opens the next question number.
// The count word may carry *emphasis* ("Answer any *two* ..."), and the
// paper may say "from the following" instead of "of the following".
const INSTRUCTION_LINE =
  /^(?:([\d০-৯]+)[।.]\s*)?Answer\s+any\s+\**(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\**\s+(?:of|from)\s+the\s+following\b[^\n]*$/i;

// Bengali: "১। যে কোনো দুটি প্রশ্নের উত্তর দাও : $2 \times 4 = 8$" —
// number optional, count word captured for the lookup below.
const BN_INSTRUCTION_LINE =
  /^(?:([\d০-৯]+)[।.]\s*)?যে[\s-]*কোনো\s*(\S+?)\s*প্রশ্নের\s+উত্তর\s+দাও(?=\s|:|$)[^\n]*$/;

// A numbered line that is not an instruction: a direct question.
// The number may be Bengali digits with a danda ("২।").
const NUMBERED_LINE = /^([\d০-৯]+)[।.]\s+(.+)$/;

// "1. (a) What ...?" — a question number with its first part inline.
const NUMBERED_SUB_LINE =
  /^([\d০-৯]+)[।.]\s*\((?:([a-d])|([কখগঘ]))\)\s+(.+)$/;

// "(a) What is ...?" — a sub-question of the current question number.
// Bengali papers use (ক) (খ) (গ) (ঘ).
const SUB_QUESTION_LINE = /^\((?:([a-d])|([কখগঘ]))\)\s+(.+)$/;

// A whole line that is only a marks expression: "$2\times 2=4$",
// "$2 x 4 = 8$", "2×2=4", "২×২=৪", "$2+8=10$". For "×" the first
// number is the marks per sub-question; for "+" it is the total (or the
// sum when no total is given).
const MARKS_EXPR =
  /^\${0,2}\s*([\d০-৯]+)\s*(\\times|[×x+])\s*([\d০-৯]+)\s*(?:=\s*([\d০-৯]+))?\s*\${0,2}$/;

/** Marks a marks-expression's numbers mean (see MARKS_EXPR). */
function marksFromParts(
  aStr: string,
  op: string,
  bStr: string,
  totalStr: string | undefined,
): number | null {
  const a = asciiNumber(aStr);
  const b = asciiNumber(bStr);
  if (a === null || b === null) return null;
  if (op === "+") {
    const total = totalStr ? asciiNumber(totalStr) : null;
    return total ?? a + b;
  }
  return a;
}

/**
 * Marks carried by an instruction line itself: a trailing ": 10", or a
 * trailing marks expression ("... : $2 \times 4 = 8$", "... : 2×2=4").
 * Returns null when the line carries no marks.
 */
function instructionMarks(line: string): number | null {
  const expr = line.match(
    /\$?\s*([\d০-৯]+)\s*(\\times|[×x+])\s*([\d০-৯]+)\s*(?:=\s*([\d০-৯]+))?\s*\$?\s*$/,
  );
  if (expr) {
    const n = marksFromParts(expr[1], expr[2], expr[3], expr[4]);
    if (n !== null && n >= 1 && n <= 100) return n;
  }
  const trailing = line.match(/:\s*\**([\d০-৯]+)\**\s*$/);
  if (trailing) {
    const n = asciiNumber(trailing[1]);
    if (n !== null && n >= 1 && n <= 100) return n;
  }
  return null;
}

/**
 * An instruction line, English ("Answer any two of/from the following")
 * or Bengali ("যে কোনো দুটি প্রশ্নের উত্তর দাও"). The number is null
 * when the line carries none — the caller opens the next number.
 */
function matchInstruction(line: string): {
  num: number | null;
  count: number;
} | null {
  const en = line.match(INSTRUCTION_LINE);
  if (en) {
    const count = wordToNumber(en[2]);
    if (count === null) return null;
    return { num: en[1] ? asciiNumber(en[1]) : null, count };
  }
  const bn = line.match(BN_INSTRUCTION_LINE);
  if (bn) {
    const count = BN_COUNT_WORDS.get(foldBnYy(bn[2]));
    if (count === undefined) return null;
    return { num: bn[1] ? asciiNumber(bn[1]) : null, count };
  }
  return null;
}

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
  // A $...$ maths expression at the end of the question is its marks,
  // not part of its text — e.g. "$2+8=10$" or "$2 x 4 = 8$". It must
  // carry $ delimiters: a bare "2+3=5" could be the question itself.
  const tailMath = text.match(/^(.*?)\s*(\$[^$]+\$)\s*$/);
  if (tailMath) {
    const expr = tailMath[2].match(MARKS_EXPR);
    if (expr) {
      const derived = marksFromParts(expr[1], expr[2], expr[3], expr[4]);
      if (
        derived !== null &&
        derived >= 1 &&
        derived <= 100 &&
        (groupMarks === null || groupMarks === derived)
      ) {
        return { text: tailMath[1].trim(), marks: derived };
      }
    }
  }
  // A bare marks expression at the end, e.g. "… : ২×২=৪" — Bengali
  // papers write it without $ delimiters. Checked before the bare
  // number below, or "৪" alone would be misread as marks 4.
  const bareExpr = text.match(
    /^(.*?)\s+([\d০-৯]+)\s*(\\times|[×x+])\s*([\d০-৯]+)\s*(?:=\s*([\d০-৯]+))?\s*$/,
  );
  if (bareExpr) {
    const derived = marksFromParts(
      bareExpr[2],
      bareExpr[3],
      bareExpr[4],
      bareExpr[5],
    );
    if (
      derived !== null &&
      derived >= 1 &&
      derived <= 100 &&
      (groupMarks === null || groupMarks === derived)
    ) {
      return { text: bareExpr[1].trim(), marks: derived };
    }
  }
  // A bare number at the end of the question is its marks — but only
  // when it is a plausible mark (<= 100) and agrees with the group's
  // marks when those are known. A year or a number inside the question
  // never looks like this: it is followed by punctuation or is too big.
  // The number may carry *emphasis* ("**10**") or be Bengali digits.
  const m = text.match(/^(.*?)\s+\**([\d০-৯]+)\**$/);
  if (!m) return { text, marks: null };
  const n = asciiNumber(m[2]);
  if (n === null || n < 1 || n > 100) return { text, marks: null };
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
  let lastQNum = 0;
  let group = "";
  let groupMarks: number | null = null;
  let orPending = false;

  /** Append " (OR)" to a row's group, or set it to "OR" when empty. */
  const applyOr = (row: QuestionRow): void => {
    if (row.group === "OR" || row.group.endsWith(" (OR)")) return;
    row.group = row.group ? `${row.group} (OR)` : "OR";
  };

  /** Push a row, carrying a pending OR (from an OR line just above) onto it. */
  const pushRow = (row: QuestionRow): void => {
    if (orPending) {
      applyOr(row);
      // An OR alternative with no marks of its own shares the marks of
      // the question it alternates with (same question number).
      const prev = rows[rows.length - 1];
      if (
        row.marks === null &&
        prev &&
        prev.marks !== null &&
        row.label.split("(")[0] === prev.label.split("(")[0]
      ) {
        row.marks = prev.marks;
      }
      orPending = false;
    }
    rows.push(row);
  };

  /** Strip a trailing "OR" / "অথবা" from question text. */
  const stripTrailingOr = (text: string): { text: string; isOr: boolean } => {
    const m = text.match(/^(.*?)\s+(OR|অথবা)$/);
    if (!m) return { text, isOr: false };
    return { text: m[1].trim(), isOr: true };
  };

  /**
   * Build a sub-question row from its marker letter and raw text.
   * Returns the row plus whether the text ended in an OR (the next row
   * is its alternative). The caller pushes the row: directly when it
   * ends in OR (so the pending flag survives for the next row), through
   * pushRow otherwise.
   */
  const subRow = (
    letter: string,
    rawText: string,
  ): { row: QuestionRow; isOr: boolean } => {
    const orStripped = stripTrailingOr(rawText.trim());
    const stripped = stripTrailingMarks(orStripped.text, groupMarks);
    const label = `${qNum}(${letter})`;
    return {
      row: {
        label,
        question: stripped.text,
        marks: stripped.marks ?? groupMarks,
        unit,
        group,
        id: `${paperCode}-Q${qNum}${letter}`,
        keywords: "",
      },
      isOr: orStripped.isOr,
    };
  };

  /** Push a sub-question row, honouring a trailing OR on its text. */
  const pushSubRow = (letter: string, rawText: string): void => {
    const { row, isOr } = subRow(letter, rawText);
    if (isOr) {
      applyOr(row);
      orPending = true;
      rows.push(row);
    } else {
      pushRow(row);
    }
  };

  for (const raw of formatted.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const unitMatch = line.match(UNIT_HEADING);
    if (unitMatch) {
      unit = unitMatch[2] ?? (unitMatch[3] ? asciiDigits(unitMatch[3]) : "");
      orPending = false;
      continue;
    }

    // A standalone OR line: the question above and the one below are
    // alternatives — each counts once. Bengali papers write অথবা.
    if (/^(OR|অথবা)$/i.test(line)) {
      if (rows.length > 0) applyOr(rows[rows.length - 1]);
      orPending = true;
      continue;
    }

    // Page markers and any other HTML comments are not questions.
    if (line.startsWith("<!--")) continue;

    // Instruction lines (English or Bengali). The number is optional:
    // an unnumbered instruction opens the next question number — a
    // missing "1." must not lose the whole first question.
    const instr = matchInstruction(line);
    if (instr) {
      if (instr.num !== null) {
        qNum = String(instr.num);
        lastQNum = instr.num;
      } else {
        lastQNum += 1;
        qNum = String(lastQNum);
      }
      group = `Answer any ${instr.count}`;
      groupMarks = instructionMarks(line);
      continue;
    }

    // A line that is only a marks expression ("$2 x 4 = 8$", "2×2=4").
    const marksMatch = line.match(MARKS_EXPR);
    if (marksMatch) {
      if (groupMarks === null) {
        const n = marksFromParts(
          marksMatch[1],
          marksMatch[2],
          marksMatch[3],
          marksMatch[4],
        );
        if (n !== null) groupMarks = n;
      }
      continue;
    }

    // "1. (a) What ...?" — a question number with its first part inline.
    const numberedSub = line.match(NUMBERED_SUB_LINE);
    if (numberedSub) {
      const n = asciiNumber(numberedSub[1]);
      if (n !== null) {
        qNum = String(n);
        lastQNum = n;
      }
      group = "";
      groupMarks = null;
      const letter =
        numberedSub[2] ?? BN_PART_TO_LATIN[numberedSub[3]];
      pushSubRow(letter, numberedSub[4]);
      continue;
    }

    const subMatch = line.match(SUB_QUESTION_LINE);
    if (subMatch && qNum) {
      const letter = subMatch[1] ?? BN_PART_TO_LATIN[subMatch[2]];
      pushSubRow(letter, subMatch[3]);
      continue;
    }

    const numMatch = line.match(NUMBERED_LINE);
    if (numMatch) {
      // A direct question with no sub-parts. It also becomes the
      // current question number for any (a)/(b) lines that follow it.
      const n = asciiNumber(numMatch[1]);
      if (n !== null) {
        qNum = String(n);
        lastQNum = n;
      } else {
        qNum = numMatch[1];
      }
      group = "";
      groupMarks = null;
      const orStripped = stripTrailingOr(numMatch[2].trim());
      const stripped = stripTrailingMarks(orStripped.text, null);
      const row: QuestionRow = {
        label: qNum,
        question: stripped.text,
        marks: stripped.marks,
        unit,
        group: "",
        id: `${paperCode}-Q${qNum}`,
        keywords: "",
      };
      if (orStripped.isOr) {
        applyOr(row);
        orPending = true;
        rows.push(row);
      } else {
        pushRow(row);
      }
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
    // one all-caps word, e.g. COMMERCE or BENGALI. The code line may
    // read "Course No." instead of "Paper Code", and header lines may
    // carry markdown markers ("## COMMERCE").
    const codeIdx = lines.findIndex((l) =>
      /(?:Paper Code|Course No\.)\s*:/.test(l),
    );
    const before = codeIdx === -1 ? lines : lines.slice(0, codeIdx);
    const subjectLine = before.find((l) => {
      const clean = l.replace(/^[#*\s]+/, "");
      return (
        /^[A-Z][A-Z\s&'-]{2,}$/.test(clean) && !/^(UNIT|SECTION)\b/.test(clean)
      );
    });
    if (subjectLine) fm.subject = subjectLine.replace(/^[#*\s]+/, "").trim();
  }

  if (!fm.title) {
    // The paper title is the parenthetical right after the Paper Code
    // line, e.g. "( Consumer Behaviour )".
    const codeIdx = lines.findIndex((l) =>
      /(?:Paper Code|Course No\.)\s*:/.test(l),
    );
    if (codeIdx !== -1 && lines[codeIdx + 1]) {
      const m = lines[codeIdx + 1].match(/^\*{0,2}\s*\(\s*(.+?)\s*\)\*{0,2}$/);
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
    if (m) fm.time = m[1].replace(/\*+\s*$/, "").trim();
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
