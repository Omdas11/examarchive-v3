/**
 * Tests for the question-paper md question index.
 *
 * Fixture is the real COMDSC-352T md (Consumer Behaviour, FYUG Even
 * Semester 2026) as the friend's AI delivered it — the same text the user
 * pasted in chat. String.raw keeps the `$2\times 2=4$` backslashes intact.
 */
import {
  buildQuestionIndex,
  parseIndexTable,
  parseQuestions,
  parseTranscriptToRows,
} from "./md-question-index";

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

const EXPECTED_LABELS = [
  "1(a)", "1(b)", "1(c)", "2(a)", "2(b)",
  "3(a)", "3(b)", "3(c)", "4(a)", "4(b)",
  "5(a)", "5(b)", "5(c)", "6(a)", "6(b)",
  "7(a)", "7(b)", "7(c)", "8(a)", "8(b)",
  "9(a)", "9(b)", "9(c)", "10(a)", "10(b)",
];

describe("parseTranscriptToRows on the real COMDSC-352T md", () => {
  const rows = parseTranscriptToRows(COMDSC_352T, "COMDSC-352T");

  test("25 rows, labels in order, paper's own numbering kept", () => {
    expect(rows.map((r) => r.label)).toEqual(EXPECTED_LABELS);
  });

  test("marks: 2 for the two-of-three groups, 10 for the one-of-two groups", () => {
    for (const row of rows) {
      const qNum = parseInt(row.label, 10);
      expect(row.marks).toBe(qNum % 2 === 1 ? 2 : 10);
    }
  });

  test("units I..V in order", () => {
    const units = rows.map((r) => r.unit);
    expect(units).toEqual([
      "I", "I", "I", "I", "I",
      "II", "II", "II", "II", "II",
      "III", "III", "III", "III", "III",
      "IV", "IV", "IV", "IV", "IV",
      "V", "V", "V", "V", "V",
    ]);
  });

  test("group: Answer any 2 for odd questions, Answer any 1 for even", () => {
    for (const row of rows) {
      const qNum = parseInt(row.label, 10);
      expect(row.group).toBe(
        qNum % 2 === 1 ? "Answer any 2" : "Answer any 1",
      );
    }
  });

  test("IDs unique, COMDSC-352T-Q<label>", () => {
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(25);
    for (const id of ids) {
      expect(id).toMatch(/^COMDSC-352T-Q\d+[a-d]$/);
    }
    expect(ids[0]).toBe("COMDSC-352T-Q1a");
    expect(ids[24]).toBe("COMDSC-352T-Q10b");
  });

  test("question text kept, trailing marks stripped, maths kept", () => {
    expect(rows[0].question).toBe("What is consumer behaviour?");
    expect(rows[3].question).toBe(
      "Discuss the role of motivation and perception in shaping consumer behaviour.",
    );
    expect(rows[4].question).toBe(
      "What is secondary data? Explain the criteria for evaluating secondary data.",
    );
  });
});

describe("buildQuestionIndex on the real COMDSC-352T md", () => {
  const out = buildQuestionIndex(COMDSC_352T, "COMDSC-352T");

  test("frontmatter present with all 8 fields filled from the header", () => {
    expect(out).toContain("paper_code: COMDSC-352T");
    expect(out).toContain("title: Consumer Behaviour");
    expect(out).toContain("exam: FYUG Even Semester Exam.");
    expect(out).toContain("year: 2026");
    expect(out).toContain("semester: 6");
    expect(out).toContain("subject: COMMERCE");
    expect(out).toContain("full_marks: 70");
    expect(out).toContain("pass_marks: 28");
    expect(out).toContain("time: 3 hours");
    expect(out.startsWith("---\n")).toBe(true);
  });

  test("transcript still present after regeneration", () => {
    expect(out).toContain("(a) What is consumer behaviour?");
    expect(out).toContain("Answer any two of the following questions");
    expect(out).toContain("UNIT—I");
    expect(out).toContain("$2\\times 2=4$");
  });

  test("index table at the end with 25 rows and the right columns", () => {
    expect(out).toContain("## Question index");
    expect(out).toContain(
      "| No. | Question | Marks | ID | Unit | Group | Keywords |",
    );
    expect(out).toContain(
      "| 1(a) | What is consumer behaviour? | 2 | COMDSC-352T-Q1a | I | Answer any 2 |",
    );
    expect(out).toContain(
      "| 2(a) | Discuss the role of motivation and perception in shaping consumer behaviour. | 10 | COMDSC-352T-Q2a | I | Answer any 1 |",
    );
    const tableRows = parseIndexTable(out);
    expect(tableRows.length).toBe(25);
  });

  test("idempotent: regenerating the converted file changes nothing", () => {
    expect(buildQuestionIndex(out, "COMDSC-352T")).toBe(out);
  });

  test("keywords already in the table survive regeneration", () => {
    const withKeywords = out.replace(
      "| 1(a) | What is consumer behaviour? | 2 | COMDSC-352T-Q1a | I | Answer any 2 |",
      "| 1(a) | What is consumer behaviour? | 2 | COMDSC-352T-Q1a | I | Answer any 2 | consumer behaviour, definition |",
    );
    const rebuilt = buildQuestionIndex(withKeywords, "COMDSC-352T");
    expect(rebuilt).toContain(
      "| 1(a) | What is consumer behaviour? | 2 | COMDSC-352T-Q1a | I | Answer any 2 | consumer behaviour, definition |",
    );
  });
});

