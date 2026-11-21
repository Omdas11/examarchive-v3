/**
 * MD verification — question-paper md parser (pure, no D1 / auth).
 *
 * The friend's AI writes md in the shape seen on real uploads
 * (COMDSC-352T, batch 1): a header block, then UNIT headings, then
 * numbered questions with sub-parts (a) (b) (c). Marks show up in one
 * of three places: trailing on the question line ("... : 10"), a maths
 * line ("$2+8=10$"), or a bare number line ("10").
 *
 * The parser splits the md into a header, units, and one block per
 * question, keeping every block's original lines. Reassembling an
 * unedited parse returns the input byte-for-byte, so the stored md
 * format never changes. Editing a card regenerates only that card's
 * lines. Anything the parser cannot place is kept verbatim (trailing
 * lines, or extra lines attached to the previous question).
 *
 * Page markers look like `<!-- page 3 -->` and attach to the next
 * question (or the header when they come before the first question).
 */

export type MarksStyle = "trailing" | "math" | "bare" | "none";

export interface ParsedQuestion {
  /** Stable key, "q1", "q2", ... in document order. */
  key: string;
  /** Question number as printed, e.g. "1". */
  number: string;
  /** Unit label the question sits under, e.g. "I", or null. */
  unit: string | null;
  /** Display label, e.g. "Q1". */
  label: string;
  /** Full question text, sub-parts included, newlines preserved. */
  text: string;
  /** Marks, or null when the md gives none. */
  marks: number | null;
  /** PDF page the question is on, or null when untagged. */
  page: number | null;
  /** Original lines of this block (no page marker, no blank padding). */
  rawLines: string[];
  /** Lines that followed this question but belonged to no block. */
  extraLines: string[];
  /** Original marks line ("$2+8=10$" or "10"), or null. */
  marksLine: string | null;
  /** Where the marks came from in the original. */
  marksStyle: MarksStyle;
  /** Original marks, to tell a maths marks line from an edited one. */
  originalMarks: number | null;
  /** Set by the UI when the card was edited; not serialized. */
  edited: boolean;
}

export interface ParsedUnit {
  label: string;
  /** Heading line exactly as printed, e.g. "UNIT—I". */
  headingRaw: string;
  /** Lines between the heading and its first question, verbatim. */
  introLines: string[];
  questions: ParsedQuestion[];
}

export interface ParsedHeader {
  paperCode: string | null;
  fullMarks: number | null;
  passMarks: number | null;
  time: string | null;
  title: string | null;
}

export interface ParsedMd {
  /** Lines before the first UNIT heading, verbatim. */
  headerLines: string[];
  headerPage: number | null;
  header: ParsedHeader;
  units: ParsedUnit[];
  /** Flat list of all questions, in document order. */
  questions: ParsedQuestion[];
  /** Unplaced lines after the last question, verbatim. */
  trailingLines: string[];
  hasQuestions: boolean;
}

const PAGE_MARKER = /<!--\s*page\s+(\d+)\s*-->/i;
const UNIT_HEADING = /^\s*UNIT\s*[—–\-]?\s*([IVXLC]+|\d+)\s*$/i;
const QUESTION_START = /^\s*(\d+)\s*[.)]\s+([\s\S]*)$/;
const TRAILING_MARKS = /:\s*(\d+)\s*$/;
const MATH_MARKS = /^\s*\$(.+)\$\s*$/;
const BARE_NUMBER = /^\s*(\d+)\s*$/;
const PAPER_CODE_LINE = /paper\s*code\s*:\s*(.+?)\s*$/i;
const FULL_MARKS_LINE = /full\s*marks\s*:\s*(\d+)/i;
const PASS_MARKS_LINE = /pass\s*marks\s*:\s*(\d+)/i;
const TIME_LINE = /^\s*time\s*:\s*(.+?)\s*$/i;
const TITLE_LINE = /^#\s+(.+?)\s*$/;

function parseHeader(lines: string[]): ParsedHeader {
  const header: ParsedHeader = {
    paperCode: null,
    fullMarks: null,
    passMarks: null,
    time: null,
    title: null,
  };
  for (const line of lines) {
    const code = PAPER_CODE_LINE.exec(line);
    if (code) header.paperCode = code[1].trim();
    const full = FULL_MARKS_LINE.exec(line);
    if (full) header.fullMarks = Number(full[1]);
    const pass = PASS_MARKS_LINE.exec(line);
    if (pass) header.passMarks = Number(pass[1]);
    const time = TIME_LINE.exec(line);
    if (time) header.time = time[1].trim();
    const title = TITLE_LINE.exec(line);
    if (title) header.title = title[1].trim();
  }
  return header;
}

