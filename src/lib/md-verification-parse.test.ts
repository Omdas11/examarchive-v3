/**
 * Tests for the md parser (md-verification-parse). The main fixture is
 * the real md of item 5578f487 (COMDSC-352T, batch 1), read from D1
 * 2026-11-21 — round-trip must return it byte-for-byte.
 */
import {
  applyQuestionText,
  parseMd,
  reassembleMd,
  updateHeaderField,
} from "./md-verification-parse";

const REAL_MD = `# FYUG Even Semester Exam., 2026

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
$2\\times 2=4$
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
$2\\times 2=4$
(a) State the influences of family on consumer behaviour.
(b) What is reference group?
(c) What is value?

4. Answer any one of the following questions : 10
(a) How do social and cultural environments shape consumer preferences? Explain.
(b) Analyze the role of personality traits in shaping consumer preferences.

UNIT—III

5. Answer any two of the following questions :
$2\\times 2=4$
(a) What is consumer decision making?
(b) What is cognitive dissonance?
(c) What is routine buying behaviour?

6. Answer any one of the following questions : 10
(a) Discuss, in detail, the five stages of the consumer decision making process.
(b) Evaluate the role of marketing strategies at each stage of the buying process.

UNIT—IV

7. Answer any two of the following questions :
$2\\times 2=4$
(a) State two needs of consumer motivation.
(b) State the goal of consumer motivation.
(c) What is motive arousal?

8. Answer any one of the following questions : 10
(a) Explain how id, ego and superego influence consumer motivation.
(b) Explain the different types of self-images and their influence on buying behaviour.

UNIT—V

9. Answer any two of the following questions :
$2\\times 2=4$
(a) What is interpersonal communication?
(b) What is persuasive communication?
(c) State the key features of Black Box Model.

10. Answer any one of the following questions : 10
(a) Analyze the relevance of Howard and Sheth Model in modern marketing.
(b) Delineate the provisions regarding the rights of consumer as per the Consumer Protection Act, 1986.
`;

describe("parseMd on the real COMDSC-352T md", () => {
  it("finds 10 questions in 5 units with header fields", () => {
    const parsed = parseMd(REAL_MD);
    expect(parsed.hasQuestions).toBe(true);
    expect(parsed.questions).toHaveLength(10);
    expect(parsed.units.map((u) => u.label)).toEqual([
      "I",
      "II",
      "III",
      "IV",
      "V",
    ]);
    expect(parsed.header.paperCode).toBe("COMDSC-352T");
    expect(parsed.header.fullMarks).toBe(70);
    expect(parsed.header.passMarks).toBe(28);
    expect(parsed.header.time).toBe("3 hours");
  });

  it("reads marks from all three places", () => {
    const parsed = parseMd(REAL_MD);
    const q1 = parsed.questions[0];
    expect(q1.marks).toBe(4);
    expect(q1.marksStyle).toBe("math");
    const q2 = parsed.questions[1];
    expect(q2.marks).toBe(10);
    expect(q2.marksStyle).toBe("trailing");
    const q4 = parsed.questions[3];
    expect(q4.marks).toBe(10);
    expect(q4.marksStyle).toBe("trailing");
  });

  it("keeps sub-parts inside the question text", () => {
    const parsed = parseMd(REAL_MD);
    expect(parsed.questions[0].text).toContain(
      "(a) What is consumer behaviour?",
    );
    expect(parsed.questions[0].text).toContain(
      "(c) State two tools used in analyzing data.",
    );
  });

  it("round-trips the real md byte-for-byte", () => {
    expect(reassembleMd(parseMd(REAL_MD))).toBe(REAL_MD);
  });
});

describe("page markers", () => {
  const md = [
    "# Test Paper",
    "",
    "Full Marks : 10",
    "",
    "1. First question : 5",
    "<!-- page 2 -->",
    "2. Second question : 5",
    "",
  ].join("\n");

  it("attaches a marker to the next question and keeps it on save", () => {
    const parsed = parseMd(md);
    expect(parsed.questions[0].page).toBeNull();
    expect(parsed.questions[1].page).toBe(2);
    expect(reassembleMd(parsed)).toBe(md);
  });
});

describe("edits", () => {
  it("an edited card changes only that card", () => {
    const parsed = parseMd(REAL_MD);
    const q1 = parsed.questions[0];
    q1.text = q1.text.replace(
      "(a) What is consumer behaviour?",
      "(a) What is consumer behaviour, exactly?",
    );
    q1.edited = true;
    const out = reassembleMd(parsed);
    expect(out).toContain("consumer behaviour, exactly?");
    expect(out).toContain("(b) What is consumer research?");
    expect(out).toContain("(c) State two tools used in analyzing data.");
    expect(out).toContain("Howard and Sheth Model");
    expect(out).not.toContain("(a) What is consumer behaviour?\n");
  });

  it("editing marks on a maths-marks question moves them to the first line", () => {
    const parsed = parseMd(REAL_MD);
    const q1 = parsed.questions[0];
    q1.marks = 6;
    q1.edited = true;
    const out = reassembleMd(parsed);
    expect(out).toContain(
      "1. Answer any two of the following questions : 6",
    );
    // Q1's maths marks line is gone; the other four questions keep theirs.
    expect(out.split("$2\\times 2=4$").length - 1).toBe(4);
  });

  it("patches a header field in place", () => {
    const parsed = parseMd(REAL_MD);
    expect(updateHeaderField(parsed, "fullMarks", "75")).toBe(true);
    const out = reassembleMd(parsed);
    expect(out).toContain("Full Marks : 75");
    expect(out).toContain("Pass Marks : 28");
    expect(out).not.toContain("Full Marks : 70");
  });

  it("applyQuestionText replaces one question by key", () => {
    const parsed = parseMd(REAL_MD);
    expect(applyQuestionText(parsed, "q3", "New text for Q3")).toBe(true);
    expect(applyQuestionText(parsed, "q99", "Nope")).toBe(false);
    const out = reassembleMd(parsed);
    expect(out).toContain("New text for Q3");
    // Applying replaces the whole question text; the next question
    // is untouched.
    expect(out).toContain(
      "(a) How do social and cultural environments shape consumer preferences? Explain.",
    );
  });
});

describe("messy md", () => {
  it("md with no questions falls back cleanly", () => {
    const md = "Just some notes\nno questions here\n";
    const parsed = parseMd(md);
    expect(parsed.hasQuestions).toBe(false);
    expect(parsed.questions).toHaveLength(0);
    expect(reassembleMd(parsed)).toBe(md);
  });

  it("a question before any UNIT heading is kept", () => {
    const md = "1. Lone question : 5\nSome text.\n";
    const parsed = parseMd(md);
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0].unit).toBeNull();
    expect(reassembleMd(parsed)).toBe(md);
  });
});
