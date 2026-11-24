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
// Section instructions add a per-unit count before the total —
// "প্রতিটি ইউনিট থেকে যে কোনো দুটি প্রশ্ন নিয়ে দশটি প্রশ্নের
// উত্তর দাও" (BNGDSC102T Section A, batch 37, G29): answer two
// from each unit, ten in total. The count is the SECOND word
// (ten), captured as group 3; group 2 is the per-unit count. The
// "প্রতিটি ইউনিট থেকে" prefix is optional in the pattern. The য়
// in "নিয়ে" is written as \u09df, never typed (typing it produces
// the YA + nukta form, which never matches) — and matchInstruction
// folds the line with foldBnYy first, because the staged transcripts
// mix both byte forms (BNG1D is YA + nukta, BNGAEC101T is U+09DF).
// AEC papers put "নিম্নলিখিত" (the following) before "যে কোনো"
// ("১। নিম্নলিখিত যে কোনো তিনটি প্রশ্নের উত্তর দাও", BNGAEC101T Q1)
// — same instruction, same rule; without the prefix the line became
// a direct question row and its (a)–(d) parts got no marks.
// Assamese spelling (BENSEC201 Q11): "যে কোনো তিনিটি প্ৰশ্নৰ উত্তৰ
// দাও" — the ৰ is folded to র before matching (see foldAsmRa), and
// the ে in "প্রশ্নের" is optional because the Assamese form drops it
// ("প্রশ্নর"). The count word "তিনিটি" is in BN_COUNT_WORDS.
const BN_INSTRUCTION_LINE =
  /^(?:([\d০-৯]+)[।.]\s*)?(?:প্রতিটি\s+ইউনিট\s+থেকে\s+)?(?:নিম্নলিখিত\s+)?যে[\s-]*কোনো\s*(\S+?)\s*(?:প্রশ্ন\s+নি\u09dfে\s+(?:মোট\s+)?(\S+?)\s+)?(?:(?:অতি\s+)?সংক্ষিপ্ত\s+)?প্রশ্নে?র\s+(?:(?:অতি\s+)?সংক্ষিপ্ত\s+)?উত্তর\s+দাও(?=\s|:|$)[^\n]*$/;

// Bengali section instruction without "যে কোনো": "প্রতিটি ইউনিট
// থেকে একটি করে প্রশ্ন নিয়ে মোট পাঁচটি প্রশ্নের উত্তর দাও"
// (BNGAEC101T Section B/C, BNGSEC101T Section B/C, batch 37,
// G29/G30) — answer one from each unit, M questions in total;
// the count is M (group 2).
const BN_SECTION_EACH_LINE =
  /^(?:([\d০-৯]+)[।.]\s*)?প্রতিটি\s+ইউনিট\s+থেকে\s+একটি\s+করে\s+প্রশ্ন\s+নি\u09dfে\s+(?:মোট\s+)?(\S+?)\s+প্রশ্নে?র\s+উত্তর\s+দাও(?=\s|:|$)[^\n]*$/;

// English section instruction: "Answer ten questions, selecting any
// two from each Unit : $2 \times 10 = 20$" (BOTDSC101T/102T Section
// A, batch 37, G31) — N questions in total, M from each unit; the
// count is N (group 2). INSTRUCTION_LINE only covers "Answer any
// N ...", so this shape needs its own pattern.
const EN_SECTION_INSTRUCTION_LINE =
  /^(?:([\d০-৯]+)[।.]\s*)?Answer\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d+)\s+questions?,\s+selecting\s+(?:any\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d+)\s+from\s+each\s+Unit\b[^\n]*$/i;