describe("parseQuestions", () => {
  test("transcript rows with keywords merged in from the index table", () => {
    const converted = buildQuestionIndex(COMDSC_352T, "COMDSC-352T");
    const withKeywords = converted.replace(
      "| 1(a) | What is consumer behaviour? | 2 | COMDSC-352T-Q1a | I | Answer any 2 |",
      "| 1(a) | What is consumer behaviour? | 2 | COMDSC-352T-Q1a | I | Answer any 2 | consumer behaviour, definition |",
    );
    const rows = parseQuestions(withKeywords, "COMDSC-352T");
    expect(rows.length).toBe(25);
    expect(rows[0].keywords).toBe("consumer behaviour, definition");
    expect(rows[1].keywords).toBe("");
    expect(rows[0].group).toBe("Answer any 2");
  });

  test("frontmatter is never guessed: missing values stay out", () => {
    const md = `# Some Exam, 2025\n\nUNIT—I\n\n1. Answer any two of the following questions :\n$2\\times 2=4$\n(a) What is x?\n(b) What is y?`;
    const out = buildQuestionIndex(md, "XXXX-101T");
    expect(out).toContain("paper_code: XXXX-101T");
    expect(out).toContain("exam: Some Exam");
    expect(out).toContain("year: 2025");
    expect(out).not.toContain("pass_marks:");
    expect(out).not.toContain("full_marks:");
    expect(out).not.toContain("semester:");
    expect(out).not.toContain("subject:");
    expect(out).not.toContain("time:");
    expect(out).not.toContain("title:");
  });
});

describe("parser gaps fixed from the OCR pilot (2026-11-22)", () => {
  test("Bengali instruction with $2 x 4 = 8$ and Bengali digits", () => {
    const md = `UNIT—I\n\n১। যে কোনো দুটি প্রশ্নের উত্তর দাও : $2 x 4 = 8$\n\n(ক) বীরবাহু কে?\n\n(খ) মেঘনাদবধ কাব্য কী?\n\n২। যে কোনো একটি প্রশ্নের উত্তর দাও : ১০\n\n(ক) চতুর্থ সর্গ আলোচনা করো।`;
    const rows = parseTranscriptToRows(md, "BNGDSC201T");
    expect(rows.map((r) => r.label)).toEqual(["1(a)", "1(b)", "2(a)"]);
    expect(rows[0].group).toBe("Answer any 2");
    expect(rows[0].marks).toBe(2);
    expect(rows[2].group).toBe("Answer any 1");
    expect(rows[2].marks).toBe(10);
  });

  test("unnumbered instruction opens the next number; standalone $2 x 4 = 8$ gives its marks", () => {
    const md = `UNIT—I\n\nAnswer any two of the following questions :\n\n$2 x 4 = 8$\n\n(a) What is consumer behaviour?\n\n(b) What is consumer research?`;
    const rows = parseTranscriptToRows(md, "COMDSC-352T");
    expect(rows.map((r) => r.label)).toEqual(["1(a)", "1(b)"]);
    expect(rows[0].marks).toBe(2);
    expect(rows[0].group).toBe("Answer any 2");
  });

  test("'from the following' parses like 'of the following'", () => {
    const md = `UNIT—I\n\n1. Answer any *two* from the following : $2\\times 2 = 4$\n(a) State the change.\n(b) What is empowerment?`;
    const rows = parseTranscriptToRows(md, "COMDSC-202T");
    expect(rows.map((r) => r.label)).toEqual(["1(a)", "1(b)"]);
    expect(rows.every((r) => r.marks === 2)).toBe(true);
    expect(rows.every((r) => r.group === "Answer any 2")).toBe(true);
  });

  test("trailing $A+B=T$ is stripped from direct questions", () => {
    const md = `UNIT—IV\n\n11. What is potential appraisal? $2+8=10$\n\n12. What is base compensation? $5+5=10$`;
    const rows = parseTranscriptToRows(md, "COMDSC-202T");
    expect(rows.map((r) => [r.label, r.marks])).toEqual([
      ["11", 10],
      ["12", 10],
    ]);
    expect(rows[0].question).toBe("What is potential appraisal?");
  });

  test("'1. (a) ...' parses as sub-question 1(a)", () => {
    const rows = parseTranscriptToRows(
      "1. (a) What is x? (b) What is y?",
      "XXXX-101T",
    );
    expect(rows.map((r) => r.label)).toEqual(["1(a)", "1(b)"]);
  });

  test("standalone OR: both direct rows carry group OR", () => {
    const md = `UNIT—I\n\n2. Discuss the changes in HRM. 10\n\nOR\n\n3. Elaborate the modern functions of HRM. 10`;
    const rows = parseTranscriptToRows(md, "COMDSC-202T");
    expect(rows.map((r) => [r.label, r.group])).toEqual([
      ["2", "OR"],
      ["3", "OR"],
    ]);
  });

  test("OR with a (b) alternative: it inherits the marks and group OR", () => {
    const md = `UNIT—I\n\n2. Short question on ancient languages. 10\n\nOR\n\n(b) What is Prakrit?`;
    const rows = parseTranscriptToRows(md, "BNGHCC301T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["2", 10, "OR"],
      ["2(b)", 10, "OR"],
    ]);
  });

  test("inline '(a) X OR (b) Y': OR is stripped, both rows carry it in the group", () => {
    const md = `UNIT—I\n\n1. Answer any two of the following questions :\n$2\\times 2=4$\n(a) First question OR (b) Second question.`;
    const rows = parseTranscriptToRows(md, "XXXX-101T");
    expect(rows[0].question).toBe("First question");
    expect(rows[0].group).toBe("Answer any 2 (OR)");
    expect(rows[1].group).toBe("Answer any 2 (OR)");
  });

  test("'Course No.' anchors the frontmatter like 'Paper Code' does", () => {
    const md = `# FYUG Odd Semester Exam., 2024\n\n## COMMERCE\n### ( 3rd Semester )\n\n**Course No. : COMDSC–202T**\n**( Human Resource Management )**\n\n**Full Marks : 70**\n**Pass Marks : 28**\n**Time : 3 hours**\n\nUNIT—I\n\n1. Answer any two from the following : $2\\times 2 = 4$\n(a) State the change.\n(b) What is empowerment?`;
    const out = buildQuestionIndex(md, "COMDSC-202T");
    expect(out).toContain("subject: COMMERCE");
    expect(out).toContain("title: Human Resource Management");
    const fmBlock = out.split("---")[1];
    expect(fmBlock).toContain("time: 3 hours");
    expect(fmBlock).not.toContain("3 hours**");
  });
});

