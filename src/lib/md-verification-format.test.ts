/**
 * Tests for the question-paper md formatter.
 *
 * Fixture is the real COMDSC-352T md (Consumer Behaviour, FYUG Even
 * Semester 2026) as the friend's AI delivered it — the same text the user
 * pasted in chat. String.raw keeps the `$2\times 2=4$` backslashes intact.
 */
import { formatQuestionMd } from "./md-verification-format";

const COMDSC_352T = String.raw`# FYUG Even Semester Exam., 2026

COMMERCE
( 6th Semester )

Paper Code : COMDSC-352T
( Consumer Behaviour )

Full Marks : 70
Pass Marks : 28

Time : 3 hours

The figures in the margin indicate full marks for the questions.

UNIT—I

1. Answer any two of the following questions :
$2\times 2=4$
(a) What is consumer behaviour?
(b) What is consumer research?
(c) State two tools used in analyzing data.

2. Answer any one of the following questions : 10
(a) Discuss the role of motivation and perception in shaping consumer behaviour.
10
(b) What is secondary data? Explain the criteria for evaluating secondary data.
$2+8=10$

UNIT—II

3. Answer any two of the following questions :
$2\times 2=4$
(a) State the influences of family on consumer behaviour.
(b) What is reference group?
(c) What is value?

4. Answer any one of the following questions : 10
(a) How do social and cultural environments shape consumer preferences? Explain.
(b) Analyze the role of personality traits in shaping consumer preferences.

UNIT—III

5. Answer any two of the following questions :
$2\times 2=4$
(a) What is consumer decision making?
(b) What is cognitive dissonance?
(c) What is routine buying behaviour?

6. Answer any one of the following questions : 10
(a) Discuss, in detail, the five stages of the consumer decision making process.
(b) Evaluate the role of marketing strategies at each stage of the buying process.

UNIT—IV

7. Answer any two of the following questions :
$2\times 2=4$
(a) State two needs of consumer motivation.
(b) State the goal of consumer motivation.
(c) What is motive arousal?

8. Answer any one of the following questions : 10
(a) Explain how id, ego and superego influence consumer motivation.
(b) Explain the different types of self-images and their influence on buying behaviour.

UNIT—V

9. Answer any two of the following questions :
$2\times 2=4$
(a) What is interpersonal communication?
(b) What is persuasive communication?
(c) State the key features of Black Box Model.

10. Answer any one of the following questions : 10
(a) Analyze the relevance of Howard and Sheth Model in modern marketing.
(b) Delineate the provisions regarding the rights of consumer as per the Consumer Protection Act, 1986.`;

const stripWhitespace = (s: string) => s.replace(/\s+/g, "");

describe("formatQuestionMd on the real COMDSC-352T md", () => {
  const formatted = formatQuestionMd(COMDSC_352T);

  test("no words, numbers or maths lost — same non-whitespace content", () => {
    expect(stripWhitespace(formatted)).toBe(stripWhitespace(COMDSC_352T));
  });

  test("idempotent: formatting the formatted md changes nothing", () => {
    expect(formatQuestionMd(formatted)).toBe(formatted);
  });

  test("$...$ maths preserved exactly", () => {
    expect(formatted).toContain("$2\\times 2=4$");
    expect(formatted).toContain("$2+8=10$");
  });

  test("each sub-question on its own line", () => {
    for (const line of formatted.split("\n")) {
      const markers = line.match(/\([a-d]\)/g) ?? [];
      expect(markers.length).toBeLessThanOrEqual(1);
    }
    expect(formatted).toContain("(a) What is consumer behaviour?");
    expect(formatted).toContain("(b) What is consumer research?");
    expect(formatted).toContain("(c) State two tools used in analyzing data.");
  });

  test("lone marks line joins the question above it", () => {
    expect(formatted.split("\n")).not.toContain("10");
    expect(formatted).toContain(
      "(a) Discuss the role of motivation and perception in shaping consumer behaviour. 10",
    );
  });

  test("header labels lose the space before the colon", () => {
    expect(formatted).toContain("Paper Code: COMDSC-352T");
    expect(formatted).toContain("Full Marks: 70");
    expect(formatted).toContain("Pass Marks: 28");
    expect(formatted).toContain("Time: 3 hours");
    expect(formatted).not.toContain("Paper Code :");
    expect(formatted).not.toContain("Full Marks :");
    expect(formatted).not.toContain("Pass Marks :");
    expect(formatted).not.toContain("Time :");
  });

  test("UNIT headings left exactly as they are", () => {
    for (const unit of ["UNIT—I", "UNIT—II", "UNIT—III", "UNIT—IV", "UNIT—V"]) {
      expect(formatted).toContain(unit);
    }
  });

  test("every logical line is its own paragraph (no single newlines left)", () => {
    expect(formatted).not.toMatch(/[^\n]\n[^\n]/);
  });
});

describe("formatQuestionMd on messy input", () => {
  test("sub-questions sharing one line are split apart", () => {
    const out = formatQuestionMd(
      "1. Answer any two: (a) What is x? (b) What is y? (c) State two tools.",
    );
    expect(out).toContain("1. Answer any two:\n\n(a) What is x?");
    expect(out).toContain("(b) What is y?");
    expect(out).toContain("(c) State two tools.");
  });

  test("empty input stays empty", () => {
    expect(formatQuestionMd("")).toBe("");
    expect(formatQuestionMd("  \n\n  ")).toBe("");
  });

  test("'1. (a) ...' is not split from its first sub-question", () => {
    const out = formatQuestionMd("1. (a) What is x? (b) What is y?");
    expect(out).toContain("1. (a) What is x?");
    expect(out).not.toContain("1.\n\n(a) What is x?");
  });

  test("Bengali sub-question markers are split; a lone Bengali marks line joins its question", () => {
    const out = formatQuestionMd("(ক) প্রথম প্রশ্ন? (খ) দ্বিতীয় প্রশ্ন?\n১০");
    expect(out).toContain("(ক) প্রথম প্রশ্ন?");
    expect(out).toContain("(খ) দ্বিতীয় প্রশ্ন? ১০");
  });
});
