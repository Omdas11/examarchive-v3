/**
 * Deterministic formatter for question-paper markdown (no AI, no network).
 *
 * The md these papers arrive with uses single newlines between lines, which
 * standard markdown collapses into one flowing paragraph — so "Full Marks :
 * 70 Pass Marks : 28" and the (a)/(b)/(c) sub-questions all run together in
 * the preview. This puts every logical line on its own paragraph, splits
 * sub-questions that share a line, and joins a lone marks line (a line that
 * is just "10") to the question above it.
 *
 * Only whitespace and line breaks change: no words, numbers, or `$...$`
 * maths are ever touched, and UNIT—I / UNIT—II style headings are left
 * exactly as they are. Formatting already-formatted md changes nothing.
 * The result is draft-only — nothing is saved until the user presses
 * Save draft or Submit.
 */

// A sub-question marker (a), (b), (c), (d) — or Bengali (ক), (খ), (গ), (ঘ) —
// that starts a new sub-question. Split on the whitespace before a marker
// that appears mid-line and is followed by a letter or digit — a real
// question start, not a parenthetical aside. The marker stays attached to
// its own text: the split point is the whitespace, checked by a lookahead.
const SUB_QUESTION_SPLIT =
  /\s+(?=\([a-dকখগঘ]\)\s+[\u0980-\u09FFA-Z0-9])/g;

// A line that is only a number is a marks line that lost its question.
const LONE_MARKS = /^[\d০-৯]+$/;

// A bare question number on its own ("1." / "১।") belongs with the
// sub-question that follows it on the same line — it is not a line of
// its own.
const BARE_QUESTION_NUMBER = /^[\d০-৯]+\s*[।.]$/;

// "Paper Code :" -> "Paper Code:" (and the same for the other header labels).
const HEADER_COLON =
  /\b(Paper Code|Course No\.|Full Marks|Pass Marks|Time)\s+:/g;

export function formatQuestionMd(md: string): string {
  // 1. Split into logical lines; sub-questions sharing a line get their own.
  const lines: string[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    // The split regex is lookahead-only, so each part starts with its
    // marker and keeps its text.
    const parts = line
      .split(SUB_QUESTION_SPLIT)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      // A bare question number ("1." / "১।") belongs with the
      // sub-question that follows it — "1. (a) ..." must not become
      // "1." on one line and "(a) ..." on the next, or the parser
      // loses the sub-question entirely.
      const last = lines[lines.length - 1];
      if (
        last !== undefined &&
        BARE_QUESTION_NUMBER.test(last) &&
        /^\([a-dকখগঘ]\)/.test(part)
      ) {
        lines[lines.length - 1] = `${last} ${part}`;
      } else {
        lines.push(part);
      }
    }
  }

  // 2. A lone marks line joins the line above it, so marks sit with their
  // question instead of on a line of their own.
  const merged: string[] = [];
  for (const line of lines) {
    if (LONE_MARKS.test(line) && merged.length > 0) {
      merged[merged.length - 1] += ` ${line}`;
    } else {
      merged.push(line);
    }
  }

  // 3. Normalise the space before the colon on header labels.
  const normalised = merged.map((line) => line.replace(HEADER_COLON, "$1:"));

  if (normalised.length === 0) return "";
  // 4. One blank line between every logical line, so each renders on its
  // own line in the preview instead of collapsing into one paragraph.
  return normalised.join("\n\n") + "\n";
}