describe("parser gaps fixed from batch 3 (2026-11-22)", () => {
  test("(e) and (f) sub-questions parse, not only (a)-(d)", () => {
    const md = `UNIT—II\n\n4. Answer any four of the following questions : 1x4=4\n\n(a) Define ethnobotany.\n\n(b) What is the scientific name of Basak?\n\n(c) [illegible]\n\n(d) Name two dominant tribes of Meghalaya.\n\n(e) Name one medicinal use of turmeric.\n\n(f) Name the family to which Tulsi belongs.`;
    const rows = parseTranscriptToRows(md, "BOTIDC201T");
    expect(rows.map((r) => r.label)).toEqual([
      "4(a)",
      "4(b)",
      "4(c)",
      "4(d)",
      "4(e)",
      "4(f)",
    ]);
    expect(rows.every((r) => r.marks === 1)).toBe(true);
  });

  test("Bengali fifth sub-question (ঙ) parses", () => {
    const md = `UNIT—I\n\n১। যে কোনো চারটি প্রশ্নের উত্তর দাও : $1 \\times 4 = 4$\n\n(ক) প্রথম প্রশ্ন।\n\n(খ) দ্বিতীয় প্রশ্ন।\n\n(গ) তৃতীয় প্রশ্ন।\n\n(ঘ) চতুর্থ প্রশ্ন।\n\n(ঙ) পঞ্চম প্রশ্ন।`;
    const rows = parseTranscriptToRows(md, "BNGDSC101T");
    expect(rows.map((r) => r.label)).toEqual([
      "1(a)",
      "1(b)",
      "1(c)",
      "1(d)",
      "1(e)",
    ]);
  });

  test("bare (b) label line takes the next line as its text", () => {
    const md = `UNIT—III\n\n9. Answer any one of the following questions : 8\n\n(a) (i) First part. (ii) Second part.\n\n(b)\n\n(i) Find the maximum and minimum values. (ii) Find the intervals.`;
    const rows = parseTranscriptToRows(md, "MTMIDC201T");
    expect(rows.map((r) => r.label)).toEqual(["9(a)", "9(b)"]);
    expect(rows[1].question).toContain("Find the maximum and minimum");
    expect(rows[1].marks).toBe(8);
  });

  test("bare label followed by a new instruction does not swallow it", () => {
    const md = `UNIT—I\n\n1. Answer any four of the following questions : $1 \\times 4 = 4$\n\n(a) First.\n\n(b)\n\n2. Answer any one of the following questions : 2\n\n(a) Second question.`;
    const rows = parseTranscriptToRows(md, "XXXX-101T");
    expect(rows.map((r) => r.label)).toEqual(["1(a)", "2(a)"]);
    expect(rows[1].marks).toBe(2);
  });
});