/** Parse md text into header + units + questions. Never throws. */
export function parseMd(mdText: string): ParsedMd {
  const lines = mdText.split("\n");
  const parsed: ParsedMd = {
    headerLines: [],
    headerPage: null,
    header: {
      paperCode: null,
      fullMarks: null,
      passMarks: null,
      time: null,
      title: null,
    },
    units: [],
    questions: [],
    trailingLines: [],
    hasQuestions: false,
  };

  let pendingPage: number | null = null;
  let currentUnit: ParsedUnit | null = null;
  let currentQuestion: ParsedQuestion | null = null;
  let currentLines: string[] = [];
  // Holder object (not a plain let): assignments inside flushQuestion
  // must survive TS narrowing, which would otherwise narrow a plain
  // let to null from its initializer and call later uses "never".
  const lastQuestionRef: { current: ParsedQuestion | null } = {
    current: null,
  };
  let pendingBlanks: string[] = [];

  const flushQuestion = () => {
    if (!currentQuestion) return;
    finishQuestion(currentQuestion, currentLines);
    parsed.questions.push(currentQuestion);
    lastQuestionRef.current = currentQuestion;
    currentQuestion = null;
    currentLines = [];
  };

  for (const line of lines) {
    const marker = PAGE_MARKER.exec(line);
    if (marker) {
      pendingPage = Math.max(1, Number(marker[1]));
      continue;
    }
    const unit = UNIT_HEADING.exec(line);
    if (unit) {
      flushQuestion();
      if (pendingBlanks.length > 0) {
        // Blank lines before a UNIT heading belong to the previous
        // question's block (or the header when there is none yet).
        if (lastQuestionRef.current) {
          lastQuestionRef.current.rawLines.push(...pendingBlanks);
        } else {
          parsed.headerLines.push(...pendingBlanks);
        }
        pendingBlanks = [];
      }
      currentUnit = {
        label: unit[1].toUpperCase(),
        headingRaw: line,
        introLines: [],
        questions: [],
      };
      parsed.units.push(currentUnit);
      continue;
    }
    const q = QUESTION_START.exec(line);
    if (q) {
      flushQuestion();
      currentQuestion = {
        key: `q${parsed.questions.length + 1}`,
        number: q[1],
        unit: currentUnit ? currentUnit.label : null,
        label: `Q${q[1]}`,
        text: "",
        marks: null,
        page: pendingPage,
        rawLines: [...pendingBlanks, line],
        extraLines: [],
        marksLine: null,
        marksStyle: "none",
        originalMarks: null,
        edited: false,
      };
      pendingPage = null;
      pendingBlanks = [];
      currentLines = [line];
      if (currentUnit) currentUnit.questions.push(currentQuestion);
      continue;
    }
    if (line.trim() === "") {
      pendingBlanks.push(line);
      continue;
    }
    if (currentQuestion) {
      // Inside a question: keep the line, blanks included.
      currentLines.push(...pendingBlanks, line);
      currentQuestion.rawLines.push(...pendingBlanks, line);
      pendingBlanks = [];
      continue;
    }
    if (currentUnit && currentUnit.questions.length === 0) {
      // Between a UNIT heading and its first question.
      currentUnit.introLines.push(...pendingBlanks, line);
      pendingBlanks = [];
      continue;
    }
    if (lastQuestionRef.current) {
      // A stray line between questions: keep it with the previous
      // question so nothing is ever dropped.
      lastQuestionRef.current.extraLines.push(...pendingBlanks, line);
      pendingBlanks = [];
      continue;
    }
    // Before the first question: header.
    parsed.headerLines.push(...pendingBlanks, line);
    pendingBlanks = [];
  }
  flushQuestion();
  parsed.trailingLines = pendingBlanks;
  parsed.header = parseHeader(parsed.headerLines);
  parsed.headerPage = pendingPage;
  parsed.hasQuestions = parsed.questions.length > 0;
  return parsed;
}

/** Split a question's collected lines into text + marks. */
function finishQuestion(q: ParsedQuestion, lines: string[]) {
  if (lines.length === 0) return;
  const first = lines[0];
  const firstText = QUESTION_START.exec(first)?.[2] ?? first;
  const trailing = TRAILING_MARKS.exec(firstText);
  const textLines: string[] = [];
  let marksLine: string | null = null;
  let marksStyle: MarksStyle = "none";
  let marks: number | null = null;

  if (trailing) {
    marks = Number(trailing[1]);
    marksStyle = "trailing";
    textLines.push(firstText.slice(0, trailing.index).trimEnd());
    for (let i = 1; i < lines.length; i++) textLines.push(lines[i]);
  } else {
    textLines.push(firstText);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (marks === null) {
        const math = MATH_MARKS.exec(line);
        if (math) {
          const eq = /=\s*(\d+)\s*$/.exec(math[1].trim());
          if (eq) {
            marks = Number(eq[1]);
            marksStyle = "math";
            marksLine = line;
            continue;
          }
        }
        const bare = BARE_NUMBER.exec(line);
        if (bare) {
          marks = Number(bare[1]);
          marksStyle = "bare";
          marksLine = line;
          continue;
        }
      }
      textLines.push(line);
    }
  }
  q.text = textLines.join("\n");
  q.marks = marks;
  q.marksLine = marksLine;
  q.marksStyle = marksStyle;
  q.originalMarks = marks;
}

