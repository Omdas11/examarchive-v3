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
// Bengali papers use গুচ্ছ—N the same way, and বিভাগ—ক/খ/গ for
// sections (BNGDSC152T, BNGIDC151T). The section letter may be quoted
// ("বিভাগ—‘ক’", "SECTION—'গ'") and the heading may carry a markdown
// prefix ("## বিভাগ—ক", "### বিভাগ—খ").
const UNIT_HEADING =
  /^(?:#{1,3}\s*)?(?:(UNIT|SECTION)\s*[—–-]\s*['‘’"“”]?\s*([A-Za-z0-9কখগঘঙচছজঝ]+)\s*['‘’"“”]?|বিভাগ\s*[—–-]\s*['‘’"“”]?\s*([কখগঘঙচছজঝA-Za-z])\s*['‘’"“”]?|গুচ্ছ\s*[—–-]\s*([\d০-৯]+))\s*$/;

// Bengali digits, and the letters used for sub-question markers.
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const BN_PART_TO_LATIN: Record<string, string> = {
  "ক": "a",
  "খ": "b",
  "গ": "c",
  "ঘ": "d",
  "ঙ": "e",
  "চ": "f",
  "ছ": "g",
  "জ": "h",
  "ঝ": "i",
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

/**
 * Assamese ৰ (U+09F0) is the same letter as Bengali র (U+09B0) for
 * matching — papers mix the two spellings ("প্ৰশ্নৰ উত্তৰ দাও",
 * BENSEC201 Q11). Fold it before testing the Bengali instruction
 * pattern; the count word "তিনিটি" is Assamese too (see BN_COUNT_WORDS).
 */
function foldAsmRa(s: string): string {
  return s.replace(/\u09f0/g, "\u09b0");
}

// Bengali count words in "যে কোনো <word> প্রশ্নের উত্তর দাও". The two
// words containing য় are written with explicit codepoints (U+09DF),
// never typed, so the two byte forms of য় cannot slip in.
// "তিনিটি" is the Assamese spelling of "তিনটি" (BENSEC201 Q11) —
// same count, different letters, so it is its own entry.
// "কুড়িটি" is twenty (BNGIDC151T বিভাগ—‘ক’: answer any twenty).
// Its ড় has two byte forms like য় does — ড + nukta (U+09A1
// U+09BC) and the single codepoint ড় (U+09DC) — so both are
// listed, written with explicit codepoints, never typed.
const BN_COUNT_WORDS = new Map<string, number>([
  ["একটি", 1],
  ["দুটি", 2],
  ["তিনটি", 3],
  ["তিনিটি", 3],
  ["চারটি", 4],
  ["পাঁচটি", 5],
  ["\u099b\u09df\u099f\u09bf", 6],
  ["সাতটি", 7],
  ["আটটি", 8],
  ["\u09a8\u09df\u099f\u09bf", 9],
  ["দশটি", 10],
  // Eleven to nineteen (BNGSEC151T বিভাগ—ক: "যে কোনো পনেরোটি
  // প্রশ্নের উত্তর দাও"). None of these words contains য় or ড়, so
  // they are typed, not escaped — unlike ছয়টি/নয়টি/কুড়িটি above.
  ["এগারোটি", 11],
  ["বারোটি", 12],
  ["তেরোটি", 13],
  ["চৌদ্দটি", 14],
  ["পনেরোটি", 15],
  ["ষোলোটি", 16],
  ["সতেরোটি", 17],
  ["আঠারোটি", 18],
  ["উনিশটি", 19],
  ["\u0995\u09c1\u09a1\u09bc\u09bf\u099f\u09bf", 20],
  ["\u0995\u09c1\u09dc\u09bf\u099f\u09bf", 20],
]);

// "1. Answer any two of/from the following questions : 10" — the number
// is optional: an unnumbered instruction opens the next question number.
// The count word may carry *emphasis* ("Answer any *two* ..."), and the
// paper may say "from the following" instead of "of the following".
// Some papers write the same rule as "Write a note on any one of the
// following : 2" — that shape is an instruction too. Language papers
// say "Translate any four of the following as directed" (PERIDC101T),
// and "Answer any four as directed" with no "of the following" at all.
// SEC papers write the bare form "Answer any three questions :
// $1 \times 3 = 3$" (MTMSEC201T) — no "of the following" at all.
// English papers say "Define any seven of the following terms"
// (ENGDSC252 Q1) — same shape, same rule. The count word runs to
// twenty: BOTIDC151T SECTION—A says "Answer any twenty ..."
// and BOTSEC151T SECTION—A "Answer any fifteen ..." (batch 22).
const INSTRUCTION_LINE =
  /^(?:([\d০-৯]+)[।.]\s*)?(?:Answer\s+any|Define\s+any|Translate\s+any|Write\s+a\s+note\s+on\s+any)\s+\**(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d+)\**\s+(?:(?:of|from)\s+the\s+following|as\s+directed|questions?)\b[^\n]*$/i;

// "3. Answer the following questions either (a) or (b) : 8" (PERIDC101T) —
// one question with two alternatives; the candidate answers either one,
// so it counts as 1. The marks ride on the line itself (": 8") or are
// filled from the paper's per-unit structure like any other instruction.
const EITHER_LINE =
  /^(?:([\d০-৯]+)[।.]\s*)?Answer\s+the\s+following\s+questions\s+either\s+\(a\)\s+or\s+\(b\)[^\n]*$/i;

// "2. Answer either [(a) and (b)] or [(c) and (d)] : 10" (MTM papers) —
// one question whose parts form two alternative PAIRS: the candidate
// answers either (a)+(b) or (c)+(d), so the question is worth one
// pair's sum, not both. The number is optional (a bare line opens the
// next number, batch 15 gap 7) and the total may be absent (MTMDSM301
// prints none). The brackets are optional.
const PAIR_EITHER_LINE =
  /^(?:([\d০-৯]+)[।.]\s*)?Answer\s+either\s+\[?\s*\(([a-z])\)\s+and\s+\(([a-z])\)\s*\]?\s+or\s+\[?\s*\(([a-z])\)\s+and\s+\(([a-z])\)\s*\]?[^\n]*$/i;

// Bengali: "১। যে কোনো দুটি প্রশ্নের উত্তর দাও : $2 \times 4 = 8$" —
// number optional, count word captured for the lookup below. The
// "অতি সংক্ষিপ্ত" (very short) form puts those two words either
// before "প্রশ্নের" ("যে কোনো চারটি অতি সংক্ষিপ্ত প্রশ্নের উত্তর
// দাও", BNGIDC201T Q4) or between "প্রশ্নের" and "উত্তর দাও"
// ("যে কোনো চারটি প্রশ্নের অতি সংক্ষিপ্ত উত্তর দাও", BNGIDC201T
// Q1/Q7/Q10/Q13) — both are the same instruction. The "সংক্ষিপ্ত"
// without "অতি" also occurs ("যে কোনো দশটি প্রশ্নের সংক্ষিপ্ত
// উত্তর দাও", BNGDSM151T SECTION—A). Neither word
// contains য়, so they are typed, not escaped.
// AEC papers put "নিম্নলিখিত" (the following) before "যে কোনো"
// ("১। নিম্নলিখিত যে কোনো তিনটি প্রশ্নের উত্তর দাও", BNGAEC101T Q1)
// — same instruction, same rule; without the prefix the line became
// a direct question row and its (a)–(d) parts got no marks.
// Assamese spelling (BENSEC201 Q11): "যে কোনো তিনিটি প্ৰশ্নৰ উত্তৰ
// দাও" — the ৰ is folded to র before matching (see foldAsmRa), and
// the ে in "প্রশ্নের" is optional because the Assamese form drops it
// ("প্রশ্নর"). The count word "তিনিটি" is in BN_COUNT_WORDS.
const BN_INSTRUCTION_LINE =
  /^(?:([\d০-৯]+)[।.]\s*)?(?:নিম্নলিখিত\s+)?যে[\s-]*কোনো\s*(\S+?)\s*(?:(?:অতি\s+)?সংক্ষিপ্ত\s+)?প্রশ্নে?র\s+(?:(?:অতি\s+)?সংক্ষিপ্ত\s+)?উত্তর\s+দাও(?=\s|:|$)[^\n]*$/;

// Manipuri (Bengali script) count words in instruction lines:
// "অমতংগী" and "অমখক" are one, "অনীদংগী" two, "অহুমথকী" and
// "অহুমখক্কী" three. None of these words contains য়, so they are
// typed; the য় in পীয়ু is written as \u09df, never typed (typing it
// risks the YA+nukta byte form, which never matches).
const MN_COUNT_WORDS = new Map<string, number>([
  ["অমতংগী", 1],
  ["অমখক", 1],
  ["অনীদংগী", 2],
  ["অহুমথকী", 3],
  ["অহুমখক্কী", 3],
]);

// Manipuri in Bengali script, "মখাগী …" form:
// "১। মখাগী ৱাহংশিং অসিদগী ৪খক্তী পাউখুম পীয়ু : ১×৪=৪" (MANIDC101T)
// "মখাগী ৱাহংশিং অসিদগী অমখক থল্লগা পাউখুম পীয়ু : ২" (MANSEC201T)
// "মখাগী ৱাহংশিং অসিগী অতেনবা পাউখুম পীয়ু : $1 \times 3 = 3$" (MANSEC201T)
// — the count is a Bengali digit + classifier suffix (খক্তী/থক্কী/…),
// a count word (অমখক/অহুমথকী/অহুমখক্কী), or absent ("অতেনবা",
// short answers: the count is the multiplier of the N×M=K marks
// expression on the line). The noun varies (ৱাহংশিং/বাহং/…), the
// source word varies (অসিদগী/অসিগী), and a verb (থল্লগা/খল্লগা/খঙনা)
// may sit between the count and পাউখুম. The য় in পীয়ু is U+09DF.
const MN_INSTRUCTION_LINE =
  /^(?:([\d০-৯]+)[।.]\s*)?মখাগী\s+\S+\s+(?:অসিদগী|অসিগী)\s+(\S+)(?:\s+(?:থল্লগা|খল্লগা|খঙনা))?\s+পাউখুম\s+পী\u09dfু[^\n]*$/;

// Manipuri in Bengali script, bare count-word form:
// "১। অনীদংগী পাউখুম পীয়ু : $2 \times 2 = 4$" (MANDSC202T Q1/Q3/Q5/Q7/Q9)
// "২। অমতংগী পাউখুম পীয়ু : ১০" (MANDSC202T Q2/Q4/Q6/Q8/Q10)
// "অহুমথকী/অহুমখক্কী পাউখুম পীয়ু" (answer three, MANSEC201T).
const MN_BARE_LINE =
  /^(?:([\d০-৯]+)[।.]\s*)?(অমতংগী|অনীদংগী|অহুমথকী|অহুমখক্কী)\s+পাউখুম\s+পী\u09dfু[^\n]*$/;

/**
 * A trailing "N×M=K" marks expression: "$2\\times 2 = 4$",
 * "$1 \\times 3 = 3$", "২×২=৪", "১×৩=৩". The first number is the marks
 * per sub-question, the second is how many sub-questions the group
 * counts, and the third is their product (the group's total). Returns
 * null when the line carries no such expression. The count (second
 * number) is what "অতেনবা" (short answers) instructions need — the
 * count word is absent there, so the paper states it only as the
 * multiplier. Careful with backslashes: exactly ONE literal backslash
 * in "$1 \\times 4 = 4$"; two give marks null (batch 7).
 */
function parseTimesMarks(line: string): {
  per: number;
  count: number;
  total: number;
} | null {
  const m = line.match(
    /\${0,2}\s*([\d০-৯]+)\s*(?:\\times|[×x])\s*([\d০-৯]+)\s*=\s*([\d০-৯]+)\s*\${0,2}\s*$/,
  );
  if (!m) return null;
  const per = asciiNumber(m[1]);
  const count = asciiNumber(m[2]);
  const total = asciiNumber(m[3]);
  if (per === null || count === null || total === null) return null;
  if (per < 1 || count < 1 || total < 1 || total > 100) return null;
  return { per, count, total };
}

/**
 * The count a Manipuri "মখাগী …" instruction asks for. The count token
 * is a Bengali digit + classifier suffix ("৪খক্তী" -> 4), a count word
 * ("অমখক" -> 1, "অহুমথকী" -> 3), or "অতেনবা" (short answers): no count
 * word at all, so the count is the multiplier of the N×M=K marks
 * expression on the line ("$1 \\times 3 = 3$" -> 3). The word wins when
 * both are present — a mis-OCRed marks expression must not override
 * the instruction itself.
 */
function mnInstructionCount(countToken: string, line: string): number | null {
  const digit = countToken.match(/^([০-৯]+)/);
  if (digit) return asciiNumber(digit[1]);
  const word = MN_COUNT_WORDS.get(countToken);
  if (word !== undefined) return word;
  const times = parseTimesMarks(line);
  return times ? times.count : null;
}

// A numbered line that is not an instruction: a direct question.
// The number may be Bengali digits with a danda ("২।").
const NUMBERED_LINE = /^([\d০-৯]+)[।.]\s+(.+)$/;

// "1. (a) What ...?" — a question number with its first part inline.
const NUMBERED_SUB_LINE =
  /^([\d০-৯]+)[।.]\s*\((?:([a-j])|([কখগঘঙচছজঝ]))\)\s+(.+)$/;

// "(a) What is ...?" — a sub-question of the current question number.
// Bengali papers use (ক) (খ) (গ) (ঘ) (ঙ). Letters run to (j): papers
// with ten options in a group use (i) and (j) (ENGDSC252 Q1).
// (i)/(j) are only accepted in sequence — (i) after (h), (j) after
// (i) in the same question (see acceptsSubLetter in
// parseTranscriptToRows): a lone "(i)/(ii)" line is an MCQ option
// (ENGSEC101T: "(i) Stationary (ii) Stationery" under Q1(c)) and
// must not become a sub-question.
const SUB_QUESTION_LINE = /^\((?:([a-j])|([কখগঘঙচছজঝ]))\)\s+(.+)$/;

// A bare sub-question label on its own line, e.g. "(b)" with the
// question text on the next line (maths papers split them).
const BARE_SUB_LINE = /^\((?:([a-j])|([কখগঘঙচছজঝ]))\)$/;

// A number atom in a marks expression: an integer, a vulgar fraction
// "1/2", a LaTeX fraction "\frac{1}{2}", or a mixed number
// "1\frac{1}{2}" (CHMDSM151T Q18(c): "1+2+1/2+1/2=4", Q22(a):
// "$1\frac{1}{2}+1\frac{1}{2}=3$"). Bengali digits pass through
// (asciiDigits normalises them before evaluation).
const MARKS_NUM = String.raw`(?:[\d০-৯]+(?:\\frac\{[\d০-৯]+\}\{[\d০-৯]+\})?|[\d০-৯]+\/[\d০-৯]+|\\frac\{[\d০-৯]+\}\{[\d০-৯]+\})`;
// The operator in a marks expression: "\times", "×" or "x", or "+".
const MARKS_OP = String.raw`(?:\\times|[×x+])`;
// A term in a marks expression: a number, or one parenthesised sum —
// "1+(6+3)=10" (BOTDSM201T Q5). Only one level of parens: papers
// never nest them.
const MARKS_TERM = String.raw`(?:${MARKS_NUM}|\(${MARKS_NUM}(?:\s*${MARKS_OP}\s*${MARKS_NUM})*\))`;

// A whole line that is only a marks expression: "$2\times 2=4$",
// "$2 x 4 = 8$", "2×2=4", "২×২=৪", "$2+8=10$", "$4+4+2=10$",
// "6+3+1", "1+3+3+3=10". Any number of terms joined by "+" (or one
// "×"); for "+" it is the total (or the sum when no total is given),
// for "×" the first number is the marks per sub-question.
const MARKS_EXPR = new RegExp(
  String.raw`^\${0,2}\s*(${MARKS_TERM}(?:\s*${MARKS_OP}\s*${MARKS_TERM})+)\s*(?:=\s*([\d০-৯]+))?\s*\${0,2}$`,
);

/**
 * Evaluate a marks expression to a number, or null when it cannot be
 * parsed: integers, vulgar fractions ("1/2"), LaTeX fractions
 * ("\frac{1}{2}", mixed "1\frac{1}{2}"), "+" and "×"/"x"/"\times",
 * one level of parens. Anything else (letters, other symbols)
 * rejects it — the regex gate above already limits what reaches here;
 * this is the second check. The value may be fractional mid-sum
 * ("1+2+1/2+1/2" is 4); callers decide whether a whole number is
 * required.
 */
function evalMarksValue(expr: string): number | null {
  const s = asciiDigits(expr)
    .replace(/(\d+)\\frac\{(\d+)\}\{(\d+)\}/g, "($1+($2/$3))")
    .replace(/\\frac\{(\d+)\}\{(\d+)\}/g, "($1/$2)")
    .replace(/\\times/g, "*")
    .replace(/[×x]/g, "*");
  if (!/^[\d\s+*\/().]+$/.test(s)) return null;
  let i = 0;
  const skipSpaces = (): void => {
    while (s[i] === " ") i++;
  };
  const parseFactor = (): number | null => {
    skipSpaces();
    if (s[i] === "(") {
      i++;
      const v = parseSum();
      if (v === null) return null;
      skipSpaces();
      if (s[i] !== ")") return null;
      i++;
      return v;
    }
    const m = /^\d+/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return parseInt(m[0], 10);
  };
  const parseProduct = (): number | null => {
    let v = parseFactor();
    if (v === null) return null;
    for (;;) {
      skipSpaces();
      const op = s[i];
      if (op !== "*" && op !== "/") return v;
      i++;
      const f = parseFactor();
      if (f === null || (op === "/" && f === 0)) return null;
      v = op === "*" ? v * f : v / f;
    }
  };
  const parseSum = (): number | null => {
    let v = parseProduct();
    if (v === null) return null;
    for (;;) {
      skipSpaces();
      if (s[i] !== "+") return v;
      i++;
      const t = parseProduct();
      if (t === null) return null;
      v += t;
    }
  };
  const v = parseSum();
  if (v === null) return null;
  skipSpaces();
  return i === s.length ? v : null;
}

/** A whole-number result of evalMarksValue, or null (marks are whole). */
function wholeMarksValue(expr: string): number | null {
  const v = evalMarksValue(expr);
  if (v === null) return null;
  const n = Math.round(v);
  return Math.abs(v - n) < 1e-9 && n >= 1 && n <= 100 ? n : null;
}

/**
 * The value of the first factor of a "×" expression ("1/2×4" is 0.5,
 * "2×4" is 2). The operator is the first "\times"/"×"/"x" at paren
 * depth 0; an "x" counts only between digits/spaces, so a stray
 * letter never splits the expression.
 */
function firstMarksFactor(expr: string): number | null {
  let depth = 0;
  for (let k = 0; k < expr.length; k++) {
    const c = expr[k];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0) {
      if (expr.startsWith("\\times", k) || c === "×") {
        return evalMarksValue(expr.slice(0, k));
      }
      if (
        c === "x" &&
        /[\d০-৯\s]/.test(expr[k - 1] ?? "") &&
        /[\s\d০-৯]/.test(expr[k + 1] ?? "")
      ) {
        return evalMarksValue(expr.slice(0, k));
      }
    }
  }
  return evalMarksValue(expr);
}

/** Marks a marks-expression means (see MARKS_EXPR). */
function marksFromParts(
  exprStr: string,
  totalStr: string | undefined,
): number | null {
  const total = totalStr ? asciiNumber(totalStr) : null;
  if (/\+/.test(exprStr)) {
    // A "+" split: the stated total, or the sum of the parts.
    return total ?? wholeMarksValue(exprStr);
  }
  // A "×" split: the first number is the marks per sub-question.
  // It must be whole ("1/2×4" has no whole per-part value).
  const first = firstMarksFactor(exprStr);
  if (first === null) return null;
  const n = Math.round(first);
  return Math.abs(first - n) < 1e-9 && n >= 1 ? n : null;
}

/**
 * The two numbers a marks expression on an instruction line carries:
 * `per` (marks per sub-question) and `total` (the group's total).
 * For "×" the per is the first number and the total is the stated
 * product (or N*M when no total is printed); for "+" there is no
 * per-part value, only the total (stated, or the sum of the parts).
 * Returns null when the expression has no usable numbers.
 */
function marksDetailFromParts(
  exprStr: string,
  totalStr: string | undefined,
): { per: number | null; total: number | null } | null {
  const stated = totalStr ? asciiNumber(totalStr) : null;
  if (/\+/.test(exprStr)) {
    // A "+" split: the stated total, or the sum of the parts.
    const total = stated ?? wholeMarksValue(exprStr);
    return total === null ? null : { per: null, total };
  }
  // A "×" split: the first number is the marks per sub-question, the
  // total is the stated product (or N*M when no total is printed).
  const per = (() => {
    const first = firstMarksFactor(exprStr);
    if (first === null) return null;
    const n = Math.round(first);
    return Math.abs(first - n) < 1e-9 && n >= 1 ? n : null;
  })();
  const total = stated ?? wholeMarksValue(exprStr);
  if (per === null && total === null) return null;
  return { per, total };
}

/**
 * Marks a row's own trailing expression means: the TOTAL the row is
 * worth. For "+" that is the stated total (or the sum); for "×" it is
 * the product (the stated K, or N*M when no total is printed) — the
 * row aggregates the M items, so "5×2=10" on a "Write short notes"
 * row is 10, not 5, and "$1\\times 5=5$" is 5, not 1. (The per-part
 * value is marksFromParts, used for instruction lines where the
 * expression is the group's rule, not the row's marks.)
 */
function marksTotalFromParts(
  exprStr: string,
  totalStr: string | undefined,
): number | null {
  const detail = marksDetailFromParts(exprStr, totalStr);
  return detail ? detail.total : null;
}

/**
 * Marks carried by an instruction line itself, as {per, total}: a
 * trailing ": 10" gives {per: null, total: 10}; a trailing marks
 * expression ("... : $2 \\times 4 = 8$", "... : 2×2=4") gives
 * {per: 2, total: 8}; a "+" expression gives {per: null, total}.
 * A LaTeX spacing command may sit between ":" and the number
 * ("... : \\hfill 10", CHMDSM252 Q10). Returns null when the line
 * carries no marks.
 */
function instructionMarksDetail(
  line: string,
): { per: number | null; total: number | null } | null {
  const expr = line.match(
    new RegExp(
      String.raw`\$?\s*\**(${MARKS_TERM}(?:\s*${MARKS_OP}\s*${MARKS_TERM})+)\s*(?:=\s*([\d০-৯]+))?\**\s*\$?\s*$`,
    ),
  );
  if (expr) {
    const detail = marksDetailFromParts(expr[1], expr[2]);
    if (detail !== null) {
      // Same validation the old instructionMarks did: the value it
      // would have returned (per for "×", total for "+") must be sane.
      const n = /\+/.test(expr[1]) ? detail.total : detail.per;
      if (n !== null && n >= 1 && n <= 100) return detail;
    }
  }
  const trailing = line.match(/:\s*(?:\\[a-zA-Z]+\s*)?\**([\d০-৯]+)\**\s*$/);
  if (trailing) {
    const n = asciiNumber(trailing[1]);
    if (n !== null && n >= 1 && n <= 100) return { per: null, total: n };
  }
  return null;
}

/**
 * An instruction line, English ("Answer any two of/from the following")
 * or Bengali ("যে কোনো দুটি প্রশ্নের উত্তর দাও"). The number is null
 * when the line carries none — the caller opens the next number.
 * `either` is true only for "either (a) or (b)" lines: there the (a)/(b)
 * parts are alternatives worth the question total each, even when the
 * line carries no number. `pairEither` is true only for "Answer either
 * [(a) and (b)] or [(c) and (d)]" lines: there the parts form two
 * alternative pairs, and the question is worth one pair's sum.
 */
function matchInstruction(line: string): {
  num: number | null;
  count: number;
  either: boolean;
  pairEither: boolean;
} | null {
  const en = line.match(INSTRUCTION_LINE);
  if (en) {
    const count = wordToNumber(en[2]);
    if (count === null) return null;
    return {
      num: en[1] ? asciiNumber(en[1]) : null,
      count,
      either: false,
      pairEither: false,
    };
  }
  const either = line.match(EITHER_LINE);
  if (either) {
    return {
      num: either[1] ? asciiNumber(either[1]) : null,
      count: 1,
      either: true,
      pairEither: false,
    };
  }
  const pairEither = line.match(PAIR_EITHER_LINE);
  if (pairEither) {
    return {
      num: pairEither[1] ? asciiNumber(pairEither[1]) : null,
      count: 2,
      either: true,
      pairEither: true,
    };
  }
  // Assamese spelling is folded (ৰ -> র) before matching, so
  // "যে কোনো তিনিটি প্ৰশ্নৰ উত্তৰ দাও" (BENSEC201 Q11) matches the
  // same pattern; the count word lookup below covers "তিনিটি".
  const bn = foldAsmRa(line).match(BN_INSTRUCTION_LINE);
  if (bn) {
    const count = BN_COUNT_WORDS.get(foldBnYy(bn[2]));
    if (count === undefined) return null;
    return {
      num: bn[1] ? asciiNumber(bn[1]) : null,
      count,
      either: false,
      pairEither: false,
    };
  }
  const mn = line.match(MN_INSTRUCTION_LINE);
  if (mn) {
    const count = mnInstructionCount(mn[2], line);
    if (count === null) return null;
    return {
      num: mn[1] ? asciiNumber(mn[1]) : null,
      count,
      either: false,
      pairEither: false,
    };
  }
  const mnBare = line.match(MN_BARE_LINE);
  if (mnBare) {
    const count = MN_COUNT_WORDS.get(mnBare[2]);
    if (count === undefined) return null;
    return {
      num: mnBare[1] ? asciiNumber(mnBare[1]) : null,
      count,
      either: false,
      pairEither: false,
    };
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
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
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

/**
 * The marks figure a (i)/(ii)/(iii)/(iv) segment ends in: a bare
 * number after terminal punctuation or a closing $ ("... . 3",
 * "... $$ 2"). Never a number inside maths ("divisible by 9." — the
 * 9 is followed by ".", not at the end) or the total of a split
 * expression ("3+2=5" — the 5 is preceded by "="). Returns null when
 * the segment carries no such figure.
 */
function segmentMarksFigure(segment: string): number | null {
  // Maths spans collapse to a bare "$" so a figure after one still
  // reads ("$$...$$ 2" -> "$ 2"), while a figure inside one vanishes
  // with the span ("$x=5$" -> "$").
  const flat = segment.replace(/\${1,2}[^$]*\${1,2}/g, " $ ");
  const m = flat.match(/(?:[.!?]|\$)\s+([\d০-৯]+)\s*$/);
  if (!m) return null;
  const n = asciiNumber(m[1]);
  if (n === null || n < 1 || n > 100) return null;
  return n;
}

/**
 * The total of a row whose (i)/(ii)/(iii)/(iv) sub-parts each print
 * their own figure on one line — "(i) ... 3 (ii) ... 2" is worth
 * 3+2=5, not the trailing 2 alone. Only when an (i) is followed by at
 * least one more marker (a lone "(ii)" is an oxidation state, not a
 * sub-part — "iron (ii) oxide") and EVERY segment carries a bare
 * figure: a segment ending in a split expression ("3+2=5") already
 * states the row's total, and the existing branches read it.
 */
function mergedSubPartMarks(text: string): number | null {
  const parts = text.split(/\((iii|ii|iv|i)\)/);
  if (parts.length < 5 || parts[1] !== "i") return null;
  const figures: number[] = [];
  for (let k = 2; k < parts.length; k += 2) {
    const fig = segmentMarksFigure(parts[k]);
    if (fig === null) return null;
    figures.push(fig);
  }
  if (figures.length < 2) return null;
  const sum = figures.reduce((a, b) => a + b, 0);
  return sum >= 1 && sum <= 100 ? sum : null;
}

function stripTrailingMarks(
  text: string,
  groupGuard: number | null,
  group: string,
): { text: string; marks: number | null } {
  // Sub-parts on one line, each with its own figure — "(i) ... 3
  // (ii) ... 2" is worth 3+2=5, not the trailing 2 alone (MTMSEC101T
  // Q9(b), MTMDSC302T Q8(d), MTMDSM301 Q8(c)). The figures stay in
  // the text (they are the sub-parts' printed marks); only the total
  // is returned. A sum that disagrees with the group's per-part marks
  // is rejected (batch 12) — except for an "Answer either" pair,
  // where the sum is the part's own marks and the guard is the pair's
  // total, not the part's.
  const merged = mergedSubPartMarks(text);
  if (merged !== null) {
    if (
      groupGuard === null ||
      groupGuard === merged ||
      group === "Answer either"
    ) {
      return { text, marks: merged };
    }
    // Disagrees with the guard: fall through to the existing
    // branches, which reject the trailing figure and fall back.
  }
  // A $...$ maths expression at the end of the question is its marks,
  // not part of its text — e.g. "$2+8=10$" or "$2 x 4 = 8$". It must
  // carry $ delimiters: a bare "2+3=5" could be the question itself.
  // The delimiters may be doubled ("$$2+2+1=5$$"). The expression is
  // the row's TOTAL: "5×2=10" is 10, "$1\\times 5=5$" is 5.
  // groupGuard is the per-part marks the instruction states (2 for
  // "Answer any two : 2×2=4"): a trailing expression that disagrees
  // with it is a sub-part's marks, not the row's — e.g. the (iii)
  // part's "$2+3=5$" at the end of a 10-mark "either (a) or (b)"
  // row — so it is rejected and the row falls back to the group.
  const tailMath = text.match(/^(.*?)\s*(\${1,2}[^$]+\${1,2})\s*$/);
  if (tailMath) {
    const expr = tailMath[2].match(MARKS_EXPR);
    if (expr) {
      const derived = marksTotalFromParts(expr[1], expr[2]);
      if (
        derived !== null &&
        derived >= 1 &&
        derived <= 100 &&
        (groupGuard === null || groupGuard === derived)
      ) {
        return { text: tailMath[1].trim(), marks: derived };
      }
    }
    // A lone "$N$" span is the row's marks figure ("... bond order?
    // $1$", CHMDSM151T 18(d)) — a single number, not a split
    // expression. Same guard rule as the bare-number branch below.
    const lone = tailMath[2].match(/^\${1,2}\s*\**([\d০-৯]+)\**\s*\${1,2}$/);
    if (lone) {
      const n = asciiNumber(lone[1]);
      if (
        n !== null &&
        n >= 1 &&
        n <= 100 &&
        (groupGuard === null || groupGuard === n)
      ) {
        return { text: tailMath[1].trim(), marks: n };
      }
    }
    // A trailing $...$ span that is not a marks figure is content (a
    // structure, a list of ions) — strip it and read the figure
    // before it ("... why? 2 $$[structures]$$", CHMDSM151T 25(d)).
    // The prefix is strictly shorter, so this terminates. When the
    // prefix has no figure either, fall through to the branches
    // below on the original text.
    const before = stripTrailingMarks(tailMath[1].trim(), groupGuard, group);
    if (before.marks !== null) return before;
  }
  // A bare marks expression at the end, e.g. "… : ২×২=৪" — Bengali
  // papers write it without $ delimiters. Checked before the bare
  // number below, or "৪" alone would be misread as marks 4. The
  // expression may carry bold markers ("**7+3**", "**4+4+2=10**").
  const bareExpr = text.match(
    new RegExp(
      String.raw`^(.*?)\s+\**(${MARKS_TERM}(?:\s*${MARKS_OP}\s*${MARKS_TERM})+)\s*(?:=\s*([\d০-৯]+))?\**\s*$`,
    ),
  );
  if (bareExpr) {
    const derived = marksTotalFromParts(bareExpr[2], bareExpr[3]);
    if (
      derived !== null &&
      derived >= 1 &&
      derived <= 100 &&
      (groupGuard === null || groupGuard === derived)
    ) {
      return { text: bareExpr[1].trim(), marks: derived };
    }
  }
  // A parenthesised trailing figure "(5)" is the row's marks
  // (MTMDSC301T Q10(a)-(d)) — but only standing alone after terminal
  // punctuation or a maths span, so a cross-reference ("equation
  // (5)") is not mistaken for marks. The punctuation stays in the
  // text, as the bare-number branch leaves it.
  const paren = text.match(/^(.*?)([.!?]|\$)\s*\(([\d০-৯]+)\)\s*$/);
  if (paren) {
    const n = asciiNumber(paren[3]);
    if (
      n !== null &&
      n >= 1 &&
      n <= 100 &&
      (groupGuard === null || groupGuard === n)
    ) {
      return { text: `${paren[1]}${paren[2]}`.trim(), marks: n };
    }
  }
  // A marks figure right after a colon, introducing a quoted passage
  // — "বাংলায় অনুবাদ করো : ২ "Arise, awake..."" (BENSEC201 Q8/Q9/Q10).
  // The figure is the question's marks, not part of the passage: the
  // colon stays, the figure goes. The quote anchor matters: a bare
  // ": 5" mid-text could be part of the question itself.
  const colonQuote = text.match(
    /^(.*?):\s*\**([\d০-৯]+)\**\s+(["“‘].*)$/,
  );
  if (colonQuote) {
    const n = asciiNumber(colonQuote[2]);
    if (
      n !== null &&
      n >= 1 &&
      n <= 100 &&
      (groupGuard === null || groupGuard === n)
    ) {
      return { text: `${colonQuote[1]}: ${colonQuote[3]}`.trim(), marks: n };
    }
  }
  // A marks figure/expression after a colon, with the question's
  // items after it — "টীকা লেখো : ২ তদ্ভব শব্দ" (BNGAEC101T Q3),
  // "অশুদ্ধি সংশোধন করো (যে কোনো পাঁচটি) : ১×৫=৫ কৌতুহল; ..."
  // (BNGAEC101T Q15), "ব্যাসবাক্যসহ সমাস নির্ণয় করো (যে কোনো
  // পাঁচটি) : ১×৫=৫ দম্পতি; ..." (BNGAEC201T Q25). The figure is
  // the question's marks, not part of the items: the colon stays,
  // the figure goes, the items stay. Only when the rest carries no
  // sub-question marker — a merged "(i) ... : 2 ... (ii) ..." row
  // keeps its figures for the merged-sum logic — and, for a bare
  // figure, no question mark or list star (the rest is a topic or a
  // list, not another question).
  const colonMid = text.match(
    /^(.*?):\s+\**([\d০-৯]+(?:\s*(?:\\times|[×x+])\s*[\d০-৯]+)*)\s*(?:=\s*([\d০-৯]+))?\**\s+(.+)$/,
  );
  if (colonMid) {
    const rest = colonMid[4];
    const hasSubMarker =
      /\([a-jকখগঘঙ]\)/.test(rest) || /\((i|ii|iii|iv)\)/.test(rest);
    if (!hasSubMarker) {
      let derived: number | null = null;
      if (/[×x+]/.test(colonMid[2])) {
        // An N×M=K expression after the colon is unambiguous marks.
        derived = marksTotalFromParts(colonMid[2], colonMid[3]);
      } else if (!/[?*]/.test(rest)) {
        // A bare figure: only when the rest is a topic or a list.
        derived = asciiNumber(colonMid[2]);
      }
      if (
        derived !== null &&
        derived >= 1 &&
        derived <= 100 &&
        (groupGuard === null || groupGuard === derived)
      ) {
        return { text: `${colonMid[1]}: ${rest}`.trim(), marks: derived };
      }
    }
  }
  // A trailing marks figure followed by a page footer ("★★★ J25—..."):
  // the figure is the question's marks, the footer is not question
  // text (BNGAEC101T Q25). The ★ marker is distinctive — exam-code
  // footers are the only ★ usage in these transcripts.
  const footerMarks = text.match(/^(.*?)\s+\**([\d০-৯]+)\**\s+★.*$/);
  if (footerMarks) {
    const n = asciiNumber(footerMarks[2]);
    if (
      n !== null &&
      n >= 1 &&
      n <= 100 &&
      (groupGuard === null || groupGuard === n)
    ) {
      return { text: footerMarks[1].trim(), marks: n };
    }
  }
  // A bare number at the end of the question is its marks — but only
  // when it is a plausible mark (<= 100) and agrees with the group's
  // per-part marks when those are known. A year or a number inside the question
  // never looks like this: it is followed by punctuation or is too big.
  // The number may carry *emphasis* ("**10**") or be Bengali digits.
  const m = text.match(/^(.*?)\s+\**([\d০-৯]+)\**$/);
  if (!m) return { text, marks: null };
  const n = asciiNumber(m[2]);
  if (n === null || n < 1 || n > 100) return { text, marks: null };
  if (groupGuard !== null && groupGuard !== n) return { text, marks: null };
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
  // The per-part marks the instruction states, used only as the guard
  // in stripTrailingMarks (a trailing expression that disagrees with
  // it is a sub-part's marks, not the row's). It is NOT the fallback:
  // under "Answer any one : 10" spanning two numbered questions the
  // parts are worth 5, 2, 3 — the 10 is the question total, and a part
  // must never inherit it.
  let groupGuard: number | null = null;
  // The question number the current group's instruction named (null
  // when the instruction carried no number), and whether the group's
  // marks came from an unnumbered bare ": T" (provisional: the first
  // question line shows whether the alternatives are the parts that
  // follow the instruction, each worth T, or the numbered questions
  // after it, whose parts add up to T).
  let groupQNum: number | null = null;
  let groupBareUnnumbered = false;
  // Whether groupMarks was set by a standalone marks-expression line
  // ("8×5") since the last heading, and whether any instruction has
  // been seen since the last heading. A marks line printed ABOVE a
  // section's instruction states that section's per-part marks
  // (ECOIDC-151T Section C: "8×5" then "Answer any five questions :"
  // with no marks of its own) — the first instruction after a heading
  // inherits it, so the section's questions read 8 instead of blank.
  // A marks line AFTER an instruction belongs to that instruction,
  // so a later instruction must not inherit it (hence the second
  // flag): without it the per would leak into the next group.
  let groupMarksFromLine = false;
  let seenInstructionSinceHeading = false;
  // rows.length when the current group was set by an instruction.
  let rowsAtGroupStart = 0;
  // Whether the current group governs the whole section: an
  // unnumbered instruction whose question produced no rows before the
  // next number arrived (see clearGroupForNumber). A section
  // instruction ("যে কোনো দশটি প্রশ্নের উত্তর দাও : $২×১০=২০$",
  // BNGDSC152T বিভাগ—ক) survives every numbered question under it;
  // a new heading or instruction ends it.
  let sectionScoped = false;
  // What the most recent heading was: "section" for বিভাগ/SECTION
  // headings, "unit" for UNIT/গুচ্ছ, null before any heading. Only a
  // section heading can open a section instruction (see below).
  let lastHeadingKind: "section" | "unit" | null = null;
  let orPending = false;
  // A bare "(b)" label seen on its own line, waiting for the next
  // line to supply that sub-question's text.
  let pendingSub: string | null = null;
  // The letter of the most recent sub-question row for the current
  // question number — the sequence gate for (i)/(j) (see
  // acceptsSubLetter). Reset whenever the question number changes.
  let lastSubLetter = "";

  /** Append " (OR)" to a row's group, or set it to "OR" when empty. */
  const applyOr = (row: QuestionRow): void => {
    if (row.group === "OR" || row.group.endsWith(" (OR)")) return;
    row.group = row.group ? `${row.group} (OR)` : "OR";
  };

  /**
   * (i)/(j) are sub-questions only in sequence — (i) after (h), (j)
   * after (i) in the same question. A lone "(i)/(ii)" line is an MCQ
   * option (ENGSEC101T: "(i) Stationary (ii) Stationery" under Q1(c))
   * and must not become a row. The Bengali (ঝ) maps to "i", so the
   * same gate covers it.
   */
  const acceptsSubLetter = (letter: string): boolean => {
    if (letter === "i") return lastSubLetter === "h";
    if (letter === "j") return lastSubLetter === "i";
    return true;
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
    // Under a section-scoped group the guard value is the per-QUESTION
    // total (10 in "Answer any five : 10×5=50"), not per-part marks —
    // the parts split that total (CHMDSM151T 16(a)=1+2=3,
    // 16(b)=1+1=2), so the guard must not reject their own printed
    // figures. A part with no figure still falls back to groupMarks
    // below (a section question with no split marks at all,
    // BOTDSC151T 19(a)/(b)).
    const stripped = stripTrailingMarks(
      orStripped.text,
      sectionScoped ? null : groupGuard,
      group,
    );
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
    lastSubLetter = letter;
    const { row, isOr } = subRow(letter, rawText);
    if (isOr) {
      applyOr(row);
      orPending = true;
      rows.push(row);
    } else {
      pushRow(row);
    }
  };

  /**
   * A rejected "(i)/(ii)/..." line that ends in a marks expression is
   * a continuation of the previous sub-question — its sub-parts,
   * printed on their own line. Join it into that row's text and
   * re-derive the marks (MTMDSC301T Q6(b), MTMDSC302T Q2(c),
   * MTMDSM301 Q8(a), MTMDSC201T Q10(d)). A line with no trailing
   * marks is an MCQ option (ENGSEC101T "(i) Stationary (ii)
   * Stationery") and stays dropped. Returns true when joined.
   */
  const joinContinuation = (line: string): boolean => {
    const probe = stripTrailingMarks(line, null, "");
    if (probe.marks === null) return false;
    const last = rows[rows.length - 1];
    if (!last) return false;
    if (last.label.split("(")[0] !== qNum) return false;
    // The pair-either instruction row is not a question to continue.
    if (last.label === qNum && last.group === "Answer either") return false;
    last.question = `${last.question} ${line}`.trim();
    const rederived = stripTrailingMarks(
      last.question,
      sectionScoped ? null : groupGuard,
      group,
    );
    last.question = rederived.text;
    if (rederived.marks !== null) last.marks = rederived.marks;
    return true;
  };

  /**
   * A new numbered question ends the current group, unless the group
   * governs this very number (a numbered instruction's own parts) or
   * the group came from an unnumbered instruction whose alternatives
   * are the numbered questions that follow. A numbered question under
   * an unnumbered bare instruction is a candidate: its parts add up
   * to the total, they are not each worth it — so the parts keep
   * their own marks (the group label stays, for the counter).
   * The one exception is a SECTION instruction: an unnumbered
   * per-detail instruction whose question produced NO rows before
   * this number arrived governs the numbered questions that follow
   * it, not one question's parts — it is recognised as section-scoped
   * here and survives every later number under the section. Two
   * things must both hold: no row was pushed for the opened number
   * yet, and the most recent heading is a বিভাগ/SECTION heading.
   * The MTM shape is the other one: the instruction's (a)/(b) rows
   * were pushed first (MTMDSM301 UNIT—II), so the group clears here
   * exactly as before and its per-part marks never leak into the
   * next question.
   */
  const clearGroupForNumber = (n: number | null): void => {
    if (n === null) return;
    if (sectionScoped) return;
    if (groupQNum !== null && n !== groupQNum) {
      group = "";
      groupMarks = null;
      groupGuard = null;
      groupQNum = null;
      groupBareUnnumbered = false;
    } else if (groupBareUnnumbered) {
      groupMarks = null;
      groupGuard = null;
      groupBareUnnumbered = false;
    } else if (
      groupQNum === null &&
      String(n) !== qNum &&
      (groupGuard !== null || group === "Answer either")
    ) {
      // An unnumbered per-detail instruction ("$2×2=4$") or
      // pair-either governs only the sub-questions under the number it
      // opened; a new numbered question ends it, or its per-part marks
      // and group leak into the next question (MTMDSM301 Q4(a) and
      // MTMDSC301T Q8(c) both read a phantom 2 from the stale group).
      // Unless no row was pushed for the opened number at all: then
      // the instruction is a section instruction (see above) — but
      // only under a বিভাগ/SECTION heading; a UNIT heading can never
      // open one (MTMDSM301 UNIT—II).
      if (
        rows.length === rowsAtGroupStart &&
        lastHeadingKind === "section"
      ) {
        sectionScoped = true;
        return;
      }
      group = "";
      groupMarks = null;
      groupGuard = null;
      groupQNum = null;
      groupBareUnnumbered = false;
    } else if (
      groupQNum === null &&
      !groupBareUnnumbered &&
      String(n) === qNum &&
      groupGuard !== null &&
      rows.length === rowsAtGroupStart &&
      lastHeadingKind === "section"
    ) {
      // The first numbered question under an unnumbered per-detail
      // instruction IS the number the instruction opened, and no row
      // was pushed for it yet: the instruction governs the numbered
      // questions that follow (section shape, BNGDSC152T বিভাগ—ক:
      // the instruction opens Q1, then Q1, Q2, ... are direct
      // questions each worth the per-part marks). Without this the
      // group would be recognised one number too late — Q1 keeps it
      // and Q2 loses it.
      sectionScoped = true;
    }
  };

  // A bare question number on its own line ("২১।"), waiting for its
  // text — which may start on the next line as a blockquote
  // (BNGDSM151T Q21). Lines after it are its text until a structural
  // line arrives. Only the next number opens one (a bare "1."/"2."
  // inside a question is a list item, PHYDSC302T Q10(b), not a
  // question start).
  let pendingQ: { num: string; text: string } | null = null;

  /** A line that starts a new row or ends the current group. */
  const isStructuralLine = (l: string): boolean =>
    UNIT_HEADING.test(l) ||
    /^(OR|অথবা)$/i.test(l.replace(/^[#*\s]+|[#*\s]+$/g, "")) ||
    matchInstruction(l) !== null ||
    MARKS_EXPR.test(l) ||
    NUMBERED_SUB_LINE.test(l) ||
    BARE_SUB_LINE.test(l) ||
    SUB_QUESTION_LINE.test(l) ||
    NUMBERED_LINE.test(l) ||
    /^\((ii|iii|iv)\)\s+.+$/.test(l) ||
    /^[\d০-৯]+\s*[।.]$/.test(l);

  /** Flush a pending bare-number question as a row (if it has text). */
  const flushPendingQ = (): void => {
    if (!pendingQ) return;
    const { num, text } = pendingQ;
    pendingQ = null;
    if (!text.trim()) return;
    const orStripped = stripTrailingOr(text.trim());
    const stripped = stripTrailingMarks(orStripped.text, null, "");
    const row: QuestionRow = {
      label: num,
      question: stripped.text,
      marks: stripped.marks ?? groupMarks,
      unit,
      group,
      id: `${paperCode}-Q${num}`,
      keywords: "",
    };
    if (orStripped.isOr) {
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
      unit =
        unitMatch[2] ??
        unitMatch[3] ??
        (unitMatch[4] ? asciiDigits(unitMatch[4]) : "");
      lastHeadingKind =
        unitMatch[1] === "SECTION" || unitMatch[3] !== undefined
          ? "section"
          : "unit";
      // A unit is self-contained: every unit starts with its own
      // instruction, so the previous unit's group never carries over.
      group = "";
      groupMarks = null;
      groupGuard = null;
      groupQNum = null;
      groupBareUnnumbered = false;
      groupMarksFromLine = false;
      seenInstructionSinceHeading = false;
      sectionScoped = false;
      orPending = false;
      pendingSub = null;
      lastSubLetter = "";
      continue;
    }

    // A standalone OR line: the question above and the one below are
    // alternatives — each counts once. Bengali papers write অথবা.
    // The line may be a heading ("### OR") or bold ("**OR**").
    // Only a direct question (label with no sub-part) takes the OR
    // group: when the question above has (a)/(b)/(c) parts, its last
    // part is not itself the alternative — the whole question is
    // (PHYDSM101T Q8(c) was wrongly grouped OR, double-counting its
    // 3 marks). The question-level alternative is still recorded by
    // orPending for the row below, and by the counter's or_pairs.
    if (/^(OR|অথবা)$/i.test(line.replace(/^[#*\s]+|[#*\s]+$/g, ""))) {
      if (rows.length > 0 && !rows[rows.length - 1].label.includes("(")) {
        applyOr(rows[rows.length - 1]);
      }
      orPending = true;
      continue;
    }

    // Page markers and any other HTML comments are not questions.
    if (line.startsWith("<!--")) continue;

    // A pending bare-number question: a structural line ends it (and
    // is then handled normally below); anything else is its text —
    // a blockquote marker is stripped, lines join with a space.
    if (pendingQ) {
      if (isStructuralLine(line)) {
        flushPendingQ();
      } else {
        pendingQ.text +=
          (pendingQ.text ? " " : "") + line.replace(/^>\s*/, "");
        continue;
      }
    }

    // Instruction lines (English or Bengali). The number is optional:
    // an unnumbered instruction opens the next question number — a
    // missing "1." must not lose the whole first question. The group
    // stays until the next instruction (or a new numbered question
    // outside it): an unnumbered "Answer any one : 10" spans the two
    // numbered questions that follow it (CHMDSC252 Q2/Q3), it does
    // not end at the first one.
    const instr = matchInstruction(line);
    if (instr) {
      if (instr.num !== null) {
        qNum = String(instr.num);
        lastQNum = instr.num;
      } else {
        lastQNum += 1;
        qNum = String(lastQNum);
      }
      lastSubLetter = "";
      group = instr.pairEither
        ? "Answer either"
        : `Answer any ${instr.count}`;
      groupQNum = instr.num;
      rowsAtGroupStart = rows.length;
      sectionScoped = false;
      const detail = instructionMarksDetail(line);
      if (instr.pairEither) {
        // The printed total (": 10") is the PAIR's total, not each
        // part's — the parts are worth 5 each, so it must not become
        // the per-part guard (a trailing "5" would be rejected and the
        // part would fall back to 10). The parts read their own
        // figures; the total rides on the instruction row below.
        groupMarks = null;
        groupGuard = null;
        groupBareUnnumbered = false;
      } else if (detail && detail.per !== null) {
        // "N×M=K": the per-part marks are explicit (2 in "2×2=4").
        groupMarks = detail.per;
        groupGuard = detail.per;
        groupBareUnnumbered = false;
      } else if (detail) {
        // Bare ": T" (or a "+" total): the question total. The parts
        // are alternatives worth T each when they follow the
        // instruction directly (a numbered instruction, or an
        // either/or line); when the instruction is unnumbered, the
        // alternatives are the numbered questions that follow, so the
        // marks stay provisional until the first question line shows
        // which shape this is.
        groupMarks = detail.total;
        groupGuard = detail.total;
        groupBareUnnumbered = instr.num === null && !instr.either;
      } else if (groupMarksFromLine && !seenInstructionSinceHeading) {
        // The instruction prints no marks, but a standalone marks
        // line above it does ("8×5" over ECOIDC-151T Section C):
        // keep that line's per-part marks. Without this the section's
        // questions read blank (Q38–Q45) and the counter falls back
        // per question (90/70 instead of 70/70). Only the first
        // instruction after a heading inherits it, and the marks are
        // per-part (from N×M), so groupBareUnnumbered stays false —
        // the parts ARE each worth the per, they do not add up to it.
        groupBareUnnumbered = false;
      } else {
        groupMarks = null;
        groupGuard = null;
        groupBareUnnumbered = false;
      }
      // A marks line's per is consumed by the first instruction after
      // it (whether kept, overridden by the instruction's own marks,
      // or dropped because an earlier instruction owns it).
      groupMarksFromLine = false;
      seenInstructionSinceHeading = true;
      if (instr.pairEither) {
        // The pair-either instruction is also a row (the question
        // itself): its printed total, when present, is the question's
        // marks — it saves the count when the parts are gutter-hidden
        // (MTMDSC302T Q2/Q10). With no printed total the row carries
        // no marks and the counter takes the larger pair's sum.
        const afterNum = line.replace(/^[\d০-৯]+[।.]\s*/, "");
        const orStripped = stripTrailingOr(afterNum.trim());
        const stripped = stripTrailingMarks(orStripped.text, null, "");
        const instrRow: QuestionRow = {
          label: qNum,
          question: stripped.text,
          marks: stripped.marks,
          unit,
          group: "Answer either",
          id: `${paperCode}-Q${qNum}`,
          keywords: "",
        };
        if (orStripped.isOr) {
          applyOr(instrRow);
          orPending = true;
          rows.push(instrRow);
        } else {
          pushRow(instrRow);
        }
      }
      pendingSub = null;
      continue;
    }

    // A line that is only a marks expression ("$2 x 4 = 8$", "2×2=4").
    // After an instruction it is the group's marks (the standalone
    // "$2 x 4 = 8$" case: no row exists for the number yet). After a
    // question it belongs to that question — PHYDSM101T Q9b has
    // "$$2+2+1=5$$" on its own line under (b), and Q8's "1+3+3+3=10"
    // sits under its instruction line. A lone line under a question
    // is that question's total ("5×2=10" is 10, not 5); under an
    // instruction it is the per-part marks.
    const marksMatch = line.match(MARKS_EXPR);
    if (marksMatch) {
      pendingSub = null;
      const nPer = marksFromParts(marksMatch[1], marksMatch[2]);
      const nTotal = marksTotalFromParts(marksMatch[1], marksMatch[2]);
      const last = rows[rows.length - 1];
      if (
        nTotal !== null &&
        last &&
        last.marks === null &&
        qNum !== "" &&
        last.label.split("(")[0] === qNum
      ) {
        last.marks = nTotal;
      } else if (groupMarks === null && nPer !== null) {
        groupMarks = nPer;
        groupGuard = nPer;
        // Remember the per came from this line, not from an
        // instruction: the first instruction after a heading may
        // inherit it (see the instruction branch above).
        groupMarksFromLine = true;
      }
      continue;
    }

    // "1. (a) What ...?" — a question number with its first part inline.
    const numberedSub = line.match(NUMBERED_SUB_LINE);
    if (numberedSub) {
      const letter =
        numberedSub[2] ?? BN_PART_TO_LATIN[numberedSub[3]];
      // A first part of (i)/(j) cannot be in sequence — the question
      // number just changed, so the (a)–(h) run it would follow belongs
      // to another question. It is an MCQ option, not a row.
      if (letter === "i" || letter === "j") continue;
      const n = asciiNumber(numberedSub[1]);
      if (n !== null) {
        clearGroupForNumber(n);
        qNum = String(n);
        lastQNum = n;
      }
      pendingSub = null;
      pushSubRow(letter, numberedSub[4]);
      continue;
    }

    // The line after a bare sub-question label is that question's
    // text. Checked before SUB_QUESTION_LINE: "(i) ..." content must
    // not become a sub-question of its own. An instruction or a new
    // numbered question instead means the bare label had no text.
    if (
      pendingSub &&
      qNum &&
      !matchInstruction(line) &&
      !NUMBERED_LINE.test(line)
    ) {
      pushSubRow(pendingSub, line);
      pendingSub = null;
      continue;
    }

    // A bare sub-question label on its own line: remember it and take
    // the next line as its text.
    const bareSub = line.match(BARE_SUB_LINE);
    if (bareSub && qNum) {
      const letter = bareSub[1] ?? BN_PART_TO_LATIN[bareSub[2]];
      // A bare (i)/(j) out of sequence is an MCQ option label, not a
      // sub-question — leave it for the next line to be ignored.
      if (!acceptsSubLetter(letter)) continue;
      pendingSub = letter;
      continue;
    }

    // A "(ii)"/"(iii)"/"(iv)" line never starts a sub-question (those
    // are single letters) — it is a continuation of the previous row's
    // sub-parts, or an MCQ option. Join it when it ends in marks.
    if (/^\((ii|iii|iv)\)\s+.+$/.test(line)) {
      joinContinuation(line);
      continue;
    }

    const subMatch = line.match(SUB_QUESTION_LINE);
    if (subMatch && qNum) {
      pendingSub = null;
      const letter = subMatch[1] ?? BN_PART_TO_LATIN[subMatch[2]];
      // A lone (i)/(j) out of sequence is an MCQ option, not a row —
      // unless it ends in a marks expression, in which case it is the
      // previous sub-question's sub-parts on their own line.
      if (!acceptsSubLetter(letter)) {
        joinContinuation(line);
        continue;
      }
      pushSubRow(letter, subMatch[3]);
      continue;
    }

    // A bare question number on its own line ("২১।") — its text
    // follows on the next lines (see pendingQ above). Only the next
    // number opens one: a bare "1."/"2." inside a question is a list
    // item (PHYDSC302T Q10(b)), not a question start.
    const bareNum = line.match(/^([\d০-৯]+)\s*[।.]$/);
    if (bareNum) {
      const n = asciiNumber(bareNum[1]);
      if (n !== null && n === lastQNum + 1) {
        clearGroupForNumber(n);
        qNum = String(n);
        lastQNum = n;
        lastSubLetter = "";
        pendingSub = null;
        pendingQ = { num: String(n), text: "" };
        continue;
      }
      // Any other bare number is not a question start.
      continue;
    }

    const numMatch = line.match(NUMBERED_LINE);
    if (numMatch) {
      // A direct question with no sub-parts. It also becomes the
      // current question number for any (a)/(b) lines that follow it.
      const n = asciiNumber(numMatch[1]);
      if (n !== null) {
        clearGroupForNumber(n);
        qNum = String(n);
        lastQNum = n;
      } else {
        qNum = numMatch[1];
      }
      // A new number breaks the sub-letter sequence: an (i) line
      // after this is an MCQ option, not a sub-question of it.
      lastSubLetter = "";
      pendingSub = null;
      const orStripped = stripTrailingOr(numMatch[2].trim());
      const stripped = stripTrailingMarks(orStripped.text, null, "");
      // A direct question under a group carries the group's rule and,
      // when it prints no marks of its own, the group's per-part
      // marks — a section question ("যে কোনো দশটি ... : $২×১০=২০$")
      // is worth 2, not blank. The group was already cleared above
      // when this number is outside it, so a stale group never leaks
      // in here.
      const row: QuestionRow = {
        label: qNum,
        question: stripped.text,
        marks: stripped.marks ?? groupMarks,
        unit,
        group,
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