describe("parser gaps fixed from batch 3, continued (2026-11-22)", () => {
  test("'Write a note on any one of the following : 2' is an instruction", () => {
    const md = `UNIT—II\n\n4. Answer any four of the following questions : 1x4=4\n\n(a) What is the full form of STD?\n\n(b) What is diabetes mellitus?\n\n5. Write a note on any one of the following : 2\n\n(a) Obesity\n\n(b) Gonorrhea\n\n6. Answer any one of the following questions : 8\n\n(a) Give an account of population control measures. 6+2=8`;
    const rows = parseTranscriptToRows(md, "ZOOIDC201T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["4(a)", 1, "Answer any 4"],
      ["4(b)", 1, "Answer any 4"],
      ["5(a)", 2, "Answer any 1"],
      ["5(b)", 2, "Answer any 1"],
      ["6(a)", 8, "Answer any 1"],
    ]);
  });
});

describe("parser gaps fixed from batch 4 (2026-11-22)", () => {
  test("three-term split totals read as marks (BOTDSC102T Q6b/Q8b/Q10a)", () => {
    const md = `UNIT—III\n\n6. Answer any one of the following :\n\n(a) With necessary example, describe the Ainsworth classification of fungi. **8+2=10**\n\n(b) Briefly discuss the affinities of fungi with plants and animals. **4+4+2=10**\n\nUNIT—IV\n\n8. Answer any one of the following :\n\n(a) Discuss the life cycle of Penicillium. 7+3\n\n(b) Discuss the reproduction in Agaricus. 6+3+1\n\nUNIT—V\n\n10. Answer any one of the following :\n\n(a) Discuss the role of fungi in production of enzymes. 4+3+3\n\n(b) Discuss the role of fungi in pharmaceutical preparation. 5+5`;
    const rows = parseTranscriptToRows(md, "BOTDSC102T");
    expect(rows.map((r) => [r.label, r.marks])).toEqual([
      ["6(a)", 10],
      ["6(b)", 10],
      ["8(a)", 10],
      ["8(b)", 10],
      ["10(a)", 10],
      ["10(b)", 10],
    ]);
  });

  test("four-term split total and doubled-dollar split (PHYDSM101T Q8/Q9b)", () => {
    const md = `UNIT—III\n\n8. What is central force? Prove the following for a particle moving under a central force :\n1+3+3+3=10\n\n(a) Angular momentum about the centre of force is a constant of motion.\n\n(b) The motion of the particle is always confined to a plane.\n\n(c) The areal velocity of the line joining the centre of force and the particle is a constant of motion.\n\n### OR\n\n9. (a) Find an expression for orbital velocity of a satellite.\n\n(b) What do you mean by weightlessness? State the necessary conditions for a satellite to be geostationary. Write a short note on global positioning system.\n\n$$2+2+1=5$$`;
    const rows = parseTranscriptToRows(md, "PHYDSM101T");
    expect(rows.map((r) => [r.label, r.marks])).toEqual([
      ["8", 10],
      ["8(a)", null],
      ["8(b)", null],
      ["8(c)", null],
      ["9(a)", null],
      ["9(b)", 5],
    ]);
  });

  test("two-term splits still read exactly as before", () => {
    const md = `UNIT—I\n\n1. Answer any two of the following questions : 2×2=4\n\n(a) First short.\n\n(b) Second short.\n\n2. Answer any one of the following questions :\n\n(a) First long. 7+3\n\n(b) Second long. $3+4$`;
    const rows = parseTranscriptToRows(md, "XXXX-101T");
    expect(rows.map((r) => [r.label, r.marks])).toEqual([
      ["1(a)", 2],
      ["1(b)", 2],
      ["2(a)", 10],
      ["2(b)", 7],
    ]);
  });

  test("standalone OR after a sub-part question does not mark the last part OR (PHYDSM101T Q8/Q9)", () => {
    const md = `UNIT—III\n\n8. What is central force? Prove the following for a particle moving under a central force :\n1+3+3+3=10\n\n(a) Angular momentum about the centre of force is a constant of motion. **3**\n\n(b) The motion of the particle is always confined to a plane. **3**\n\n(c) The areal velocity of the line joining the centre of force and the particle is a constant of motion. **3**\n\n### OR\n\n9. (a) Find an expression for orbital velocity of a satellite. **5**\n\n(b) What do you mean by weightlessness? **2+2+1=5**`;
    const rows = parseTranscriptToRows(md, "PHYDSM101T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["8", 10, ""],
      ["8(a)", 3, ""],
      ["8(b)", 3, ""],
      ["8(c)", 3, ""],
      ["9(a)", 5, "OR"],
      ["9(b)", 5, ""],
    ]);
  });
});