/** Regenerate one question's lines from its edited fields. Leading and
 * trailing blank lines of the original block are kept, so saving never
 * collapses the spacing between questions. */
export function questionLines(q: ParsedQuestion): string[] {
  const leading: string[] = [];
  for (const line of q.rawLines) {
    if (line.trim() === "") leading.push(line);
    else break;
  }
  const trailing: string[] = [];
  for (let i = q.rawLines.length - 1; i >= 0; i--) {
    if (q.rawLines[i].trim() === "") trailing.unshift(q.rawLines[i]);
    else break;
  }
  if (!q.edited) return [...q.rawLines, ...q.extraLines];
  const textLines = q.text.split("\n");
  // Question prompts end in a bare colon ("...questions :") when the
  // marks live elsewhere. Strip it before appending " : M", or the
  // regenerated line reads ": : 6".
  const first = `${q.number}. ${textLines[0] ?? ""}`.replace(/\s*:\s*$/, "");
  const rest = textLines.slice(1);
  let firstLine = first;
  let marksLine: string | null = null;
  if (q.marksStyle === "trailing") {
    if (q.marks !== null) firstLine = `${first} : ${q.marks}`;
  } else if (q.marksStyle === "bare") {
    if (q.marks !== null) marksLine = `${q.marks}`;
  } else if (q.marksStyle === "math") {
    // A maths marks line ("$2+8=10$") cannot be patched by number
    // without corrupting the sum, so an edited marks value moves to
    // the first line and the maths line is dropped.
    if (q.marks !== null && q.marks !== q.originalMarks) {
      firstLine = `${first} : ${q.marks}`;
    } else {
      marksLine = q.marksLine;
    }
  } else if (q.marks !== null) {
    firstLine = `${first} : ${q.marks}`;
  }
  const out = [...leading, firstLine, ...rest];
  if (marksLine !== null) {
    // Put the marks line back where it was (right after the first
    // line in every md seen so far); clamp to the end otherwise.
    out.splice(Math.min(leading.length + 1, out.length), 0, marksLine);
  }
  out.push(...trailing, ...q.extraLines);
  return out;
}

/** Reassemble md from a parse. Unedited blocks come back verbatim. */
export function reassembleMd(parsed: ParsedMd): string {
  const out: string[] = [];
  out.push(...parsed.headerLines);
  if (parsed.headerPage !== null) {
    out.push(`<!-- page ${parsed.headerPage} -->`);
  }
  const emitted = new Set<string>();
  for (const unit of parsed.units) {
    out.push(unit.headingRaw, ...unit.introLines);
    for (const q of unit.questions) {
      if (q.page !== null) out.push(`<!-- page ${q.page} -->`);
      out.push(...questionLines(q));
      emitted.add(q.key);
    }
  }
  // Questions before any UNIT heading have no unit to own them.
  for (const q of parsed.questions) {
    if (emitted.has(q.key)) continue;
    if (q.page !== null) out.push(`<!-- page ${q.page} -->`);
    out.push(...questionLines(q));
  }
  out.push(...parsed.trailingLines);
  return out.join("\n");
}

/** Replace one question's text (suggestion apply). False when missing. */
export function applyQuestionText(
  parsed: ParsedMd,
  key: string,
  newText: string,
): boolean {
  const q = parsed.questions.find((item) => item.key === key);
  if (!q) return false;
  q.text = newText;
  q.edited = true;
  return true;
}

/** Patch one header field line in place. False when the line is missing. */
export function updateHeaderField(
  parsed: ParsedMd,
  field: "fullMarks" | "passMarks" | "time",
  value: string,
): boolean {
  const pattern =
    field === "fullMarks"
      ? /full\s*marks\s*:\s*\d+/i
      : field === "passMarks"
        ? /pass\s*marks\s*:\s*\d+/i
        : /^\s*time\s*:\s*.+$/i;
  const idx = parsed.headerLines.findIndex((line) => pattern.test(line));
  if (idx === -1) return false;
  if (field === "time") {
    parsed.headerLines[idx] = parsed.headerLines[idx].replace(
      /:\s*.+$/,
      `: ${value}`,
    );
    parsed.header.time = value;
  } else {
    parsed.headerLines[idx] = parsed.headerLines[idx].replace(
      /:\s*\d+/,
      `: ${value}`,
    );
    if (field === "fullMarks") parsed.header.fullMarks = Number(value);
    else parsed.header.passMarks = Number(value);
  }
  return true;
}