// A section-level instruction's markers: it spans units ("প্রতিটি
// ইউনিট থেকে" / "from each Unit") or states a total over per-unit
// counts ("প্রশ্ন নিয়ে মোট M প্রশ্নের"). An instruction carrying
// one governs the whole section, so it must survive the UNIT
// headings inside that section (see sectionInstrPending in
// parseTranscriptToRows).
const SECTION_LEVEL_SHAPE =
  /প্রতিটি\s+ইউনিট\s+থেকে|নি\u09dfে\s+(?:মোট\s+)?\S+\s+প্রশ্নের|from\s+each\s+Unit/i;

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
// The total may be cut off ("1+4=", ECOSEC151T Q31/Q32, batch 25):
// a trailing "=" with no digits still yields the partial sum.
const MARKS_EXPR = new RegExp(
  String.raw`^\${0,2}\s*(${MARKS_TERM}(?:\s*${MARKS_OP}\s*${MARKS_TERM})+)\s*(?:=\s*([\d০-৯]+)?)?\s*\${0,2}$`,
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
      // The total may be cut off ("5×5=", ECOSEC151T Section C,
      // batch 25): a trailing "=" with no digits still yields the
      // partial sum / product. A trailing "*" bullet artifact is
      // tolerated after the figure (": 10 *", ECODSM101T Q4).
      String.raw`\$?\s*\**(${MARKS_TERM}(?:\s*${MARKS_OP}\s*${MARKS_TERM})+)\s*(?:=\s*([\d০-৯]+)?)?\**\s*\$?\s*$`,
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
  // A trailing "*" bullet artifact may sit after the figure, with a
  // space between ("... : 10 *", ECODSM101T Q4, batch 25) — the
  // space-separated star blocked the read before.
  const trailing = line.match(/:\s*(?:\\[a-zA-Z]+\s*)?\**([\d০-৯]+)[\s*]*$/);
  if (trailing) {
    const n = asciiNumber(trailing[1]);
    if (n !== null && n >= 1 && n <= 100) return { per: null, total: n };
  }
  // A bracketed figure ": [10]" is the same as a bare ": 10"
  // (PHIDSC303T Q10: "Answer any one of the following : [10]").
  const bracket = line.match(/:\s*\[([\d০-৯]+)\][\s*]*$/);
  if (bracket) {
    const n = asciiNumber(bracket[1]);
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
  const enSection = line.match(EN_SECTION_INSTRUCTION_LINE);
  if (enSection) {
    const count = wordToNumber(enSection[2]);
    if (count === null) return null;
    return {
      num: enSection[1] ? asciiNumber(enSection[1]) : null,
      count,
      either: false,
      pairEither: false,
    };
  }
  // Either-group lines may arrive with their brackets wrapped in maths
  // spans — "Answer either $[(a)$ and $(b)]$ or $[(c)$ and $(d)]$"
  // (MATDSC253 lite, batch 24). The $ and * carry no meaning here, so
  // the either patterns are tested against the stripped line; the
  // instruction row itself keeps the original text.
  const clean = line.replace(/[$*]/g, "");
  const either = clean.match(EITHER_LINE);
  if (either) {
    return {
      num: either[1] ? asciiNumber(either[1]) : null,
      count: 1,
      either: true,
      pairEither: false,
    };
  }
  const pairEither = clean.match(PAIR_EITHER_LINE);
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
  const bn = foldBnYy(foldAsmRa(line)).match(BN_INSTRUCTION_LINE);
  if (bn) {
    // "প্রশ্ন নিয়ে মোট M প্রশ্নের": the count is M (total to
    // answer), not N (per unit) — batch 37, G29.
    const countWord = bn[3] ?? bn[2];
    const count = BN_COUNT_WORDS.get(foldBnYy(countWord));
    if (count === undefined) return null;
    return {
      num: bn[1] ? asciiNumber(bn[1]) : null,
      count,
      either: false,
      pairEither: false,
    };
  }
  const bnEach = foldBnYy(foldAsmRa(line)).match(BN_SECTION_EACH_LINE);
  if (bnEach) {
    const count = BN_COUNT_WORDS.get(foldBnYy(bnEach[2]));
    if (count === undefined) return null;
    return {
      num: bnEach[1] ? asciiNumber(bnEach[1]) : null,
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

/**
 * A section instruction the pipeline reflow joined onto the previous
 * question's line (BNGSEC101T Q20/Q30, batch 37, G32): "20. ...?
 * প্রতিটি ইউনিট থেকে একটি করে প্রশ্ন নিয়ে পাঁচটি প্রশ্নের উত্তর
 * দাও : ২×৫=১০". Returns [question part, instruction part]; the
 * tail must validate as an instruction, so a question that merely
 * mentions units never splits. The last validating split point wins
 * (the instruction sits at the end of the line). The English shape
 * ("... Answer five questions, selecting one from each Unit: ...")
 * is covered the same way.
 */
function splitAppendedSectionInstruction(
  line: string,
): [string, string] | null {
  const re =
    /(প্রতিটি\s+ইউনিট\s+থেকে\s+.+|Answer\s+\S+\s+questions?,\s+selecting\s+.+)/g;
  let m: RegExpExecArray | null;
  let found: [string, string] | null = null;
  while ((m = re.exec(line)) !== null) {
    const before = line.slice(0, m.index).trim();
    const tail = m[0].trim();
    if (before && matchInstruction(tail) !== null) {
      found = [before, tail];
    }
  }
  return found;
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
  // A trailing "\quad <n>" inside a display formula is the segment's
  // marks figure ("$$... \quad 3$$", MATDSC152T Q22(a)(ii), batch 29).
  // The maths-span collapse below would swallow it with the formula.
  const quad = segment.match(/\\(?:quad|qquad)\s*([\d০-৯]+)\s*\${1,2}\s*$/);
  if (quad) {
    const n = asciiNumber(quad[1]);
    if (n !== null && n >= 1 && n <= 100) return n;
  }
  // Same shape, split-sum form ("$$... \quad 1+5=6$$", PHYDSC101T
  // 2(a)/3(b), batch 33): the stated total, verified against the
  // parts' sum.
  const quadSum = segment.match(
    /\\(?:quad|qquad)\s*([\d০-৯]+(?:\s*[+×x]\s*[\d০-৯]+)+)\s*=\s*([\d০-৯]+)\s*\${1,2}\s*$/,
  );
  if (quadSum) {
    const total = asciiNumber(quadSum[2]);
    const terms = (quadSum[1].match(/[\d০-৯]+/g) ?? []).map(
      (t) => asciiNumber(t) ?? 0,
    );
    const sum = terms.reduce((a, b) => a + b, 0);
    if (total !== null && total >= 1 && total <= 100 && sum === total)
      return total;
  }
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
): {
  text: string;
  marks: number | null;
  split: boolean;
  splitExpr?: string;
} {
  // `split` is true when the marks were derived from a multi-term
  // expression (a total composed of parts: "1+3+3+3=10", "$2+8=10$")
  // and false for a single figure (": 2", "$10$", "[5]"). The G14
  // parent fill needs it: a split total must never be copied onto
  // the parts (PHYDSM101T Q8's parts are 3+3+3, not 10 each), while
  // a single figure is the whole question's marks (ENGSEC101T Q18).
  // `splitExpr` is the raw expression the split total came from
  // ("5+5", "5×2", "1+3+3+3") — the G28 post-pass derives the
  // sub-rows' marks from it ("$5+5=10$" with (a)/(b) means 5 each);
  // it is absent for merged (i)/(ii)/(iii) sums, which have no
  // single expression.
  // `split` is true when the marks were derived from a multi-term
  // expression (a total composed of parts: "1+3+3+3=10", "$2+8=10$")
  // and false for a single figure (": 2", "$10$", "[5]"). The G14
  // parent fill needs it: a split total must never be copied onto
  // the parts (PHYDSM101T Q8's parts are 3+3+3, not 10 each), while
  // a single figure is the whole question's marks (ENGSEC101T Q18).
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
      return { text, marks: merged, split: true };
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
        return {
          text: tailMath[1].trim(),
          marks: derived,
          split: true,
          splitExpr: expr[1],
        };
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
        return { text: tailMath[1].trim(), marks: n, split: false };
      }
    }
    // A trailing "\quad <n>" inside the final display formula is the
    // row's marks figure ("$$... \quad 5$$", MATDSC152T Q16(b)/Q18(b)/
    // Q19(a)/Q19(b), batch 29). The figure is stripped from inside
    // the formula; the rest of the formula stays as question text.
    // Same guard rule as the lone-number branch.
    const quad = tailMath[2].match(
      /^([\s\S]*?)\\(?:quad|qquad)\s*([\d০-৯]+)\s*(\${1,2})$/,
    );
    if (quad) {
      const n = asciiNumber(quad[2]);
      if (
        n !== null &&
        n >= 1 &&
        n <= 100 &&
        (groupGuard === null || groupGuard === n)
      ) {
        const block = `${quad[1].trim()}${quad[3]}`;
        return {
          text: `${tailMath[1].trim()} ${block}`.trim(),
          marks: n,
          split: false,
        };
      }
    }
    // Same shape, split-sum form ("$$... \quad 1+5=6$$",
    // PHYDSC101T 2(a)/3(b), batch 33): the stated total is the
    // row's marks, split: true (a total composed of parts).
    const quadSum = tailMath[2].match(
      new RegExp(
        String.raw`^([\s\S]*?)\\(?:quad|qquad)\s*(${MARKS_TERM}(?:\s*${MARKS_OP}\s*${MARKS_TERM})+)\s*=\s*([\d০-৯]+)\s*(\${1,2})$`,
      ),
    );
    if (quadSum) {
      const derived = marksTotalFromParts(quadSum[2], quadSum[3]);
      if (
        derived !== null &&
        derived >= 1 &&
        derived <= 100 &&
        (groupGuard === null || groupGuard === derived)
      ) {
        const block = `${quadSum[1].trim()}${quadSum[4]}`;
        return {
          text: `${tailMath[1].trim()} ${block}`.trim(),
          marks: derived,
          split: true,
          splitExpr: quadSum[2],
        };
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
  // The total may be cut off ("1+4=", ECOSEC151T Q31/Q32, batch 25):
  // a trailing "=" with no digits still yields the partial sum.
  const bareExpr = text.match(
    new RegExp(
      String.raw`^(.*?)\s+\**(${MARKS_TERM}(?:\s*${MARKS_OP}\s*${MARKS_TERM})+)\s*(?:=\s*([\d০-৯]+)?)?\**\s*$`,
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
      return {
        text: bareExpr[1].trim(),
        marks: derived,
        split: true,
        splitExpr: bareExpr[2],
      };
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
      return { text: `${paren[1]}${paren[2]}`.trim(), marks: n, split: false };
    }
  }
  // A parenthesised split expression at the end is the row's marks —
  // "... (2+3=5)" (MATDSM251 Q4(b), after a $$...$$ block),
  // "... (2+8=10)" (direct questions), "... (1+1+2=4)" — the stated
  // total (or the sum, when no total is printed). A trailing ":" after
  // the ")" is a stray colon. The split shape is unambiguous — a
  // cross-reference is a single number, handled above — so no
  // punctuation is required before the "(".
  const splitParen = text.match(
    new RegExp(
      String.raw`^(.*?)\s*\((${MARKS_NUM}(?:\s*${MARKS_OP}\s*${MARKS_NUM})+)\s*(?:=\s*([\d০-৯]+)?)?\)\s*:?\s*$`,
    ),
  );
  if (splitParen) {
    // Groups: 1 = prefix, 2 = inner expression, 3 = stated total.
    const derived = marksTotalFromParts(splitParen[2], splitParen[3]);
    if (
      derived !== null &&
      derived >= 1 &&
      derived <= 100 &&
      (groupGuard === null || groupGuard === derived)
    ) {
      return {
        text: splitParen[1].trim(),
        marks: derived,
        split: true,
        splitExpr: splitParen[2],
      };
    }
  }
  // A bracketed split expression at the end is the row's marks —
  // "... [3+4=7]" (PHYDSC101T Q15). Same rule as the parenthesised
  // split above.
  const bracketSplit = text.match(
    new RegExp(
      String.raw`^(.*?)\s*\[(${MARKS_NUM}(?:\s*${MARKS_OP}\s*${MARKS_NUM})+)\s*(?:=\s*([\d০-৯]+)?)?\]\s*$`,
    ),
  );
  if (bracketSplit) {
    const derived = marksTotalFromParts(bracketSplit[2], bracketSplit[3]);
    if (
      derived !== null &&
      derived >= 1 &&
      derived <= 100 &&
      (groupGuard === null || groupGuard === derived)
    ) {
      return {
        text: bracketSplit[1].trim(),
        marks: derived,
        split: true,
        splitExpr: bracketSplit[2],
      };
    }
  }
  // A bracketed figure at the end is the row's marks — "... show that
  // [5] $$...$$" (MATDSC303T Q8(d), reached here by the tailMath
  // recursion above, which strips the trailing formula first),
  // "... by using $\Gamma$-function. [3]" (PHYDSC101T Q15(b)).
  const bracketSingle = text.match(/^(.*?)\s*\[([\d০-৯]+)\]\s*$/);
  if (bracketSingle) {
    const n = asciiNumber(bracketSingle[2]);
    if (
      n !== null &&
      n >= 1 &&
      n <= 100 &&
      (groupGuard === null || groupGuard === n)
    ) {
      return { text: bracketSingle[1].trim(), marks: n, split: false };
    }
  }
  // A marks figure standing before a display formula mid-text —
  // "Solve the total differential equation 5 $$Pdx + Qdy + Rdz = 0$$
  // given that ..." (MATDSM251 Q8(b)). The tailMath branch above only
  // covers a formula at the very end of the text. The figure must be
  // a standalone token: a number that is part of an equation ("= 5
  // $$", "+ 5 $$", "(5 $$") or of a longer number ("15 $$" read as
  // "5") is a value, not marks, so the character before it is
  // checked — a word or ":" may precede a marks figure, an operator
  // or a digit may not.
  const midFormulaRe = /(^|[\s:;,])([\d০-৯]+)\s+\$\$[^$]+\$\$/g;
  let midFormula: RegExpExecArray | null;
  while ((midFormula = midFormulaRe.exec(text)) !== null) {
    const beforeIdx = midFormula.index;
    const charBefore = beforeIdx > 0 ? text[beforeIdx - 1] : "";
    if (/[=+\-×x($\d০-৯,;]/.test(charBefore)) continue;
    const n = asciiNumber(midFormula[2]);
    if (n === null || n < 1 || n > 100) continue;
    if (groupGuard !== null && groupGuard !== n) continue;
    const numStart = beforeIdx + midFormula[1].length;
    const numEnd = numStart + midFormula[2].length;
    let after = numEnd;
    while (text[after] === " " || text[after] === "\t") after++;
    return {
      text: `${text.slice(0, numStart)}${text.slice(after)}`.trim(),
      marks: n,
      split: false,
    };
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
      return { text: `${colonQuote[1]}: ${colonQuote[3]}`.trim(), marks: n, split: false };
    }
  }
  // A bracketed marks figure after a colon, introducing the
  // question's items — "(a) Explain the following : [6] ‘...’"
  // (SANDSC152T Q19(a), batch 35), "(b) Translate into English :
  // [4] ...". Same rule as the bare-figure colon branches: the
  // colon stays, the figure goes, the items stay. Only when no
  // sub-question marker appears anywhere in the text — a merged
  // "(i) Solve : [3] ... (ii) ... [4] ..." row (MTMDSC202T (b),
  // batch 6) keeps its figures for the merged-sum logic, so any
  // roman marker, or a letter marker in the rest, blocks the branch.
  const colonBracket = text.match(/^(.*?):\s*\[([\d০-৯]+)\]\s+(\S.*)$/);
  if (colonBracket) {
    const rest = colonBracket[3];
    const hasSubMarker =
      /\((i|ii|iii|iv)\)/.test(text) ||
      /\([a-jকখগঘঙ]\)/.test(rest);
    if (!hasSubMarker) {
      const n = asciiNumber(colonBracket[2]);
      if (
        n !== null &&
        n >= 1 &&
        n <= 100 &&
        (groupGuard === null || groupGuard === n)
      ) {
        return {
          text: `${colonBracket[1]}: ${rest}`.trim(),
          marks: n,
          split: false,
        };
      }
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
        return { text: `${colonMid[1]}: ${rest}`.trim(), marks: derived, split: /[×x+]/.test(colonMid[2]) };
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
      return { text: footerMarks[1].trim(), marks: n, split: false };
    }
  }
  // A bare number at the end of the question is its marks — but only
  // when it is a plausible mark (<= 100) and agrees with the group's
  // per-part marks when those are known. A year or a number inside the question
  // never looks like this: it is followed by punctuation or is too big.
  // The number may carry *emphasis* ("**10**") or be Bengali digits.
  // A trailing "*" bullet artifact may follow the figure with a space
  // ("... : 10 *", ECODSM101T Q4, batch 25).
  const m = text.match(/^(.*?)\s+\**([\d০-৯]+)[\s*]*$/);
  if (!m) return { text, marks: null, split: false };
  const n = asciiNumber(m[2]);
  if (n === null || n < 1 || n > 100) return { text, marks: null, split: false };
  if (groupGuard !== null && groupGuard !== n) return { text, marks: null, split: false };
  return { text: m[1].trim(), marks: n, split: false };
}

/**
 * The pair total T for a paper: the common sum of every complete pair
 * (both parts marked) across the paper's "Answer either" questions.
 * T exists only when at least two complete pairs agree — a single
 * pair cannot prove the paper's pair total (MATDSC303T, batch 24:
 * six complete pairs, all 10).
 */
function pairEitherTotal(rows: QuestionRow[]): number | null {
  const sums: number[] = [];
  for (const p of rows) {
    if (p.group !== "Answer either" || p.label.includes("(")) continue;
    const q = p.label;
    const parts = new Map<string, number | null>();
    for (const r of rows) {
      if (r.label.startsWith(`${q}(`)) {
        parts.set(r.label.slice(q.length + 1, -1), r.marks);
      }
    }
    for (const [a, b] of [
      ["a", "b"],
      ["c", "d"],
    ] as const) {
      const x = parts.get(a);
      const y = parts.get(b);
      if (x != null && y != null) sums.push(x + y);
    }
  }
  if (sums.length < 2) return null;
  const t = sums[0];
  return sums.every((s) => s === t) ? t : null;
}

/**
 * Fill a pair-either part that is blank when its pair's other part is
 * marked and the paper's pair total T is established: blank = T -
 * marked (MATDSC303T Q2(b) = 10 - 5 = 5). A pair with both parts
 * blank stays blank — the split is unknown.
 */
function fillPairTotalParts(rows: QuestionRow[], t: number): void {
  for (const p of rows) {
    if (p.group !== "Answer either" || p.label.includes("(")) continue;
    const q = p.label;
    const byLetter = new Map<string, QuestionRow>();
    for (const r of rows) {
      if (r.label.startsWith(`${q}(`)) {
        byLetter.set(r.label.slice(q.length + 1, -1), r);
      }
    }
    for (const [a, b] of [
      ["a", "b"],
      ["c", "d"],
    ] as const) {
      const ra = byLetter.get(a);
      const rb = byLetter.get(b);
      if (!ra || !rb) continue;
      if (ra.marks === null && rb.marks !== null) {
        const v = t - rb.marks;
        if (v >= 1 && v <= 100) ra.marks = v;
      } else if (rb.marks === null && ra.marks !== null) {
        const v = t - ra.marks;
        if (v >= 1 && v <= 100) rb.marks = v;
      }
    }
  }
}

/**
 * Fill a blank pair-either parent row from the paper's pair total T —
 * but only when T is established (pairEitherTotal) and the question's
 * own complete pairs agree with it (or it has none). A parent is
 * never filled from a single pair's sum: MTMDSM301 Q2's pairs are
 * (blank+6) and (4+5), so its total is genuinely unknown and the
 * parent stays blank, while MATDSC303T Q6 (no pair complete) takes
 * T = 10. The counted total does not change when the parent equals
 * the max pair sum — the counter takes the parent alone instead.
 */
function fillEitherParentMarks(
  rows: QuestionRow[],
  t: number | null,
): void {
  if (t === null) return;
  for (const p of rows) {
    if (p.group !== "Answer either" || p.label.includes("(")) continue;
    if (p.marks !== null) continue;
    const q = p.label;
    const parts = new Map<string, number | null>();
    for (const r of rows) {
      if (r.label.startsWith(`${q}(`)) {
        parts.set(r.label.slice(q.length + 1, -1), r.marks);
      }
    }
    let agrees = true;
    for (const [a, b] of [
      ["a", "b"],
      ["c", "d"],
    ] as const) {
      const x = parts.get(a);
      const y = parts.get(b);
      if (x != null && y != null && x + y !== t) agrees = false;
    }
    if (agrees) p.marks = t;
  }
}

/**
 * Positional per-part marks for "Answer any" questions whose figures
 * the paper never prints (VAC/EESVAC papers, batch 24: the margin
 * figures are blank). Each unit repeats the same 3-question shape, so
 * a question's position among its unit's "Answer any" instructions
 * determines its per-part value — but only when the paper itself
 * proves it: at least two questions at that position (same group
 * wording) in other units carry the same value on every part, with no
 * disagreement. A single witness is accepted only when every other
 * position in the paper is already established that way (NCC/NSS:
 * position 3 is witnessed once, by Q9 = 5, while positions 1 and 2
 * are witnessed 5 and 3 times). Only questions whose parts are ALL
 * blank are filled; a partly marked question is left alone.
 */
function fillPositionalMarks(rows: QuestionRow[]): void {
  const byQ = new Map<
    string,
    { unit: string; group: string; parts: QuestionRow[] }
  >();
  for (const r of rows) {
    if (!r.group.startsWith("Answer any ") || !r.label.includes("(")) continue;
    if (!r.unit) continue;
    const q = r.label.split("(")[0];
    const key = `${r.unit}|${q}`;
    let e = byQ.get(key);
    if (!e) {
      e = { unit: r.unit, group: r.group, parts: [] };
      byQ.set(key, e);
    }
    e.parts.push(r);
  }
  // Position of each question among its unit's "Answer any" questions.
  const byUnit = new Map<string, string[]>();
  for (const [key, e] of byQ) {
    const list = byUnit.get(e.unit) ?? [];
    list.push(key);
    byUnit.set(e.unit, list);
  }
  const posOf = new Map<string, number>();
  for (const list of byUnit.values()) {
    list.sort((a, b) => {
      const qa = parseInt(a.split("|")[1], 10);
      const qb = parseInt(b.split("|")[1], 10);
      return qa - qb;
    });
    list.forEach((key, i) => posOf.set(key, i + 1));
  }
  // Witnesses per (position, group): values from questions whose parts
  // are all marked with one common value.
  const witnesses = new Map<string, number[]>();
  for (const [key, e] of byQ) {
    const pos = posOf.get(key);
    if (pos === undefined || e.parts.length === 0) continue;
    if (!e.parts.every((p) => p.marks !== null)) continue;
    const v = e.parts[0].marks as number;
    if (!e.parts.every((p) => p.marks === v)) continue;
    const wkey = `${pos}|${e.group}`;
    const arr = witnesses.get(wkey) ?? [];
    arr.push(v);
    witnesses.set(wkey, arr);
  }
  // Established positions: at least two agreeing witnesses.
  const established = new Map<string, number>();
  for (const [key, vals] of witnesses) {
    if (vals.length >= 2 && vals.every((v) => v === vals[0])) {
      established.set(key, vals[0]);
    }
  }
  const positions = new Set(
    [...witnesses.keys()].map((k) => k.split("|")[0]),
  );
  const valueFor = (key: string): number | null => {
    const vals = witnesses.get(key);
    if (!vals) return null;
    if (established.has(key)) return established.get(key) as number;
    if (vals.length === 1) {
      // One witness: accept it only when every other position in the
      // paper is established — the paper's positional pattern is then
      // fully proven except for this one slot.
      const pos = key.split("|")[0];
      const others = [...positions].filter((p) => p !== pos);
      if (
        others.length >= 2 &&
        others.every((p) =>
          [...established.keys()].some((k) => k.startsWith(`${p}|`)),
        )
      ) {
        return vals[0];
      }
    }
    return null;
  };
  for (const [key, e] of byQ) {
    const pos = posOf.get(key);
    if (pos === undefined) continue;
    if (!e.parts.every((p) => p.marks === null)) continue;
    const v = valueFor(`${pos}|${e.group}`);
    if (v === null) continue;
    for (const p of e.parts) p.marks = v;
  }
}

/**
 * Fill blank sub-rows from a marks-carrying parent row when the
 * parent's marks are the whole question's marks (batch 27, G14):
 * ENGSEC101T Q18 "Change the mode of narration : 2" with (a)–(d)
 * and no per-part figures — the 2 is the whole question, so each
 * part displays it. Only parents in `wholeQuestionParents` qualify:
 * their marks came from a single figure on the question's own line.
 * A parent whose marks came from a split total ("1+3+3+3=10",
 * PHYDSM101T Q8 — its parts are 3+3+3, not 10 each) or a standalone
 * marks line is never in the set. An instruction row ("Answer
 * either (a) or (b) : 10", ECODSM101T Q4) is the question total with
 * pair-split parts and is excluded too, and a partly marked question
 * is left alone. The counter counts such a question once (see
 * assemble.py counted_total: all sub-rows equal to the parent means
 * the parent alone), so the filled cells never change the total.
 */
function fillWholeQuestionParentParts(
  rows: QuestionRow[],
  wholeQuestionParents: Set<string>,
): void {
  for (const p of rows) {
    if (p.label.includes("(") || p.marks === null) continue;
    if (!wholeQuestionParents.has(p.label)) continue;
    if (p.group === "Answer either") continue;
    if (/^Answer\s/i.test(p.question.replace(/^[\s$*#]+/, ""))) continue;
    // A split printed in the parent's own text ("Write short notes
    // on the following (3+4+3=10) : 10", COMDSM-101T Q19) gives the
    // parts their own values (3, 4, 3) — the total must never be
    // copied onto them. Only a parent with no split expression in
    // its text qualifies.
    if (/[\d০-৯]+\s*(?:\+|\\times|[×x])\s*[\d০-৯]/.test(p.question)) continue;
    const parts = rows.filter((r) => r.label.startsWith(`${p.label}(`));
    if (parts.length === 0) continue;
    if (!parts.every((r) => r.marks === null)) continue;
    for (const r of parts) r.marks = p.marks;
  }
}

// The marks each part of a split-sum parent takes, in sub-row
// order — or null when the expression cannot be assigned safely.
// A sum "a+b+..." assigns its terms in order when the term count
// matches the sub-row count ("$5+5=10$" with (a)/(b) means 5 each;
// "1+3+3+3" with 3 sub-rows matches nothing, so PHYDSM101T Q8's
// printed 3,3,3 stay). A product "a×b" means b parts of a marks
// each, or a parts of b marks each ("5×2" with (a)/(b) means 5
// each). Anything else (a lone term, a mismatch, a product that
// matches neither way) is left alone — a wrong guess would corrupt
// the table more than a blank.
function splitTermsForParts(expr: string, subCount: number): number[] | null {
  // Normalise the LaTeX product operator first: the raw expression
  // may read "5 \\times 2" (a backslash word, no "x" or "×" in it),
  // and the sum branch below must not fire vacuously on an
  // operator-less match (an empty ops list passes every()).
  const norm = expr.replace(/\\times/g, "×");
  const terms = norm.match(/[\d০-৯]+/g) ?? [];
  const nums = terms.map((t) => asciiNumber(t));
  if (nums.some((n) => n === null) || nums.length < 2) return null;
  const values = nums as number[];
  const ops = norm.match(/[+×x]/g) ?? [];
  if (
    ops.length === values.length - 1 &&
    ops.every((op) => op === "+") &&
    values.length === subCount
  ) {
    return values;
  }
  if (
    ops.length === 1 &&
    (ops[0] === "×" || ops[0] === "x") &&
    values.length === 2
  ) {
    const [a, b] = values;
    if (b === subCount) return Array.from({ length: subCount }, () => a);
    if (a === subCount) return Array.from({ length: subCount }, () => b);
  }
  return null;
}

// A split-sum parent's sub-rows take the expression's terms
// (batch 36, G28): "$5+5=10$" (ZOODSC151T Q19/Q25, ZOODSC201
// Q6/Q12/Q15, ZOODSC202T Q6/Q9) with (a)/(b) means 5 each — not
// the full 10, which the G14 fill used to copy. A parent whose
// marks came from anywhere else (the section rule, a standalone
// marks line) has no expression recorded: its sub-rows stay BLANK,
// not a share of the total (ZOODSC151T Q21 prints no figure; its
// 10 is section-rule-derived). The same guard applies to a split
// parent whose expression cannot be assigned (a term count that
// matches nothing): a part that already prints a figure keeps it,
// and one printed figure disagreeing with its term blocks the
// whole assignment — a conflict is evidence the split does not
// map to the parts, not a typo to override. A value a part took
// only from the group fallback is provisional, not printed: it is
// overwritten by the term, never a conflict (ZOODSC151T Q19(a)/(b)
// read 10 from the section rule, and take 5 each from "$5+5=10$").
function fillSplitParentParts(
  rows: QuestionRow[],
  splitParentExpr: Map<QuestionRow, string>,
  groupMarksFallback: Map<QuestionRow, number>,
  wholeQuestionParents: Set<string>,
): void {
  // An instruction row ("Answer the following : 2×2=4",
  // PLSDSC101T Q10) is not a question: its parts' marks are the
  // section rule's business, never a split fill's — the G14 fill
  // skips Answer parents the same way, and Q10(a)/(b) stay blank.
  const isInstruction = (r: QuestionRow): boolean =>
    /^Answer\s/i.test(r.question.replace(/^[\s$*#]+/, ""));
  for (const [parent, expr] of splitParentExpr) {
    if (isInstruction(parent)) continue;
    const subs = rows.filter(
      (r) =>
        r.label.startsWith(parent.label + "(") && subLetter(r.label) !== null,
    );
    if (subs.length === 0) continue;
    const terms = splitTermsForParts(expr, subs.length);
    if (terms === null) continue;
    // Only a PRINTED figure can disagree with its term: a value
    // taken from the group fallback (ZOODSC151T Q19(a)/(b) read 10
    // from the section rule, not from the paper) is provisional and
    // is overwritten by the term, never a conflict.
    if (
      subs.some(
        (r, i) =>
          r.marks !== null &&
          !groupMarksFallback.has(r) &&
          r.marks !== terms[i],
      )
    ) {
      continue;
    }
    subs.forEach((r, i) => {
      if (r.marks === null || groupMarksFallback.has(r)) r.marks = terms[i];
    });
  }
  // A parent with no split expression and no single-figure whole
  // (not in wholeQuestionParents) is section-rule-derived: any
  // sub-row whose marks came only from the group fallback was never
  // printed, so it goes back to blank (ZOODSC151T Q21(a)/(b):
  // 10 → blank). Only when the sub-rows start at (a) — the parent
  // is an instruction, not a part: when there is no (a) sub-row
  // the direct row IS part (a) (MATDSC151T Q25: "25. First part."
  // with (b)/(c) only), and the parts keep the section fallback
  // 10, exactly as before. Never overwrite a printed figure.
  for (const parent of rows) {
    if (parent.label.includes("(")) continue;
    if (
      splitParentExpr.has(parent) ||
      wholeQuestionParents.has(parent.label) ||
      parent.marks === null ||
      isInstruction(parent)
    ) {
      continue;
    }
    const subs = rows.filter(
      (r) =>
        r.label.startsWith(parent.label + "(") &&
        subLetter(r.label) !== null,
    );
    if (!subs.some((r) => subLetter(r.label) === "a")) continue;
    for (const sub of subs) {
      if (groupMarksFallback.has(sub)) sub.marks = null;
    }
  }
}

/**
 * Fill a blank OR alternative from its OR partner (batch 28, G17):
 * HISIDC201T/HISSEC201T/ENGDSC202T print the marks figure on the
 * first of each OR pair only ("2. ... [2] / OR / 3. ..." — Q3 prints
 * no figure), so the (b) rows stay blank while the counter is right
 * (or_pairs subtracts the min, so the total never depended on them).
 * Direct rows whose group is exactly "OR" pair up in order within
 * each maximal run of consecutive direct OR rows: (1st, 2nd),
 * (3rd, 4th), ... A blank member takes its marked partner's figure;
 * a pair with both blank, or both marked (even disagreeing), is left
 * alone. Sub-row OR pairs are already filled at push time (same
 * question number), and an odd run leaves its last row unpaired —
 * the safe blank. Only group exactly "OR" qualifies: a direct row
 * under an "Answer any" group that also carries "(OR)" is a section
 * question, not a plain alternative, and is left alone. A direct
 * row WITH sub-rows is never filled: the counter sums parent +
 * parts unless every part equals the parent (the G14 guard), so
 * filling such a parent double-counts — BOTIDC101T Q20 (parent
 * blank, part (b) 8) would read 70/70 as 78/70. Its marks live on
 * the parts, and the cell stays blank as before.
 *
 * A run is consecutive in the FULL table, not among direct rows
 * only (batch 34, G25): an "Answer any 3" question exists only as
 * sub-rows, so it never appears as a direct row — but it still
 * breaks the run. PHYSEC201T's OR pairs are (Q2,Q3), (Q7,Q8),
 * (Q9,Q10), (Q12,Q13), ...; the old direct-only scan put Q5, Q7,
 * Q8, Q9, Q10, ... in one giant run and paired (Q5,Q7),
 * (Q8,Q9), (Q10,Q12), so Q8 took Q9's 5 and Q10 took Q12's 2
 * (62/50). Any row that is not a direct OR row — a sub-row, an
 * "Answer any" row, a direct row with sub-rows — flushes the run.
 */
function fillOrPartnerMarks(rows: QuestionRow[]): void {
  const hasSubRows = new Set<string>();
  for (const r of rows) {
    if (r.label.includes("(")) hasSubRows.add(r.label.split("(")[0]);
  }
  let run: QuestionRow[] = [];
  const flush = (): void => {
    for (let i = 0; i + 1 < run.length; i += 2) {
      const a = run[i];
      const b = run[i + 1];
      if (a.marks === null && b.marks !== null) a.marks = b.marks;
      else if (b.marks === null && a.marks !== null) b.marks = a.marks;
    }
    run = [];
  };
  // Scan the FULL table: a sub-row (or any other row) between two
  // direct OR rows breaks the run, even though it is not itself a
  // direct row (batch 34, G25 — see the doc comment above).
  for (const r of rows) {
    if (
      !r.label.includes("(") &&
      r.group === "OR" &&
      !hasSubRows.has(r.label)
    ) {
      run.push(r);
    } else {
      flush();
    }
  }
  flush();
}

/**
 * A paper misprint can print the same question number twice
 * (HISSEC201T prints Q23 twice — "On which ocassion..." and "Give
 * a pen picture of Ellora Caves" — and no Q24, then Q25). Two rows
 * with the same label break ID uniqueness and merge in the counter's
 * per-question grouping, so the second occurrence takes a suffixed
 * label ("23b") and ID, and its sub-rows take the suffix too
 * ("23b(a)"). The transcript is untouched — the paper really does
 * print 23 twice — and the suffix is visible in the table. Only
 * direct rows are counted: sub-rows share their parent's number and
 * never collide on their own.
 */
function renameDuplicateNumbers(
  rows: QuestionRow[],
  paperCode: string,
): void {
  const seen = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.label.includes("(")) continue;
    const base = r.label;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    if (n === 1) continue;
    if (n > 26) continue; // absurd for a paper; leave the duplicate
    const suffix = String.fromCharCode(96 + n);
    const newLabel = `${base}${suffix}`;
    r.label = newLabel;
    r.id = `${paperCode}-Q${newLabel}`;
    for (let j = i + 1; j < rows.length; j++) {
      const s = rows[j];
      if (!s.label.includes("(")) break;
      if (s.label.split("(")[0] !== base) break;
      const letter = s.label.slice(base.length + 1, -1);
      s.label = `${newLabel}(${letter})`;
      s.id = `${paperCode}-Q${newLabel}${letter}`;
    }
  }

  // Sub-row duplicates: a repeated FULL sub-row label ("6(b)" twice,
  // COMDSC-353T — the paper prints (b) twice and no (a)). The second
  // occurrence takes a numeric suffix inside the parens ("6(b2)",
  // ID "...-Q6b2"). Same principle as the direct rows: the transcript
  // keeps the printed label, the table keeps unique IDs.
  const seenSub = new Map<string, number>();
  for (const r of rows) {
    if (!r.label.includes("(")) continue;
    const n = (seenSub.get(r.label) ?? 0) + 1;
    seenSub.set(r.label, n);
    if (n === 1) continue;
    const base = r.label.split("(")[0];
    const letter = r.label.slice(base.length + 1, -1);
    r.label = `${base}(${letter}${n})`;
    r.id = `${paperCode}-Q${base}${letter}${n}`;
  }
}

/**
 * Marks a row contributes to the counted total: its own marks, else
 * a split-marks total at the end of its text — a line-for-line port
 * of assemble.py row_marks_for_count (the pipeline counter), so the
 * remainder fill below agrees with the counter it feeds. Python's
 * \d matches Bengali digits too, so the digit classes here include
 * ০-৯ and every captured figure is folded with asciiDigits first.
 */
function rowMarksForCount(r: QuestionRow): number | null {
  if (r.marks !== null) return r.marks;
  const q = r.question.trim();
  const d = "[\\d০-৯]";
  const op = "(?:\\+|\\\\times|x)";
  let m = q.match(
    new RegExp(
      `[\\$\\[]?(${d}+(?:\\s*${op}\\s*${d}+)+)\\s*(?:=\\s*(${d}+))?[\\$\\]]{0,2}\\s*$`,
    ),
  );
  if (m) {
    if (m[2]) return asciiNumber(m[2]);
    const terms = m[1].match(/[\d০-৯]+/g) ?? [];
    const vals = terms.map((t) => asciiNumber(t) as number);
    return vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) : null;
  }
  m = q.match(/\[([\d০-৯]+)\]\s*$/);
  if (m) return asciiNumber(m[1]);
  const vals: number[] = [];
  for (const ln of q.split("\n")) {
    const t = ln.trim();
    if (!t) continue;
    const m2 = t.match(
      new RegExp(`(${d}+(?:\\s*${op}\\s*${d}+)+)\\s*(?:=\\s*(${d}+))?\\s*$`),
    );
    if (m2) {
      if (m2[2]) vals.push(asciiNumber(m2[2]) as number);
      else {
        const terms = m2[1].match(/[\d০-৯]+/g) ?? [];
        vals.push(
          terms
            .map((x) => asciiNumber(x) as number)
            .reduce((a, b) => a + b, 0),
        );
      }
      continue;
    }
    const m3 = t.match(/\b([\d০-৯]+)\s*$/);
    if (m3) vals.push(asciiNumber(m3[1]) as number);
  }
  if (vals.length >= 2) return vals.reduce((a, b) => a + b, 0);
  const m4 = q.match(/(?<![\d০-৯])([\d০-৯]{1,2})\s*$/);
  if (m4) {
    const v = asciiNumber(m4[1]) as number;
    if (v <= 20) return v;
  }
  return null;
}

/**
 * Alternative question pairs joined by a standalone OR line — a
 * line-for-line port of assemble.py or_pairs, so the remainder fill
 * below subtracts exactly what the pipeline counter subtracts. The
 * numbered lines may start with a sub-part marker ('2. (a) ...') —
 * the pair counts when the two question numbers differ. A question
 * number on a line by itself ('4.' — the question's text follows as
 * sub-part lines, MATSEC101T Q4/Q5/Q10) counts as a numbered line
 * too. The OR marker may also be display maths ('$$\\text{OR}$$'):
 * on its own line it is a standalone OR; trailing on a question line
 * ('12. ... [2] $$\\text{OR}$$' — the pipeline reflow joins it
 * there, MATSEC101T Q12/Q13, Q14/Q15, Q17/Q18, Q19/Q20) the pair is
 * that line's own question and the next one. Duplicate question
 * numbers (G15) are disambiguated by occurrence: the second "23."
 * line is key "23b", matching the renamed row labels.
 */
function orPairs(lines: string[]): Array<[string, string]> {
  const numbered = /^([\d০-৯]+)\.(?:\s+|$)/;
  const stripWrap = (l: string): string =>
    l
      .replace(/<[^>]+>/g, "")
      .trim()
      .replace(/^[#*]+/, "")
      .replace(/[#*]+$/, "")
      .trim();
  const isOr = (l: string): boolean => {
    const bare = stripWrap(l)
      .replace(/\$\$/g, "")
      .replace(/\\text\{/g, "")
      .replace(/\}/g, "")
      .trim();
    // Case-insensitive (batch 34, G26): the mixed-case display
    // form "$$\text{Or}$$" (PLSDSC102T Q8/Q10) is an OR marker
    // exactly like "$$\text{OR}$$".
    return bare.toUpperCase() === "OR";
  };
  const isTrailingOr = (l: string): boolean => {
    const s = stripWrap(l);
    const m = s.match(/\$\$(?:\\text\{)?(OR|অথবা)(?:\})?\$\$\s*$/i);
    if (m !== null) return s.slice(0, m.index).trim().length > 0;
    // A trailing HTML-wrapped OR marker ("... $3+7=10$
    // <div align=\"center\">OR</div>", ZOODSM101T Q2, batch 36,
    // G27): stripWrap removes the tags, leaving a bare trailing
    // "OR" on the question's own line. Case-sensitive, like the
    // display parser's bare-OR branch — a trailing lowercase "or"
    // is ordinary text, not a marker.
    const b = s.match(/(?:^|\s)(OR|অথবা)\s*$/);
    return b !== null && s.slice(0, b.index).trim().length > 0;
  };
  // Occurrence-suffixed key of each numbered line, in scan order.
  const keyOfLine = new Map<number, string>();
  {
    const seen = new Map<string, number>();
    lines.forEach((l, idx) => {
      const m = l.trim().match(numbered);
      if (!m) return;
      const base = m[1];
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      keyOfLine.set(
        idx,
        n === 1 ? base : `${base}${String.fromCharCode(96 + n)}`,
      );
    });
  }
  const nextContent = (ls: string[]): string | null => {
    for (const l of ls) {
      const s = l.trim();
      if (!s || s.startsWith("<!--")) continue;
      return s;
    }
    return null;
  };
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < lines.length; i++) {
    const trailing = isTrailingOr(lines[i]);
    if (!trailing && !isOr(lines[i])) continue;
    let above: string | null = null;
    if (trailing) {
      // The marker trails the question's own line ("12. ...
      // [2] $$\\text{OR}$$") — or a sub-part line of it ("(b) ...
      // [3] $$\\text{OR}$$", MATSEC101T Q14/Q15), in which case
      // the question is the closest numbered line above.
      above = keyOfLine.get(i) ?? null;
      if (!above) {
        for (let j = i - 1; j >= 0; j--) {
          const k = keyOfLine.get(j);
          if (k !== undefined) {
            above = k;
            break;
          }
        }
      }
    } else {
      for (let j = i - 1; j >= 0; j--) {
        const k = keyOfLine.get(j);
        if (k !== undefined) {
          above = k;
          break;
        }
      }
    }
    let below: string | null = null;
    for (let j = i + 1; j < lines.length; j++) {
      const k = keyOfLine.get(j);
      if (k !== undefined) {
        below = k;
        break;
      }
    }
    const next = nextContent(lines.slice(i + 1));
    if (next && /^\([a-zA-Z\u0985-\u09b9]\)/.test(next)) continue;
    if (next && !numbered.test(next.trim())) continue;
    if (above && below && above !== below) pairs.push([above, below]);
  }
  return pairs;
}

/** Sub-part letter of a row label ("40(b)" -> "b"; "40" -> null). */
function subLetter(label: string): string | null {
  if (!label.includes("(")) return null;
  return label.split("(").pop()?.replace(/\)$/, "") ?? null;
}

/**
 * One question's total marks, for a section-level "Answer any N" set
 * (batch 30, G19/G19b) — the TS port of assemble.py question_value.
 * A question's marks live either on its direct row alone or split
 * across its parts, depending on the shape of its rows:
 * - Sub-rows starting at (a) mean the direct row is a parent /
 *   instruction carrying the whole question ("Write the structure
 *   and function of the following : 10", BOTDSC151T Q19, whose
 *   (a)/(b) copy the 10 by the G14 fill; "Change the mode of
 *   narration : 2", ENGSEC101T Q18). Its value is the direct row's
 *   figure, or the sum of its parts when the direct row is blank.
 * - No (a) sub-row means the direct row IS part (a): its text is
 *   (a)'s text and its figure is (a)'s figure (MATIDC151T Q40:
 *   "Show that ... 4" + "(b) ... 4" = 8; PHYDSC101T Q15: 7+3=10).
 *   Its value is the direct figure plus its sub-rows'.
 * strict=true (uniformity test): a question counts as a witness
 * only when every component is known — a partly blank question
 * neither proves nor breaks uniformity. strict=false (largest-N
 * ranking): blank components count 0, a lower bound; only an
 * all-blank question is unknown (null).
 */
function questionValue(qrows: QuestionRow[], strict: boolean): number | null {
  if (qrows.length === 0) return null;
  const qnum = qrows[0].label.split("(")[0];
  const direct = qrows.find((r) => r.label === qnum) ?? null;
  const subs = qrows.filter((r) => r.label !== qnum);
  if (direct && subs.some((r) => subLetter(r.label) === "a")) {
    const v = rowMarksForCount(direct);
    if (v !== null) return v;
    const vals = subs.map((r) => rowMarksForCount(r));
    if (vals.length > 0 && vals.every((x) => x !== null)) {
      return (vals as number[]).reduce((a, b) => a + b, 0);
    }
    return null;
  }
  const comps = [...(direct ? [direct] : []), ...subs];
  const vals = comps.map((r) => rowMarksForCount(r));
  if (vals.every((v) => v === null)) return null;
  if (strict && vals.some((v) => v === null)) return null;
  return vals
    .filter((v): v is number => v !== null)
    .reduce((a, b) => a + b, 0);
}

/**
 * True when some — but not all — of the components that make up a
 * question's total are known. An all-blank question is false
 * (batch-29 G18d: it neither proves nor breaks uniformity); a partly
 * blank one breaks it — its total is not proven equal to the rest.
 * Mirrors questionValue's shape logic: a parent-shaped question's
 * total is its direct row alone, so blank sub-rows do not make it
 * partial.
 */
function questionPartiallyKnown(qrows: QuestionRow[]): boolean {
  if (qrows.length === 0) return false;
  const qnum = qrows[0].label.split("(")[0];
  const direct = qrows.find((r) => r.label === qnum) ?? null;
  const subs = qrows.filter((r) => r.label !== qnum);
  let vals: Array<number | null>;
  if (direct && subs.some((r) => subLetter(r.label) === "a")) {
    if (rowMarksForCount(direct) !== null) return false;
    vals = subs.map((r) => rowMarksForCount(r));
  } else {
    const comps = [...(direct ? [direct] : []), ...subs];
    vals = comps.map((r) => rowMarksForCount(r));
  }
  return vals.some((v) => v !== null) && vals.some((v) => v === null);
}

function instructionOnQuestionLine(
  qnum: string,
  lines: string[],
): boolean | null {
  // True if the question's own numbered line carries an "Answer any"
  // instruction (per-question choice: the choice is among the
  // question's own parts); false if the question line has no such
  // instruction (the choice is governed by a standalone instruction
  // line, i.e. section-level); null if the question's line is not
  // found. CHMDSM151 ("2. Answer any one of the following
  // questions: 10") vs MATDSC202T (standalone "Answer any one of
  // the following : 10" above "2. (a) ..."): the two papers are
  // identical at row level, only the instruction's placement differs.
  const escaped = qnum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pat = new RegExp(`^\\s*${escaped}\\.(?:\\s|$)`);
  for (const ln of lines) {
    if (pat.test(ln)) return ln.toLowerCase().includes("answer any");
  }
  return null;
}

function splitTotalOnQuestionLine(
  qnum: string,
  lines: string[],
  directMarks: number,
  subMarks: Array<number | null>,
): boolean {
  // True when the question's own numbered line states its total as a
  // sum of parts (batch-30 G21): PHYDSM101T Q8's line reads
  // "... : 1+3+3+3=10" — the direct row's 10 IS the question total
  // (1 for the definition + 3 each for (a)/(b)/(c)), so the parts
  // must not be added on top (19/70). An identity counts only when
  // its terms sum to its total, the total equals the direct figure,
  // and every sub-row's marks appears among the terms, the leftover
  // terms summing to direct minus the parts. It fires ONLY for a
  // parent-shaped question (sub-rows starting at (a)): PHYDSC101T
  // Q15's "[3+4=7]" is part (a)'s own composition — its direct row
  // IS part (a) (7) and (b) adds 3 (7+3=10) — so a no-(a) question
  // never fires here. A question line that merely contains maths
  // (e.g. "$x^2+2x+1=0$") has no all-integer identity and never
  // fires. The caller checks the parent shape.
  const escaped = qnum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pat = new RegExp(`^\\s*${escaped}\\.(?:\\s|$)`);
  for (const ln of lines) {
    if (!pat.test(ln)) continue;
    const re = /(\d+(?:\s*\+\s*\d+)+)\s*=\s*(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ln)) !== null) {
      const terms = m[1].split(/\s*\+\s*/).map((x) => parseInt(x, 10));
      const total = parseInt(m[2], 10);
      if (total !== directMarks) continue;
      if (terms.reduce((a, b) => a + b, 0) !== total) continue;
      const rest = [...terms];
      let covered = true;
      for (const sm of subMarks) {
        if (sm === null) {
          covered = false;
          break;
        }
        const i = rest.indexOf(sm);
        if (i < 0) {
          covered = false;
          break;
        }
        rest.splice(i, 1);
      }
      const subSum = subMarks.reduce<number>((a, v) => a + (v ?? 0), 0);
      if (
        covered &&
        rest.reduce((a, b) => a + b, 0) === directMarks - subSum
      ) {
        return true;
      }
    }
    // Same shape, product form ("5×2=10", "$5 \\times 2=10$",
    // ZOODSC201 Q6/Q12/Q15, batch 36, G28): the product states
    // how the total splits — b parts of a marks each (or a parts
    // of b). It fires only when the total equals the direct
    // figure, the product equals the total, and every sub-row's
    // marks equals the per-part value for the sub-row count.
    const prodRe = /(\d+)\s*(?:×|x|\\times)\s*(\d+)\s*=\s*(\d+)/g;
    let pm: RegExpExecArray | null;
    while ((pm = prodRe.exec(ln)) !== null) {
      const a = parseInt(pm[1], 10);
      const b = parseInt(pm[2], 10);
      const total = parseInt(pm[3], 10);
      if (total !== directMarks || a * b !== total) continue;
      const perPart =
        subMarks.length === b ? a : subMarks.length === a ? b : null;
      if (perPart !== null && subMarks.every((sm) => sm === perPart)) {
        return true;
      }
    }
    return false;
  }
  return false;
}

/**
 * The SECTION each question number sits under, from the transcript
 * lines (batch 37, G31/G32): a SECTION/বিভাগ heading opens a
 * section, and so does a section-level instruction with no heading
 * before it (BNGSEC101T: sections split on an instruction line +
 * UNIT—I restart). A section instruction right after the SECTION
 * heading that just opened its section belongs to that section,
 * not a new one. Questions before any section map to "" and keep
 * the old (group, unit) pool keying.
 */
function sectionOfQuestions(lines: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let section = "";
  let justOpened = false;
  let counter = 0;
  const openSection = (): void => {
    if (!justOpened) {
      counter += 1;
      section = `§${counter}`;
    }
    justOpened = false;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(UNIT_HEADING);
    if (h) {
      if (h[1] === "SECTION" || h[3] !== undefined) {
        section = h[2] ?? h[3] ?? "";
        justOpened = true;
      }
      continue;
    }
    // A section instruction appended to a numbered question's line
    // (G32 join): the question closes the old section, the
    // instruction opens the next one.
    const app = splitAppendedSectionInstruction(line);
    if (app) {
      const n = line.match(/^([\d০-৯]+)[।.]\s+/);
      if (n) {
        const qn = asciiNumber(n[1]);
        if (qn !== null) map.set(String(qn), section);
      }
      openSection();
      continue;
    }
    // A standalone section instruction line.
    if (
      matchInstruction(line) !== null &&
      SECTION_LEVEL_SHAPE.test(foldBnYy(line))
    ) {
      openSection();
      continue;
    }
    const n = line.match(/^([\d০-৯]+)[।.]\s+/);
    if (n) {
      const qn = asciiNumber(n[1]);
      if (qn !== null) map.set(String(qn), section);
      justOpened = false;
    }
  }
  return map;
}

/**
 * The counted total WITHOUT the remainder rule — a line-for-line
 * port of assemble.py counted_total (section sets, per-question
 * rules, OR-pair subtraction), used only by the remainder fill
 * below. It must agree with the pipeline counter: the full-corpus
 * diff (Python counted_total before vs after a refresh) is the
 * check that any fill it justifies is total-neutral.
 */
export function countedTotalExcludingRemainder(
  rows: QuestionRow[],
  lines: string[],
): number {
  const byQnum = new Map<string, QuestionRow[]>();
  for (const r of rows) {
    const q = r.label.split("(")[0];
    const arr = byQnum.get(q) ?? [];
    arr.push(r);
    byQnum.set(q, arr);
  }
  let sectionTotal = 0;
  const sectionQnums = new Set<string>();
  const sections = sectionOfQuestions(lines);
  const bySection = new Map<string, QuestionRow[]>();
  for (const r of rows) {
    const g = r.group || "";
    if (g.startsWith("Answer any ")) {
      // Pool by section, not by unit (batch 37, G31): one "Answer
      // any 5" instruction spans all five units of BOTDSC101T
      // Section B, and pooling by unit counted 5 x 10 once per
      // unit (100/70). Questions with no section keep the old
      // (group, unit) key.
      const qnum = r.label.split("(")[0];
      const sec = sections.get(qnum);
      const key = `${g}|${sec !== undefined && sec !== "" ? sec : r.unit || ""}`;
      const arr = bySection.get(key) ?? [];
      arr.push(r);
      bySection.set(key, arr);
    }
  }
  for (const [key, rs] of bySection) {
    const g = key.split("|")[0];
    const nOf = (fallback: number): number => {
      const parsed = parseInt(g.split(" ").pop() ?? "", 10);
      return Number.isNaN(parsed) ? fallback : parsed;
    };
    const byNum = new Map<string, QuestionRow[]>();
    for (const r of rs) {
      const q = r.label.split("(")[0];
      const arr = byNum.get(q) ?? [];
      arr.push(r);
      byNum.set(q, arr);
    }
    // Batch-30 (CHMDSM151 vs MATDSC202T): a (group, unit) set is a
    // section-level pool only when its instruction is a standalone
    // line. When EVERY question in the set carries the instruction
    // on its own numbered line ("2. Answer any one of the following
    // questions: 10"), the choice is within each question — the
    // questions are independent and worth their own figures, so NO
    // section rule fires for the set at all (CHMDSM151 would read
    // 60/70 instead of 70/70). A question whose line is not found
    // votes unknown (allow), so a missing line can never silently
    // block a real section rule (MATDSC202T's standalone
    // "Answer any one : 10").
    const onLine = [...byNum.keys()].map((qn) =>
      instructionOnQuestionLine(qn, lines),
    );
    if (onLine.length > 0 && onLine.every((v) => v === true)) continue;
    // Batch-30 (G19b): the direct branch's per-question value is the
    // question's total, not the direct row's single figure — a direct
    // row that IS part (a) splits its marks across its sub-rows
    // (MATIDC151T Section C: Q40 direct 4 + (b) 4 = 8). Batch-21
    // (BOTDSC151T Q19/Q22) and batch-27 (ENGSEC101T Q18) still hold:
    // a question whose sub-rows start at (a) has a parent direct row,
    // whose figure is the whole question. Uniformity is tested over
    // fully-known values only (batch-25 ECOSEC151T: blank rows are
    // ignored, two witnesses minimum, zero disagreement).
    const directQs = [...byNum.keys()].filter((qn) =>
      (byNum.get(qn) ?? []).some((r) => r.label === qn),
    );
    const known = new Map<string, number>();
    for (const qn of directQs) {
      const v = questionValue(byNum.get(qn) as QuestionRow[], true);
      if (v !== null) known.set(qn, v);
    }
    if (
      directQs.length > 1 &&
      known.size >= 2 &&
      new Set(known.values()).size === 1
    ) {
      sectionTotal += nOf(rs.length) * [...known.values()][0];
      // Batch-23 (COMIDC-151T-B Section C): a split question in the
      // same section has no direct row, so its qnum never enters the
      // direct set — the per-question fallback would then count the
      // allowance a second time (110/70). Every question in this
      // (group, unit) set is in the section's answer-any pool, so
      // cover all of them.
      for (const q of byNum.keys()) sectionQnums.add(q);
      continue;
    }
    // Batch-30 (G19): the sub-part branch used to be skipped whenever
    // ANY direct row existed, but a section's direct rows can all be
    // blank while its sub-rows carry the figures (MATSEC151T Section
    // C: Q31/Q32 and Q37–Q40 blank, Q33–Q36 worth 5 each). It runs
    // whenever the direct branch above did not fire. The
    // per-question sums are the questionValue totals (a parent-shaped
    // question counts its direct figure alone, never direct + parts).
    if (byNum.size <= 1) continue;
    // Uniform branch (batch-22 CHMDSM151T): when every question in
    // the set sums to the same total T, count n x T once. A partly
    // known question breaks uniformity (its total is not proven equal
    // to the rest); an all-blank one neither proves nor breaks it
    // (batch-29 G18d). The batch-26 guard (N < len(by_num)) still
    // applies: a set with no question-level choice at all is
    // per-question counting.
    const strictVals: number[] = [];
    let uniformOk = true;
    for (const qrs of byNum.values()) {
      const v = questionValue(qrs, true);
      if (v !== null) strictVals.push(v);
      else if (questionPartiallyKnown(qrs)) {
        // A partly known question breaks uniformity (its total is
        // not proven equal to the rest); an all-blank one neither
        // proves nor breaks it (G18d).
        uniformOk = false;
      }
    }
    const n = nOf(byNum.size);
    // A single witness fires (batch-29 G18d: Section B's Q3=10
    // alone, Q4 all-blank, counts 1 x 10) — the two-witness minimum
    // belongs to the direct branch above, not here.
    if (
      uniformOk &&
      strictVals.length >= 1 &&
      new Set(strictVals).size === 1 &&
      n < byNum.size
    ) {
      sectionTotal += n * strictVals[0];
      for (const q of byNum.keys()) sectionQnums.add(q);
      continue;
    }
    // Section-level test for the largest-N fallback below (not for
    // the uniform branch above it): the "Answer any N" must choose
    // among QUESTIONS, not among one question's parts. N exceeds
    // every question's sub-part count, so no question has N parts to
    // choose within (DSM151T Section B: 5 > 2; CHMDSM151T
    // SECTION—B: 5 > 4; SEC151T Section C: 5 > 2). A per-question
    // choice (ENGAEC201T Q9/Q10: N=1 of 2 parts) fails it and keeps
    // per-question counting. MATDSC202T is the counter-case for
    // gating the UNIFORM branch this way: its "Answer any one : 10"
    // is a standalone instruction covering Q2 (4+3+3) and Q3 (5+5) —
    // a real section-level choice with N=1 <= 3 parts — and the
    // uniform branch must still fire (1 x 10 = 10). The batch-26
    // guard (N < len(by_num)) still applies: a set with no
    // question-level choice at all is per-question counting.
    const maxParts = Math.max(
      ...[...byNum.entries()].map(
        ([qn, qrs]) => qrs.filter((r) => r.label !== qn).length,
      ),
    );
    if (!(n < byNum.size && n > maxParts)) continue;
    // Largest-N fallback (G19, non-uniform per-question totals):
    // "Answer any N" over questions worth different marks counts the
    // N largest question totals (DSM151T Section B: five questions
    // worth 10, the rest 5–8 — top 5 = 50). Values are lower bounds
    // (blank parts count 0); an all-blank question is unknown and
    // excluded. At least N known values are required, or the set
    // falls through to per-question counting below.
    const lowerVals = [...byNum.values()]
      .map((qrs) => questionValue(qrs, false))
      .filter((v): v is number => v !== null)
      .sort((a, b) => b - a);
    if (lowerVals.length >= n) {
      sectionTotal += lowerVals.slice(0, n).reduce((a, b) => a + b, 0);
      for (const q of byNum.keys()) sectionQnums.add(q);
      continue;
    }
  }
  const perQnum = new Map<string, number>();
  const add = (q: string, v: number): void => {
    perQnum.set(q, (perQnum.get(q) ?? 0) + v);
  };
  for (const [qnum, rs] of byQnum) {
    if (sectionQnums.has(qnum)) continue;
    const eitherRs = rs.filter((r) => (r.group || "") === "Answer either");
    const anyRs = rs.filter((r) => (r.group || "").startsWith("Answer any "));
    if (eitherRs.length > 0) {
      const instr = eitherRs.find(
        (r) => r.label === qnum && r.marks !== null,
      );
      if (instr) {
        add(qnum, instr.marks as number);
      } else {
        const pairSum = (letters: string): number => {
          let s = 0;
          for (const r of eitherRs) {
            const letter =
              r.label.split("(").pop()?.replace(/\)$/, "") ?? "";
            if (letters.includes(letter)) {
              const m = rowMarksForCount(r);
              if (m !== null) s += m;
            }
          }
          return s;
        };
        add(qnum, Math.max(pairSum("ab"), pairSum("cd")));
      }
    } else if (anyRs.length > 0) {
      const group = anyRs[0].group || "";
      const parsed = parseInt(group.split(" ").pop() ?? "", 10);
      const n = Number.isNaN(parsed) ? anyRs.length : parsed;
      const marked = anyRs
        .map((r) => r.marks)
        .filter((m): m is number => m !== null);
      const per = marked.length > 0 ? Math.max(...marked) : null;
      if (per !== null) add(qnum, n * per);
    } else if (rs.slice(1).some((r) => (r.group || "").includes("OR"))) {
      const ms = rs
        .map((r) => rowMarksForCount(r))
        .filter((m): m is number => m !== null);
      if (ms.length > 0) add(qnum, Math.max(...ms));
    } else {
      const first = rs[0];
      const firstText = (first?.question ?? "").replace(/^[\s$*#]+/, "");
      const subs = rs.filter((r) => r.label !== qnum);
      if (
        first &&
        first.label === qnum &&
        first.marks !== null &&
        subs.length > 0 &&
        subs.every((r) => r.marks !== null && r.marks === first.marks)
      ) {
        add(qnum, first.marks);
      } else if (
        first &&
        first.label === qnum &&
        first.marks !== null &&
        subs.length > 0 &&
        // Batch-30 G21 (PHYDSM101T Q8): a parent-shaped question
        // whose line states its total as a split sum
        // ("1+3+3+3=10") — the direct figure IS the question total,
        // the parts must not be added on top. Parent shape only
        // (sub-rows start at (a)); a no-(a) question's identity is
        // part (a)'s own composition (PHYDSC101T Q15 "[3+4=7]",
        // 7+3=10).
        subs.some(
          (r) => subLetter(r.label) === "a",
        ) &&
        splitTotalOnQuestionLine(
          qnum,
          lines,
          first.marks,
          subs.map((r) => r.marks),
        )
      ) {
        add(qnum, first.marks);
      } else if (
        first &&
        first.label === qnum &&
        first.marks !== null &&
        /^Answer\s/.test(firstText)
      ) {
        add(qnum, first.marks);
      } else {
        for (const r of rs) {
          const m = rowMarksForCount(r);
          if (m !== null) add(qnum, m);
        }
      }
    }
  }
  let total = sectionTotal;
  for (const v of perQnum.values()) total += v;
  for (const [a, b] of orPairs(lines)) {
    if (perQnum.has(a) && perQnum.has(b)) {
      total -= Math.min(
        perQnum.get(a) as number,
        perQnum.get(b) as number,
      );
    }
  }
  return total;
}

/**
 * Fill a blank sub-part from its question's remainder (batch 29,
 * G18b): under a section-scoped "Answer any five : 10×5=50" a part
 * with no printed figure used to inherit the per-question total
 * (10) as its display marks — MATDSC151T Q17(a) read 10, true 4
 * (10−4−2). When exactly one part of a question took the fallback
 * and the others are printed, the blank part is the remainder of
 * the question total. When every part took the fallback (MATDSC151T
 * Q25), the rows stay blank — no figure is invented — and the
 * counter treats the question as consistent (G18d). A question
 * with two or more blank parts keeps the fallback display: the
 * split is underivable, and clearing it would break the
 * section-uniformity witnesses the counter needs. Only
 * section-scoped fallback rows are touched (a numbered
 * instruction's options really are worth the per each); a printed
 * figure is never overwritten; a question with a direct parent row
 * is left alone (its parts' display is the parent fill's business
 * — BOTDSC151T Q19(a)/(b), ENGSEC101T Q18); and a lone part keeps
 * its fallback (it IS the whole question). Runs after the rename
 * (labels final) and before the remainder-section fill.
 */
function fillRemainderSubParts(
  rows: QuestionRow[],
  fallback: Map<QuestionRow, number>,
): void {
  const byQ = new Map<string, QuestionRow[]>();
  for (const r of rows) {
    if (!r.label.includes("(")) continue;
    const q = r.label.split("(")[0];
    const arr = byQ.get(q) ?? [];
    arr.push(r);
    byQ.set(q, arr);
  }
  const parentQs = new Set(
    rows.filter((r) => !r.label.includes("(")).map((r) => r.label),
  );
  for (const [q, parts] of byQ) {
    if (parentQs.has(q)) continue;
    const blank = parts.filter((r) => fallback.has(r));
    if (blank.length === 0) continue;
    const t = fallback.get(blank[0] as QuestionRow) as number;
    if (!blank.every((r) => fallback.get(r) === t)) continue;
    if (blank.length === parts.length) {
      if (parts.length > 1) {
        for (const r of blank) r.marks = null;
      }
      continue;
    }
    if (blank.length !== 1) continue;
    const printed = parts.filter(
      (r) => !fallback.has(r) && r.marks !== null,
    );
    if (printed.length !== parts.length - 1) continue;
    const rem =
      t - printed.reduce((a, r) => a + (r.marks as number), 0);
    if (rem >= 1 && rem <= 100) blank[0].marks = rem;
  }
}

/**
 * Fill a blank sub-row of a direct parent row from the remainder
 * (batch 33, G24b): PHYDSC151T Q25 — the (a) part was folded into
 * the direct row by the pipeline's inline-(a) handling, so the
 * parent carries (a)'s 6 and the question total is 10: (b) is
 * 10−6=4, never the section per-question total 10. Only when the
 * parent carries a printed figure, exactly one sub-row is blank,
 * and every other sub-row carries a printed figure — the question
 * total is the blank row's fallback value (the section per-question
 * total). A parent with no figure (MATDSC151T Q25: no figure
 * anywhere), two or more blank sub-rows (COMIDC-151T (B) Q45,
 * IFFIDC151T Q39), or a blank row with no fallback value all stay
 * blank — the split is underivable. This only ever fills blank
 * cells; a printed figure is never overwritten. The (a)/(b) pair
 * shape (no parent row) is handled by fillRemainderSubParts above
 * and is untouched here.
 */
function fillDirectParentRemainder(
  rows: QuestionRow[],
  fallback: Map<QuestionRow, number>,
): void {
  const byQ = new Map<string, QuestionRow[]>();
  for (const r of rows) {
    if (!r.label.includes("(")) continue;
    const q = r.label.split("(")[0];
    const arr = byQ.get(q) ?? [];
    arr.push(r);
    byQ.set(q, arr);
  }
  const parents = new Map<string, QuestionRow>();
  for (const r of rows) {
    if (!r.label.includes("(")) parents.set(r.label, r);
  }
  for (const [q, parts] of byQ) {
    const parent = parents.get(q);
    if (!parent || parent.marks === null) continue;
    const blank = parts.filter((r) => fallback.has(r) || r.marks === null);
    if (blank.length !== 1) continue;
    const b = blank[0];
    if (!fallback.has(b)) continue;
    const t = fallback.get(b) as number;
    const others = parts.filter((r) => r !== b);
    if (others.some((r) => fallback.has(r) || r.marks === null)) continue;
    const rem =
      t -
      (parent.marks as number) -
      others.reduce((a, r) => a + (r.marks as number), 0);
    if (rem >= 1 && rem <= 100) b.marks = rem;
  }
}

/**
 * Fill a wholly markless section's rows from the full-marks
 * remainder (batch 28, G16): HISSEC151T Section C (Q31–Q40) counts
 * 50/50 through the pipeline's remainder rule, but every row's
 * Marks cell is blank. When exactly one section is markless and the
 * remainder divides evenly across its "Answer any N" count, each of
 * its rows displays the per-question remainder (25 over 5 = 5 each).
 * The total cannot change: the section rule then counts n x per
 * once, exactly the remainder. The remainder itself comes from
 * countedTotalExcludingRemainder above — the fill must agree with
 * the counter it feeds. A remainder that does not divide evenly, a
 * section with sub-rows (the per-question split is unknown), two
 * markless sections, or a missing full-marks figure all leave the
 * rows blank — the safe undercount, never an invented figure.
 */
function fillRemainderMarks(
  rows: QuestionRow[],
  transcript: string,
  lines: string[],
): void {
  if (!/SECTION/i.test(transcript)) return;
  const fm = transcript.match(/full[ _]marks\s*:\s*(\d+)/i);
  if (!fm) return;
  const fullMarks = parseInt(fm[1], 10);
  const byUnit = new Map<string, QuestionRow[]>();
  for (const r of rows) {
    const u = r.unit || "";
    if (!u) continue;
    const arr = byUnit.get(u) ?? [];
    arr.push(r);
    byUnit.set(u, arr);
  }
  const markless: Array<[string, QuestionRow[]]> = [];
  for (const [u, urs] of byUnit) {
    if (urs.length > 0 && urs.every((r) => r.marks === null)) {
      markless.push([u, urs]);
    }
  }
  if (markless.length !== 1) return;
  const [, urs] = markless[0];
  if (urs.some((r) => r.label.includes("("))) return;
  let n: number | null = null;
  for (const r of urs) {
    const g = r.group || "";
    if (g.startsWith("Answer any ")) {
      const parsed = parseInt(g.split(" ").pop() ?? "", 10);
      n = Number.isNaN(parsed) ? null : parsed;
      break;
    }
  }
  if (n === null) return;
  const total = countedTotalExcludingRemainder(rows, lines);
  const rem = fullMarks - total;
  if (rem <= 0 || rem % n !== 0) return;
  const per = rem / n;
  if (per < 1 || per > 20) return;
  for (const r of urs) r.marks = per;
}

/**
 * A standalone OR line, allowing markdown markers ("### OR", "**OR**")
 * and HTML centring ("<center>**OR**</center>", "<center>OR</center>" —
 * ENGDSC202T Q11/Q14: primary puts the margin figure on its own line,
 * then the centred OR) and HTML line breaks ("<br>Or<br>",
 * "<br>OR<br>", "<br>or<br>" — HISDSC202T Q4/Q6/Q8/Q10, batch 27).
 * The tags are stripped before the test, so every wrapped form reads
 * as a bare OR. Bengali papers write অথবা. A display-maths marker
 * ("$$\text{OR}$$", "$$\text{Or}$$" — batch 34, G26) reads the same
 * way: the $$ delimiters and \text{} wrapper are stripped first.
 */
const isOrLine = (l: string): boolean =>
  /^(OR|অথবা)$/i.test(
    l
      .replace(/<[^>]+>/g, "")
      .replace(/\$\$/g, "")
      .replace(/\\text\{/g, "")
      .replace(/\}/g, "")
      .replace(/^[#*\s]+|[#*\s]+$/g, ""),
  );

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
  const rawLines = formatted.split("\n");
  // A section instruction the pipeline reflow joined onto the
  // previous question's line is split back into its own line (batch
  // 37, G32), so the question keeps its own marks and the
  // instruction starts the next section. Only numbered lines split,
  // and only when the tail validates as an instruction.
  const lines: string[] = [];
  for (const l of rawLines) {
    const app = NUMBERED_LINE.test(l)
      ? splitAppendedSectionInstruction(l)
      : null;
    if (app) {
      lines.push(app[0], app[1]);
    } else {
      lines.push(l);
    }
  }
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
  // rows.length when the last UNIT/SECTION heading was seen — a
  // numbered line is a list item of the current question only when
  // a row was pushed after that heading (batch 31, G22): a paper
  // that restarts its numbering per unit opens with "1." right
  // after the heading, with no row since, and that "1." IS a new
  // question.
  let rowsAtLastHeading = 0;
  // Sub-rows whose marks include figures folded in from numbered
  // list-item lines (batch 31, G22) — the G18c-style add-back must
  // never treat a folded figure as a printed single figure.
  const foldedListMarks = new Set<QuestionRow>();
  // Whether the current group governs the whole section: an
  // unnumbered instruction whose question produced no rows before the
  // next number arrived (see clearGroupForNumber). A section
  // instruction ("যে কোনো দশটি প্রশ্নের উত্তর দাও : $২×১০=২০$",
  // BNGDSC152T বিভাগ—ক) survives every numbered question under it;
  // a new heading or instruction ends it.
  let sectionScoped = false;
  // A section instruction matched but not yet governing any question
  // (batch 37, G29–G32): an instruction matched directly under a
  // SECTION/বিভাগ heading, or one carrying a section-level shape
  // ("প্রতিটি ইউনিট থেকে", "from each Unit"), governs the whole
  // section — it must survive the UNIT headings inside that section
  // (see the heading branch below), where the old code reset the
  // group and only the first question kept it. Set in the
  // instruction branch, cleared by a non-section instruction, a
  // SECTION heading, or once the section scope is confirmed.
  let sectionInstrPending = false;
  // What the most recent heading was: "section" for বিভাগ/SECTION
  // headings, "unit" for UNIT/গুচ্ছ, null before any heading. Only a
  // section heading can open a section instruction (see below).
  let lastHeadingKind: "section" | "unit" | null = null;
  let orPending = false;
  // Whether a page break ("<!-- page N -->") has been seen since the
  // last numbered question — a sub-part line after one may be an
  // orphan whose label was cut off at the boundary (see
  // handleOrphanLine below).
  let crossedPageBreak = false;
  // Question numbers whose parent row's marks came from a single
  // figure on the question's own line (": 2", "$10$") — the whole
  // question's marks, which its blank sub-rows may inherit (G14).
  // A parent whose marks came from a split total ("1+3+3+3=10") or
  // a standalone marks line is never in here: its parts have their
  // own values, or none are known.
  const wholeQuestionParents = new Set<string>();
  // Parent rows whose marks came from a split expression on their
  // own line ("$5+5=10$", "5×2=10" — batch 36, G28), keyed by row
  // object (labels change under the duplicate-number rename,
  // objects do not): the G28 post-pass derives the sub-rows' marks
  // from the expression ("5+5" with (a)/(b) means 5 each), and a
  // parent with no printed figure at all (ZOODSC151T Q21: its 10
  // came from the section rule) is recognised by its ABSENCE here.
  const splitParentExpr = new Map<QuestionRow, string>();
  // Marks provenance for sub-rows (batch 29, G18b/G18c), keyed by row
  // object — labels change under the duplicate-number rename, objects
  // do not. groupMarksFallback: a sub-row whose marks came from the
  // groupMarks fallback under a section-scoped group, mapped to the
  // value it took (the per-QUESTION total, not the part's marks).
  // Under a numbered instruction the fallback is legitimate (each
  // option is worth the per), so only section-scoped fallbacks are
  // tracked. printedSubMarks: a sub-row whose marks came from a
  // figure printed on its own line — the G18c sum may add it back
  // when a roman continuation joins, but never a fallback value.
  const groupMarksFallback = new Map<QuestionRow, number>();
  const printedSubMarks = new Set<QuestionRow>();
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
    // A trailing run of <br> tags is a separator, not content:
    // "2 <br> $$\text{OR}$$ <br>" (ZOOIDC101T Q2/Q4/Q7/Q9, batch
    // 36, G27) must reduce to the figure before it, and a <br>
    // before the marker must not survive into the returned text.
    const stripBr = (s: string): string =>
      s.replace(/(?:<br\s*\/?>\s*)+$/i, "").trim();
    const t = stripBr(text);
    const m = t.match(/^(.*?)\s+(OR|অথবা)$/);
    if (m) return { text: stripBr(m[1]), isOr: true };
    // A trailing "<br>Or<br>" (HISDSC202T, batch 27): the model writes
    // the OR marker with HTML line breaks, and the pipeline reflow can
    // join it onto the row's line. The <br> before the marker is
    // required — a bare trailing lowercase "or" is ordinary text, not
    // a marker, and must never match.
    const m2 = t.match(
      /^(.*?)\s*<br\s*\/?>\s*(OR|অথবা)(?:\s*<br\s*\/?>)*\s*$/i,
    );
    if (m2) return { text: stripBr(m2[1]), isOr: true };
    // A trailing display-maths OR marker ("... [2] $$\text{OR}$$",
    // MATSEC101T Q12/Q13 — the pipeline reflow joins it onto the
    // question line). Any case variant counts ("$$\text{Or}$$",
    // PLSDSC102T Q8/Q10, batch 34, G26). The span must contain ONLY
    // the OR word: an Or between two structures inside one formula
    // ("$$\text{[...]} \quad \text{Or} \quad \text{[...]} $$",
    // CHMDSM151T 1(d)) is content, not a marker, and never matches
    // — the regex requires $$ immediately followed by the word.
    // Single-dollar "$\text{Or}$" (ECOSEC201T, under "Answer
    // either") is deliberately NOT matched here: recognising it
    // would append " (OR)" to the Answer-either group and break
    // that counter branch.
    const m3 = t.match(
      /^(.*?)\s*\$\$(?:\\text\{)?(OR|অথবা)(?:\})?\$\$\s*$/i,
    );
    if (m3) return { text: stripBr(m3[1]), isOr: true };
    // A trailing OR marker wrapped in HTML tags ("... $3+7=10$
    // <div align="center">OR</div>", ZOODSM101T Q2/Q5/Q8/Q11;
    // "... $6+4=10$ <center><b>OR</b></center>", ZOODSC202T Q14 —
    // batch 36, G27). The span must contain ONLY the OR word
    // (tags and * markers stripped): anything else is content, not
    // a marker. The figure before the marker is then readable by
    // stripTrailingMarks — before this the line ended in "</div>"
    // and no figure was extracted at all.
    const m4 = t.match(
      /^(.*?)\s*(?:<[^>]+>)+\s*(?:\*+)?(OR|অথবা)(?:\*+)?\s*(?:<\/[^>]+>)+\s*$/i,
    );
    if (m4) return { text: stripBr(m4[1]), isOr: true };
    return { text, isOr: false };
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
    // below — provisionally: the post-pass fillRemainderSubParts
    // (batch 29, G18b) derives its remainder from the printed
    // siblings, or blanks it when no figure is printed anywhere.
    // Under a numbered instruction the fallback is the part's own
    // marks (each option is worth the per), so only section-scoped
    // fallbacks are tracked as such.
    const stripped = stripTrailingMarks(
      orStripped.text,
      sectionScoped ? null : groupGuard,
      group,
    );
    const label = `${qNum}(${letter})`;
    const row: QuestionRow = {
      label,
      question: stripped.text,
      marks: stripped.marks ?? groupMarks,
      unit,
      group,
      id: `${paperCode}-Q${qNum}${letter}`,
      keywords: "",
    };
    if (stripped.marks !== null) {
      printedSubMarks.add(row);
    } else if (groupMarks !== null && sectionScoped) {
      groupMarksFallback.set(row, groupMarks);
    }
    return { row, isOr: orStripped.isOr };
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
   * A rejected "(i)/(ii)/..." line that carries a marks figure is
   * a continuation of the previous sub-question — its sub-parts,
   * printed on their own line. Join it into that row's text and
   * re-derive the marks (MTMDSC301T Q6(b), MTMDSC302T Q2(c),
   * MTMDSM301 Q8(a), MTMDSC201T Q10(d)). The figure may sit mid-line
   * ("(v) ... ? 2 (vi) ... : 2 * enormous * indication", ENGAEC251
   * Q4(b)). A line with no figure at all is an MCQ option
   * (ENGSEC101T "(i) Stationary (ii) Stationery") and stays dropped.
   * Returns true when joined.
   */
  const joinContinuation = (line: string): boolean => {
    const probe = stripTrailingMarks(line, null, "");
    // A roman sub-part line joins when it carries a marks figure: at
    // the end ("(iv) ... ? 1") or after one of its questions
    // ("(v) ... ? 2 (vi) ... : 2 * enormous * indication",
    // ENGAEC251 Q4(b) — the figure sits mid-line, the line ends in
    // the (vi) question's word list). A bare MCQ-option line
    // ("(i) Stationary (ii) Stationery") has no figure at all and
    // still stays dropped.
    const hasFigure =
      probe.marks !== null ||
      /[?:]\s*\d/.test(line);
    if (!hasFigure) return false;
    const last = rows[rows.length - 1];
    if (!last) return false;
    if (last.label.split("(")[0] !== qNum) return false;
    // The pair-either instruction row is not a question to continue.
    if (last.label === qNum && last.group === "Answer either") return false;
    const prevMarks = last.marks;
    const prevHasRomanI = /\(i\)/.test(last.question);
    last.question = `${last.question} ${line}`.trim();
    const rederived = stripTrailingMarks(
      last.question,
      sectionScoped ? null : groupGuard,
      group,
    );
    last.question = rederived.text;
    if (rederived.marks !== null) last.marks = rederived.marks;
    // Merged roman sub-parts split across a page break (batch 29,
    // G18c): MATDSC152T Q22(b) — "(b) (i) ... 2" was pushed with the
    // (i) figure already stripped as the row's marks, so when "(ii)
    // ... 3" joins, the re-derived marks cover the (ii) part only.
    // Add the (i) part's printed marks back — but only when the row's
    // marks were printed (never a groupMarks fallback), the appended
    // line is a roman continuation, and the re-derive found exactly
    // the appended line's figure (so the merged sum did not fire and
    // nothing is double-counted).
    if (
      /^\((ii|iii|iv|v|vi)\)\s/.test(line.trim()) &&
      prevHasRomanI &&
      prevMarks !== null &&
      printedSubMarks.has(last) &&
      probe.marks !== null &&
      rederived.marks === probe.marks
    ) {
      const sum = prevMarks + probe.marks;
      const guard = sectionScoped ? null : groupGuard;
      if (sum >= 1 && sum <= 100 && (guard === null || guard === sum)) {
        last.marks = sum;
      }
    }
    return true;
  };

  /**
   * A display formula on its own line belongs to the last row of the
   * current question — it is that question's equation, possibly
   * carrying its marks figure ("$$...$$ [3]", PHYDSC101T Q14(c);
   * "$$...$$ 5", MATDSC252 Q2(b) in the raw transcript). The formula
   * joins the row's text and the marks are re-derived; only a figure
   * the formula line itself carries may change the marks.
   */
  const joinFormulaLine = (line: string): boolean => {
    const last = rows[rows.length - 1];
    if (!last) return false;
    if (last.label.split("(")[0] !== qNum) return false;
    // The pair-either instruction row is not a question to continue.
    if (last.label === qNum && last.group === "Answer either") return false;
    last.question = `${last.question} ${line}`.trim();
    if (
      /\$\$\s*(?:\**[\d০-৯]+\**|\[[\d০-৯]+(?:\s*(?:\\times|[×x+])\s*[\d০-৯]+)*(?:\s*=\s*[\d০-৯]+)?\])\s*$/.test(
        line,
      )
    ) {
      const rederived = stripTrailingMarks(
        last.question,
        sectionScoped ? null : groupGuard,
        group,
      );
      last.question = rederived.text;
      if (rederived.marks !== null) last.marks = rederived.marks;
    }
    return true;
  };

  /** Append a line to the last row's text and re-derive its marks. */
  const appendToLast = (line: string): void => {
    const last = rows[rows.length - 1];
    if (!last) return;
    last.question = `${last.question} ${line}`.trim();
    const rederived = stripTrailingMarks(
      last.question,
      sectionScoped ? null : groupGuard,
      group,
    );
    last.question = rederived.text;
    if (rederived.marks !== null) last.marks = rederived.marks;
  };

  /**
   * A bare numbered line ("1.", "2.") inside an open question is a
   * list item of that question, not a new top-level question (batch
   * 31, G22: PHIDSC201T Q4(b)'s four numbered things, Q10(c)(i)'s
   * two arguments — the old code made top-level rows '1'–'4' and
   * '1b'/'2b', whose IDs collided with Unit-I Q1(b)/Q2(b)). The
   * line folds into the last row of the current question: its text
   * joins the row (trailing figure stripped, as usual), and its
   * printed figures add to the row's marks — the trailing figure
   * plus bracketed [n] figures after a "?" or "." (Q10(c)(ii)/(iii)
   * [2] + (iv) 2 = 6 on top of the (i) line's 2+2=4, so Q10(c)
   * reads 10; Q4(b)'s 3+3+2+2 accumulate to 10). Guards: the number
   * must already exist (a genuine new question is lastQNum + 1),
   * the last row must be a sub-row of the current question (a G15
   * duplicate's twin is a direct row, so it still opens a new
   * question and gets renamed), a row must have been pushed since
   * the last heading, and no OR may be pending (the alternative is
   * a genuine question). A row whose marks came from a groupMarks
   * fallback never takes folded figures (they would double-count
   * the fallback). Returns true when folded.
   */
  const foldNumberedListItem = (line: string, n: number): boolean => {
    if (n > lastQNum) return false;
    if (orPending) return false;
    if (rows.length <= rowsAtLastHeading) return false;
    const last = rows[rows.length - 1];
    if (!last) return false;
    if (!last.label.includes("(")) return false;
    if (last.label.split("(")[0] !== qNum) return false;
    const probe = stripTrailingMarks(line, null, "");
    let contribution = probe.marks ?? 0;
    for (const m of line.matchAll(/(?:[?.])\s*\[([\d০-৯]+)\]/g)) {
      const v = asciiNumber(m[1]);
      if (v !== null) contribution += v;
    }
    last.question = `${last.question} ${probe.text}`.trim();
    if (contribution > 0) {
      if (last.marks === null) {
        last.marks = contribution;
        foldedListMarks.add(last);
      } else if (printedSubMarks.has(last) || foldedListMarks.has(last)) {
        last.marks += contribution;
      }
      // else: marks came from a groupMarks fallback — never add.
    }
    return true;
  };

  /**
   * The next labeled sub-question after line `from`, or "end" when the
   * current question's sub-part run ends first (a numbered question,
   * instruction, heading, OR line, or bare number). Lines that are
   * neither are further orphan fragments and are skipped.
   */
  const nextSubAfter = (
    from: number,
    inferredLetter?: string,
  ): { letter: string } | "end" => {
    for (let j = from; j < lines.length; j++) {
      const t = lines[j].trim();
      if (!t || t.startsWith("<!--")) continue;
      const sm = t.match(SUB_QUESTION_LINE);
      // A "(i)" line is a roman-numeral sub-part of the current
      // option, not the next lettered option (ENGAEC251 Q4: the
      // "(i) What is the name of the company...?" comprehension
      // questions after a passage) — unless (i) is exactly the
      // letter being inferred (an orphan after (h)).
      if (sm && !(sm[1] === "i" && inferredLetter !== "i")) {
        return { letter: sm[1] ?? BN_PART_TO_LATIN[sm[2]] };
      }
      const bs = t.match(BARE_SUB_LINE);
      if (bs && !(bs[1] === "i" && inferredLetter !== "i")) {
        return { letter: bs[1] ?? BN_PART_TO_LATIN[bs[2]] };
      }
      const ns = t.match(NUMBERED_SUB_LINE);
      if (ns) return { letter: ns[2] ?? BN_PART_TO_LATIN[ns[3]] };
      if (
        NUMBERED_LINE.test(t) ||
        UNIT_HEADING.test(t) ||
        matchInstruction(t) !== null ||
        isOrLine(t) ||
        /^[\d০-৯]+\s*[।.]$/.test(t)
      ) {
        return "end";
      }
    }
    return "end";
  };

  /**
   * An unlabeled line after a page break, inside a question whose
   * latest sub-part is known: the sub-part's label was cut off at the
   * page boundary (EESVAC-A Q1(b)/(c): pg-1 ends at Q1(a), pg-2 opens
   * with "pyramid." then "Give one example of terrestrial
   * ecosystem.", then "(d)"). The next labeled part decides: when it
   * skips the inferred letter (or the question ends), this line IS
   * that skipped part; when it is the inferred letter itself, this
   * line continues the previous part. A part whose text was cut off
   * mid-sentence (no terminal punctuation) is continued, never
   * promoted. Returns true when the line was consumed.
   */
  const handleOrphanLine = (line: string, idx: number): boolean => {
    if (!qNum || !lastSubLetter) return false;
    if (line.startsWith("#") || isTableLine(line)) return false;
    if (line.startsWith("(")) return false;
    // A footer/header line, never a question.
    if (
      /^(J\d+|\(?\s*(Continued|Turn Over)|Time\s*:|Full Marks|Pass Marks|Course No)/i.test(
        line,
      )
    ) {
      return false;
    }
    const last = rows[rows.length - 1];
    if (!last || last.label !== `${qNum}(${lastSubLetter})`) return false;
    // Not a question at all: a markdown rule, an editorial bracketed
    // note, a bare number fragment, or a line with no words in it —
    // a page-break artifact, never a sub-part (CHMDSM201T /
    // MTMDSM101T / PHYDSM101T "---" rules, BNGDSC201T "[page 3
    // FAILED...]", CHMDSM252 "\hfill 2 \hfill 3+3=6", UNIVAC101T
    // "4 )"). Consumed, never a row and never appended: appending a
    // dangling figure would overwrite the row's true marks.
    const stripped = line.replace(/^[#*\s]+/, "");
    if (
      /^([-*_]\s*){3,}$/.test(stripped) ||
      stripped.startsWith("[") ||
      !/[A-Za-z\u0985-\u09e5\u0600-\u06ff]/.test(
        stripped.replace(/\\[A-Za-z]+/g, ""),
      )
    ) {
      return true;
    }
    const inferred = String.fromCharCode(lastSubLetter.charCodeAt(0) + 1);
    if (inferred > "j") {
      // No further sub-part letter exists: a continuation, not a row.
      appendToLast(line);
      return true;
    }
    if (!acceptsSubLetter(inferred)) return false;
    const prevComplete = /[.!?$:;]$/.test(last.question.trim());
    if (!prevComplete) {
      appendToLast(line);
      return true;
    }
    // A "(i)/(ii)/..." line is a sub-part of the previous row, never
    // a new lettered option (ECODSC101T Q2(b)(ii) after the page
    // break) — join it when it ends in marks, drop it otherwise,
    // exactly like the main loop's "(ii)" rule. It sits AFTER the
    // mid-sentence check above: a (i) line continuing an unfinished
    // part (ECODSC101T "* (i) Discuss briefly..." after "* (b)") is
    // appended there, not dropped here. The `*` bullet prefix is
    // stripped for the test; the joined text keeps the raw line.
    if (/^\((i|ii|iii|iv|v|vi)\)\s+.+$/.test(stripped)) {
      joinContinuation(line);
      return true;
    }
    const next = nextSubAfter(idx + 1, inferred);
    if (next !== "end" && next.letter <= inferred) {
      // The next labeled part IS the inferred letter: a continuation.
      appendToLast(line);
      return true;
    }
    // A header line ("Questions :") labels the roman-numeral
    // questions that follow it — it belongs to the previous part,
    // never a row of its own (ENGAEC251 Q4(b)).
    if (/^(Questions?|Answer the following[^:]*)\s*:/i.test(stripped)) {
      appendToLast(line);
      return true;
    }
    if (next === "end") {
      // No labeled part follows: a short fragment is the skipped last
      // part (EESVAC-A "pyramid."), but a multi-sentence paragraph is
      // the previous part's prose continuing across the break
      // (ENGAEC251 Q4(b) passage) — append that, don't promote it.
      const sentences = (line.match(/[.!?]+/g) || []).length;
      if (sentences > 2) {
        appendToLast(line);
        return true;
      }
    }
    pushSubRow(inferred, line);
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
        (lastHeadingKind === "section" || sectionInstrPending)
      ) {
        sectionScoped = true;
        sectionInstrPending = false;
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
      (lastHeadingKind === "section" || sectionInstrPending)
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
      sectionInstrPending = false;
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
    isOrLine(l) ||
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
    if (stripped.marks !== null && !stripped.split) {
      wholeQuestionParents.add(num);
    }
    if (
      stripped.marks !== null &&
      stripped.split &&
      stripped.splitExpr
    ) {
      splitParentExpr.set(row, stripped.splitExpr);
    }
    if (orStripped.isOr) {
      applyOr(row);
      orPending = true;
      rows.push(row);
    } else {
      pushRow(row);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    const unitMatch = line.match(UNIT_HEADING);
    if (unitMatch) {
      const isSectionHeading =
        unitMatch[1] === "SECTION" || unitMatch[3] !== undefined;
      // A section instruction survives the UNIT headings inside its
      // section (batch 37, G29–G32): the group was set by an
      // instruction matched under a SECTION heading (or shaped
      // section-level) and no question row has been pushed since, or
      // it already governs the section. A new SECTION heading still
      // ends it, and a consumed instruction never preserves (rows
      // were pushed, so the group belongs to those questions).
      const preserveSectionGroup =
        !isSectionHeading &&
        (sectionScoped ||
          (sectionInstrPending && rows.length === rowsAtGroupStart));
      unit =
        unitMatch[2] ??
        unitMatch[3] ??
        (unitMatch[4] ? asciiDigits(unitMatch[4]) : "");
      lastHeadingKind = isSectionHeading ? "section" : "unit";
      if (preserveSectionGroup) {
        // The section instruction now governs the section: keep its
        // group and per-part marks, and remember that a section
        // instruction was seen (a later per-unit instruction must
        // not inherit a marks line that belonged to the section).
        sectionScoped = true;
        sectionInstrPending = false;
        groupMarksFromLine = false;
        seenInstructionSinceHeading = true;
        orPending = false;
        pendingSub = null;
        lastSubLetter = "";
        crossedPageBreak = false;
        rowsAtLastHeading = rows.length;
        continue;
      }
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
      sectionInstrPending = false;
      orPending = false;
      pendingSub = null;
      lastSubLetter = "";
      crossedPageBreak = false;
      rowsAtLastHeading = rows.length;
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
    if (isOrLine(line)) {
      if (rows.length > 0 && !rows[rows.length - 1].label.includes("(")) {
        applyOr(rows[rows.length - 1]);
      }
      orPending = true;
      continue;
    }

    // Page markers and any other HTML comments are not questions —
    // but a marker inside a question means the next unlabeled line
    // may be an orphan sub-part (see handleOrphanLine).
    if (line.startsWith("<!--")) {
      crossedPageBreak = true;
      continue;
    }

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
      crossedPageBreak = false;
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
      // A section instruction (under a SECTION heading, or shaped
      // section-level) is pending until a UNIT heading or the first
      // question confirms it governs the section (batch 37, G29–G32).
      // The line is folded first: the transcripts mix both য় byte
      // forms (U+09DF and YA + nukta), and the shape pattern is
      // written in the U+09DF form.
      sectionInstrPending =
        lastHeadingKind === "section" ||
        SECTION_LEVEL_SHAPE.test(foldBnYy(line));
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

    // A bare marks figure on its own line ("10") directly before an
    // OR marker is that question's marks (ENGDSC202T Q11/Q14, batch
    // 26: primary puts the margin figure on its own line, then
    // "<center>**OR**</center>"). Only when the next meaningful line
    // is an OR marker — a bare number anywhere else is a page number
    // or list fragment, never marks — and only into a blank cell of
    // the current direct question (never over a printed figure, and
    // never onto a sub-part row, whose marks are its own split).
    const bareFig = line.match(/^([\d০-৯]+)$/);
    if (bareFig) {
      const n = asciiNumber(bareFig[1]);
      let next: string | null = null;
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j].trim();
        if (!t || t.startsWith("<!--")) continue;
        next = t;
        break;
      }
      if (
        n !== null &&
        n >= 1 &&
        n <= 100 &&
        next !== null &&
        isOrLine(next)
      ) {
        const last = rows[rows.length - 1];
        if (
          last &&
          last.marks === null &&
          !last.label.includes("(") &&
          last.label.split("(")[0] === qNum
        ) {
          last.marks = n;
          // A single bare figure: the whole question's marks (G14).
          wholeQuestionParents.add(qNum);
        }
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
        crossedPageBreak = false;
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

    // A "(ii)"/"(iii)"/"(iv)"/"(v)"/"(vi)" line never starts a
    // sub-question (those are single letters) — it is a continuation
    // of the previous row's sub-parts, or an MCQ option. Join it when
    // it ends in marks.
    if (/^\((ii|iii|iv|v|vi)\)\s+.+$/.test(line)) {
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
        if (joinContinuation(line)) continue;
        // A "(i) ..." line with three or more roman items and no
        // marks figure is the question's own list, not MCQ options
        // (batch 31, G22: PHIDSC201T Q4(b)'s four propositions,
        // Q10(a)'s four set operations — the "(v)" line already
        // joined with its figure). MCQ option lines carry one or
        // two items (ENGSEC101T "(i) Stationary (ii) Stationery")
        // and stay dropped. Appends text only — the line has no
        // figure, so no marks change.
        const romanItems = line.match(/\((i|ii|iii|iv|v|vi)\)/g) ?? [];
        const last = rows[rows.length - 1];
        if (
          romanItems.length >= 3 &&
          last &&
          last.label.split("(")[0] === qNum
        ) {
          last.question = `${last.question} ${line}`.trim();
        }
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
        crossedPageBreak = false;
        pendingSub = null;
        pendingQ = { num: String(n), text: "" };
        continue;
      }
      // Any other bare number is not a question start.
      continue;
    }

    const numMatch = line.match(NUMBERED_LINE);
    if (numMatch) {
      // A numbered list item inside the current question folds into
      // it (batch 31, G22) — it is not a new top-level question.
      const n0 = asciiNumber(numMatch[1]);
      if (n0 !== null && foldNumberedListItem(line, n0)) continue;
      // A direct question with no sub-parts. It also becomes the
      // current question number for any (a)/(b) lines that follow it.
      const n = asciiNumber(numMatch[1]);
      if (n !== null) {
        clearGroupForNumber(n);
        qNum = String(n);
        lastQNum = n;
        crossedPageBreak = false;
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
      if (stripped.marks !== null && !stripped.split) {
        wholeQuestionParents.add(qNum);
      }
      if (stripped.marks !== null && stripped.split && stripped.splitExpr) {
        splitParentExpr.set(row, stripped.splitExpr);
      }
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
    // margin...") is not a question — except a display formula on its
    // own line, which is the last row's equation (and may carry its
    // marks figure), and an orphan sub-part line after a page break,
    // whose label was cut off at the boundary.
    if (line.startsWith("$")) {
      if (joinFormulaLine(line)) continue;
    }
    if (crossedPageBreak && handleOrphanLine(line, i)) continue;
  }
  // Marks the paper never prints, recovered from the paper's own
  // structure (batch 24). These only ever FILL blank cells — a
  // printed figure is never overwritten.
  const pairTotal = pairEitherTotal(rows);
  if (pairTotal !== null) fillPairTotalParts(rows, pairTotal);
  fillEitherParentMarks(rows, pairTotal);
  fillPositionalMarks(rows);
  fillWholeQuestionParentParts(rows, wholeQuestionParents);
  fillSplitParentParts(
    rows,
    splitParentExpr,
    groupMarksFallback,
    wholeQuestionParents,
  );
  // The rename runs before the OR-partner fill: until the second
  // "23" becomes "23b", its sub-rows look like they belong to the
  // first "23", and the hybrid guard would wrongly skip the pair.
  renameDuplicateNumbers(rows, paperCode);
  fillOrPartnerMarks(rows);
  fillRemainderSubParts(rows, groupMarksFallback);
  fillDirectParentRemainder(rows, groupMarksFallback);
  fillRemainderMarks(rows, transcript, transcript.split("\n"));
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

  const titleIdx = lines.findIndex(
    (l) =>
      l.startsWith("# ") &&
      // A header code line the model put first as a heading
      // ("# 2024/FYUG/EVEN/SEM/SANDSC-151T/070", SANDSC151T batch
      // 35, ZOODSC151T/ZOOIDC101T batch 36) is printer-code noise,
      // not the exam name: skip it and take the real title line
      // after it ("# FYUG Even Semester Exam., 2024").
      !/^# \d{4}\/FYUG\//.test(l),
  );
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
    // line, e.g. "( Consumer Behaviour )". It may also be text with a
    // parenthetical ("Ethics—I (Indian)", batch 31, G23), wrapped in
    // square brackets ("[ Persian Poetry (Some Selections) ]"), or
    // carry markdown heading markers ("### Ethics—II (Western)").
    // A bare title with no parenthetical is never taken: the next
    // line could be "Full Marks: 70" or "The figures in the margin
    // ...".
    const codeIdx = lines.findIndex((l) =>
      /(?:Paper Code|Course No\.)\s*:/.test(l),
    );
    if (codeIdx !== -1 && lines[codeIdx + 1]) {
      let candidate = lines[codeIdx + 1]
        .replace(/^#{1,6}\s*/, "")
        .replace(/^\*{0,2}\s*/, "")
        .replace(/\*{0,2}\s*$/, "")
        .trim();
      const bracketed = candidate.match(/^\[\s*(.+?)\s*\]$/);
      if (bracketed) candidate = bracketed[1].trim();
      const whole = candidate.match(/^\(\s*(.+?)\s*\)$/);
      if (whole) {
        if (!/\d+(?:st|nd|rd|th)\s+Semester/.test(whole[1])) {
          fm.title = whole[1].trim();
        }
      } else if (
        /\(.+\)/.test(candidate) &&
        !/\d+(?:st|nd|rd|th)\s+Semester/.test(candidate) &&
        !/^(Full Marks|Pass Marks|Time)\s*:/.test(candidate) &&
        !/^(UNIT|SECTION)\b/.test(candidate)
      ) {
        fm.title = candidate;
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