describe("parser gaps fixed from batch 7 (2026-11-22, PERIDC101T)", () => {
  test("Translate any + as-directed instructions are instructions, not phantom rows", () => {
    const md = `UNIT—V\n\n13. Translate any four of the following as directed : 1×4=4\n\n(a) Congratulation (into Persian)\n\n(b) College (into Persian)\n\n14. Translate any one of the following as directed : 2\n\n(a) Happy new year, good night (Turn into Persian)\n\n(b) Good morning (Turn into Persian)\n\n15. Answer any four as directed : 2×4=8\n\n(a) They were reading in the library. (Turn into Persian)\n\n(b) I came to college. (Turn into Persian)`;
    const rows = parseTranscriptToRows(md, "PERIDC101T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["13(a)", 1, "Answer any 4"],
      ["13(b)", 1, "Answer any 4"],
      ["14(a)", 2, "Answer any 1"],
      ["14(b)", 2, "Answer any 1"],
      ["15(a)", 2, "Answer any 4"],
      ["15(b)", 2, "Answer any 4"],
    ]);
  });

  test("either (a) or (b) is one question, count 1, no phantom row", () => {
    const md = `UNIT—I\n\n3. Answer the following questions either (a) or (b) : 8\n\n(a) What is Persian grammar?\n\n(b) Conjugate the verbs.`;
    const rows = parseTranscriptToRows(md, "PERIDC101T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["3(a)", 8, "Answer any 1"],
      ["3(b)", 8, "Answer any 1"],
    ]);
  });
});

describe("parser gaps fixed from batch 7 (2026-11-22, MANIDC101T)", () => {
  test("Manipuri instruction lines are instructions, not phantom rows", () => {
    // The য় in পীয়ু is written as \u09df (single codepoint U+09DF):
    // typing it risks the YA+nukta byte form, which never matches.
    const piyyu = "পী\u09dfু";
    const md = `UNIT—I\n\n১। মখাগী ৱাহংশিং অসিদগী ৪খক্তী পাউখুম ${piyyu} : ১×৪=৪\n\n(ক) কাসা পাউতাকপা হায়বসি করিনো ?\n\n(খ) করম্বা মচুগী য়েননা লোইমোম ফৌগৌনবগে ?\n\n২। মখাগী বাহং অসিদগী ১থক্কী পাউখুম ${piyyu} : ২\n\n(ক) য়ৈতৈ লৈবাকচা য়াকেবা উচেক অনীদু করি-করিনো?\n\n(খ) লাইগী জগোই শাবী হায়বগী বাহংছোক করিনো?`;
    const rows = parseTranscriptToRows(md, "MANIDC101T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 1, "Answer any 4"],
      ["1(b)", 1, "Answer any 4"],
      ["2(a)", 2, "Answer any 1"],
      ["2(b)", 2, "Answer any 1"],
    ]);
  });
});

describe("parser gaps fixed from batch 8 (2026-11-22, MANDSC202T/MANSEC201T)", () => {
  // The য় in পীয়ু is written as \u09df (single codepoint U+09DF):
  // typing it risks the YA+nukta byte form, which never matches.
  const piyyu = "পী\u09dfু";

  test("Manipuri bare count-word instructions are instructions, not phantom rows", () => {
    const md = `UNIT—I\n\n1. অনীদংগী পাউখুম ${piyyu} : $2 \\times 2 = 4$\n\n(a) First short question?\n\n(b) Second short question?\n\n(c) Third short question?\n\n2. অমতংগী পাউখুম ${piyyu} : ১০\n\n(a) First long question?\n\n(b) Second long question?`;
    const rows = parseTranscriptToRows(md, "MANDSC202T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 2, "Answer any 2"],
      ["1(b)", 2, "Answer any 2"],
      ["1(c)", 2, "Answer any 2"],
      ["2(a)", 10, "Answer any 1"],
      ["2(b)", 10, "Answer any 1"],
    ]);
    // The instruction's total K is recognised through the group:
    // 2 questions x 2 marks = 4, not the first number alone.
    expect(rows[0].group).toBe("Answer any 2");
    expect(rows[0].marks).toBe(2);
  });

  test("N×M=K marks read in every format: plain ২×২=৪ and $২\\times২=৪$", () => {
    const md = `UNIT—II\n\n3. অনীদংগী পাউখুম ${piyyu} : ২×২=৪\n\n(a) First?\n\n(b) Second?\n\n4. অনীদংগী পাউখুম ${piyyu} : $২\\times২=৪$\n\n(a) Third?\n\n(b) Fourth?`;
    const rows = parseTranscriptToRows(md, "MANDSC202T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["3(a)", 2, "Answer any 2"],
      ["3(b)", 2, "Answer any 2"],
      ["4(a)", 2, "Answer any 2"],
      ["4(b)", 2, "Answer any 2"],
    ]);
  });

  test("Manipuri মখাগী instructions with count words, verbs, and অসিগী", () => {
    const md = `UNIT—I\n\n1. মখাগী ৱাহংশিং অসিগী অতেনবা পাউখুম ${piyyu} : $1 \\times 3 = 3$\n\n(a) First short?\n\n(b) Second short?\n\n(c) Third short?\n\n(d) Fourth short?\n\n2. মখাগী ৱাহংশিং অসিদগী অমখক থল্লগা পাউখুম ${piyyu} : ২\n\n(a) First?\n\n(b) Second?\n\nUNIT—II\n\n4. মখাগী ৱাহংশিং অসিদগী অহুমথকী পাউখুম ${piyyu} : ১×৩=৩\n\n(a) One?\n\n(b) Two?\n\n(c) Three?\n\n(d) Four?`;
    const rows = parseTranscriptToRows(md, "MANSEC201T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 1, "Answer any 3"],
      ["1(b)", 1, "Answer any 3"],
      ["1(c)", 1, "Answer any 3"],
      ["1(d)", 1, "Answer any 3"],
      ["2(a)", 2, "Answer any 1"],
      ["2(b)", 2, "Answer any 1"],
      ["4(a)", 1, "Answer any 3"],
      ["4(b)", 1, "Answer any 3"],
      ["4(c)", 1, "Answer any 3"],
      ["4(d)", 1, "Answer any 3"],
    ]);
  });

  test("Manipuri খল্লগা/খঙনা verbs and অহুমখক্কী count word", () => {
    const md = `UNIT—III\n\n8. মখাগী ৱাহংশিং অসিদগী অমখক খল্লগা পাউখুম ${piyyu} : ২\n\n(a) First?\n\n(b) Second?\n\n10. মখাগী ৱাহংশিং অসিদগী অহুমখক্কী পাউখুম ${piyyu} : ১×৩=৩\n\n(a) One?\n\n(b) Two?\n\n14. মখাগী ৱাহংশিং অসিগী অমখক খঙনা পাউখুম ${piyyu} : ৫\n\n(a) First?\n\n(b) Second?`;
    const rows = parseTranscriptToRows(md, "MANSEC201T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["8(a)", 2, "Answer any 1"],
      ["8(b)", 2, "Answer any 1"],
      ["10(a)", 1, "Answer any 3"],
      ["10(b)", 1, "Answer any 3"],
      ["14(a)", 5, "Answer any 1"],
      ["14(b)", 5, "Answer any 1"],
    ]);
  });
});

describe("parser gaps fixed from batch 9 (2026-11-22, MTMSEC201T)", () => {
  test("bare 'Answer any three questions : $1 \\times 3 = 3$' is an instruction, not a phantom row", () => {
    const md = `UNIT—I\n\n1. Answer any three questions : $1 \\times 3 = 3$\n\n(a) Define absolute error.\n\n(b) Evaluate the sum.\n\n(c) Define shift operator.\n\n2. Answer any one question : 2\n\n(a) Write down the value of pi.\n\n(b) Prove the identity.\n\n3. Answer any one question : 5\n\n(a) Find the relative error.\n\n(b) Find the polynomial.`;
    const rows = parseTranscriptToRows(md, "MTMSEC201T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 1, "Answer any 3"],
      ["1(b)", 1, "Answer any 3"],
      ["1(c)", 1, "Answer any 3"],
      ["2(a)", 2, "Answer any 1"],
      ["2(b)", 2, "Answer any 1"],
      ["3(a)", 5, "Answer any 1"],
      ["3(b)", 5, "Answer any 1"],
    ]);
  });

  test("bare form with no colon and no marks is still an instruction", () => {
    const md = `UNIT—I\n\n1. Answer any three questions\n\n(a) First?\n\n(b) Second?\n\n(c) Third?`;
    const rows = parseTranscriptToRows(md, "MTMSEC201T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", null, "Answer any 3"],
      ["1(b)", null, "Answer any 3"],
      ["1(c)", null, "Answer any 3"],
    ]);
  });

  test("bare form with plain 1x3=3 marks and a digit count word", () => {
    const md = `UNIT—II\n\n4. Answer any three questions : 1x3=3\n\n(a) One?\n\n(b) Two?\n\n(c) Three?\n\n5. Answer any 2 questions : 2x2=4\n\n(a) First?\n\n(b) Second?`;
    const rows = parseTranscriptToRows(md, "MTMSEC201T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["4(a)", 1, "Answer any 3"],
      ["4(b)", 1, "Answer any 3"],
      ["4(c)", 1, "Answer any 3"],
      ["5(a)", 2, "Answer any 2"],
      ["5(b)", 2, "Answer any 2"],
    ]);
  });

  test("two backslashes in the marks still give marks null (batch 7 rule)", () => {
    const md = `UNIT—I\n\n1. Answer any three questions : $1 \\\\times 3 = 3$\n\n(a) First?\n\n(b) Second?\n\n(c) Third?`;
    const rows = parseTranscriptToRows(md, "MTMSEC201T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", null, "Answer any 3"],
      ["1(b)", null, "Answer any 3"],
      ["1(c)", null, "Answer any 3"],
    ]);
  });
});

describe("parser gaps fixed from batch 11 (2026-11-22, BNGIDC201T)", () => {
  test("'অতি সংক্ষিপ্ত' instructions in both positions are instructions, not phantom rows", () => {
    const md = `UNIT—I\n\n1. যে কোনো চারটি প্রশ্নের অতি সংক্ষিপ্ত উত্তর দাও : ১×৪=৪\n\n(a) মুসাফির কত বছর প্রভুকে ডাকেনি?\n\n(b) 'সাম্যবাদী' কবিতায় উল্লেখিত যে কোনো একটি তীর্থস্থানের নাম উল্লেখ করো।\n\n(c) 'সাম্যবাদী' কাব্যগ্রন্থটির প্রকাশকাল কত?\n\n(d) 'আবার আসিব ফিরে' কবিতায় উল্লেখিত যে কোনো একটি পাখির নাম লেখো। (ঙ) 'বাংলার মুখ আমি দেখিয়াছি' কবিতায় ডুমুরের গাছের নিচে কবি কোন্ পাখিকে বসে থাকতে দেখেছিলেন?\n\nUNIT—II\n\n4. যে কোনো চারটি অতি সংক্ষিপ্ত প্রশ্নের উত্তর দাও : ১ × ৪ = ৪\n\n(a) ‘হারানের নাতজামাই’ গল্পটি কোন্ আন্দোলনের পটভূমিতে রচিত?\n\n(b) ‘কুষ্ঠরোগীর বউ’ গল্পে যতীনের স্ত্রীর নাম কী?\n\n(c) পরশুরামের আসল নাম কী?\n\n(d) ‘শ্রী শ্রী সিদ্ধেশ্বরী লিমিটেড’ গল্পের যে কোনো একটি চরিত্রের নাম লেখো। (ঙ) ‘লম্বকর্ণ’ গল্পটি কোন্ গল্পগ্রন্থের অন্তর্গত?`;
    const rows = parseTranscriptToRows(md, "BNGIDC201T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 1, "Answer any 4"],
      ["1(b)", 1, "Answer any 4"],
      ["1(c)", 1, "Answer any 4"],
      ["1(d)", 1, "Answer any 4"],
      ["1(e)", 1, "Answer any 4"],
      ["4(a)", 1, "Answer any 4"],
      ["4(b)", 1, "Answer any 4"],
      ["4(c)", 1, "Answer any 4"],
      ["4(d)", 1, "Answer any 4"],
      ["4(e)", 1, "Answer any 4"],
    ]);
    expect(rows[4].question).toContain("ডুমুরের গাছের নিচে");
    expect(rows[9].question).toContain("লম্বকর্ণ");
    expect(rows[4].id).toBe("BNGIDC201T-Q1e");
    expect(rows[9].id).toBe("BNGIDC201T-Q4e");
  });

  test("plain 'যে কোনো ... প্রশ্নের উত্তর দাও' still parses (no regression)", () => {
    const md = `UNIT—I\n\n১। যে কোনো চারটি প্রশ্নের উত্তর দাও : $1 \\times 4 = 4$\n\n(ক) প্রথম প্রশ্ন।\n\n(খ) দ্বিতীয় প্রশ্ন।\n\n(গ) তৃতীয় প্রশ্ন।\n\n(ঘ) চতুর্থ প্রশ্ন।`;
    const rows = parseTranscriptToRows(md, "BNGDSC101T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 1, "Answer any 4"],
      ["1(b)", 1, "Answer any 4"],
      ["1(c)", 1, "Answer any 4"],
      ["1(d)", 1, "Answer any 4"],
    ]);
  });
});

describe("parser gaps fixed from batch 12 (2026-11-22, CHMDSC252/CHMDSM252/BOTDSM301)", () => {
  test("unnumbered 'Answer any one : 10' spans two numbered questions (CHMDSC252)", () => {
    const md = `UNIT—I\n\n1. Answer any two of the following questions : $2 \\times 2 = 4$\n\n(a) First short.\n\n(b) Second short.\n\n(c) Third short.\n\nAnswer any one of the following questions : 10\n\n2. (a) (i) Count the electrons. 2 (ii) Give an example. 3 $2+3=5$\n\n(b) (i) Compare stabilities. 3 (ii) Discuss classification. 2 $3+2=5$\n\n3. (a) Complete the following reactions : $1\\times 5=5$ 5\n\n(b) Mention one method. 2\n\n(c) Discuss stability. 3`;
    const rows = parseTranscriptToRows(md, "CHMDSC252");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 2, "Answer any 2"],
      ["1(b)", 2, "Answer any 2"],
      ["1(c)", 2, "Answer any 2"],
      ["2(a)", 5, "Answer any 1"],
      ["2(b)", 5, "Answer any 1"],
      ["3(a)", 5, "Answer any 1"],
      ["3(b)", 2, "Answer any 1"],
      ["3(c)", 3, "Answer any 1"],
    ]);
  });

  test("group does not leak into the next numbered question after a numbered instruction", () => {
    const md = `UNIT—I\n\n2. Answer any one question [either (a) or (b)] of the following : 10\n\n(a) First alternative.\n\n(b) Second alternative.\n\n3. (a) New question part one. 5\n\n(b) New question part two. 5`;
    const rows = parseTranscriptToRows(md, "CHMDSM252");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["2(a)", 10, "Answer any 1"],
      ["2(b)", 10, "Answer any 1"],
      ["3(a)", 5, ""],
      ["3(b)", 5, ""],
    ]);
  });

  test("merged (i)/(ii) row carries the sum, not one part (CHMDSM252 Q10)", () => {
    const md = `UNIT—V\n\n10. Answer any one question [either (a) or (b)] of the following : \\hfill 10\n\n(a) (i) Discuss the SN1 mechanism. \\hfill 2+2+2=6\n\n(b) (i) Treatment of 2-bromobutane. $$(1/2\\times 4)+4=6$$ (ii) Discuss briefly. $$2+2=4$$ $6+4=10$`;
    const rows = parseTranscriptToRows(md, "CHMDSM252");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["10(a)", 10, "Answer any 1"],
      ["10(b)", 10, "Answer any 1"],
    ]);
  });

  test("'$1\\\\times 5=5$' on a sub-row reads as 5, not 1 (CHMDSC252 Q3a)", () => {
    const md = `UNIT—I\n\nAnswer any one of the following questions : 10\n\n2. (a) First long. 5\n\n(b) Second long. 5\n\n3. (a) Complete the following reactions : $1\\times 5=5$\n\n(b) Mention one method. 2\n\n(c) Discuss stability. 3`;
    const rows = parseTranscriptToRows(md, "CHMDSC252");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["2(a)", 5, "Answer any 1"],
      ["2(b)", 5, "Answer any 1"],
      ["3(a)", 5, "Answer any 1"],
      ["3(b)", 2, "Answer any 1"],
      ["3(c)", 3, "Answer any 1"],
    ]);
  });

  test("bare '5×2=10' on a sub-row reads as 10, not 5 (BOTDSM301-A Q8b)", () => {
    const md = `UNIT—IV\n\n8. Answer any one question :\n\n(a) Write in detail about the TCA cycle. 8+2=10\n\n(b) Write short notes on the following : 5×2=10`;
    const rows = parseTranscriptToRows(md, "BOTDSM301");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["8(a)", 10, "Answer any 1"],
      ["8(b)", 10, "Answer any 1"],
    ]);
  });

  test("standalone '5×2=10' line under a question is that question's total", () => {
    const md = `UNIT—IV\n\n8. Answer any one question :\n\n(a) Write in detail about the TCA cycle. 8+2=10\n\n(b) Write short notes on the following :\n\n5×2=10`;
    const rows = parseTranscriptToRows(md, "BOTDSM301");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["8(a)", 10, "Answer any 1"],
      ["8(b)", 10, "Answer any 1"],
    ]);
  });

  test("group does not carry across a UNIT boundary", () => {
    const md = `UNIT—I\n\nAnswer any one of the following questions : 10\n\n2. (a) First. 5\n\n(b) Second. 5\n\nUNIT—II\n\n3. (a) New unit part one. 5\n\n(b) New unit part two. 5`;
    const rows = parseTranscriptToRows(md, "CHMDSC252");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["2(a)", 5, "Answer any 1"],
      ["2(b)", 5, "Answer any 1"],
      ["3(a)", 5, ""],
      ["3(b)", 5, ""],
    ]);
  });

  test("unnumbered bare instruction followed by parts keeps the total per part (PERIDC Q8)", () => {
    const md = `UNIT—III\n\n7. Answer any four of the following questions : 1x4=4\n\n(a) First.\n\n(b) Second.\n\n(c) Third.\n\n(d) Fourth.\n\nAnswer any one of the following questions : 2\n\n(a) Mention the names of Bihu festivals celebrated in Assam.\n\n(b) What are the things the throne of King Jamshid made of?`;
    const rows = parseTranscriptToRows(md, "PERIDC101T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["7(a)", 1, "Answer any 4"],
      ["7(b)", 1, "Answer any 4"],
      ["7(c)", 1, "Answer any 4"],
      ["7(d)", 1, "Answer any 4"],
      ["8(a)", 2, "Answer any 1"],
      ["8(b)", 2, "Answer any 1"],
    ]);
  });
});
