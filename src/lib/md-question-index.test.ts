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

describe("parser gaps fixed from batch 14 (2026-11-22, ENGDSC252/ENGSEC101T)", () => {
  test("'Define any seven ...' is an instruction; (i)/(j) after (h) are rows (ENGDSC252 Q1)", () => {
    const md = `UNIT—I\n\n1. Define any seven of the following terms : $2 \\times 7 = 14$\n\n(a) Patriarchy\n\n(b) Stereotyping\n\n(c) Misogyny\n\n(d) Gynocriticism\n\n(e) Dalit feminism\n\n(f) Gaze\n\n<!-- page 2 -->\n\n(g) Abjection\n\n(h) Matrocentric\n\n(i) Androgyny\n\n(j) Binary oppositions`;
    const rows = parseTranscriptToRows(md, "ENGDSC252");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 2, "Answer any 7"],
      ["1(b)", 2, "Answer any 7"],
      ["1(c)", 2, "Answer any 7"],
      ["1(d)", 2, "Answer any 7"],
      ["1(e)", 2, "Answer any 7"],
      ["1(f)", 2, "Answer any 7"],
      ["1(g)", 2, "Answer any 7"],
      ["1(h)", 2, "Answer any 7"],
      ["1(i)", 2, "Answer any 7"],
      ["1(j)", 2, "Answer any 7"],
    ]);
    // No direct "1" row: the instruction is the rule, not a question.
    expect(rows.some((r) => r.label === "1")).toBe(false);
    expect(rows[8].question).toBe("Androgyny");
    expect(rows[8].id).toBe("ENGDSC252-Q1i");
    expect(rows[9].question).toBe("Binary oppositions");
    expect(rows[9].id).toBe("ENGDSC252-Q1j");
  });

  test("MCQ (i)/(ii) options with no (a)-(h) sequence are not rows (ENGSEC101T)", () => {
    const md = `UNIT—I\n\n1. Answer any three of the following questions : $1 \\times 3 = 3$\n\n(a) What is entrepreneur business?\n\n(b) Give an example of entrepreneurship business of Assam.\n\n(c) Make sentences to show the difference between the following words :\n\n(i) Stationary (ii) Stationery\n\n(d) Add suffixes to the following verbs to transform them into adjectives :\n\n(i) Create (ii) Depend\n\n2. Answer any one of the following questions : 2\n\n(a) Mention two barriers that can affect listening.`;
    const rows = parseTranscriptToRows(md, "ENGSEC101T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 1, "Answer any 3"],
      ["1(b)", 1, "Answer any 3"],
      ["1(c)", 1, "Answer any 3"],
      ["1(d)", 1, "Answer any 3"],
      ["2(a)", 2, "Answer any 1"],
    ]);
  });

  test("a bare '(i)' label after (h) takes the next line as its text", () => {
    const md = `UNIT—I\n\n1. Define any three of the following terms : $1 \\times 3 = 3$\n\n(a) First term.\n\n(b) Second term.\n\n(g) Seventh term.\n\n(h) Eighth term.\n\n(i)\n\nNinth term.\n\n(j) Tenth term.`;
    const rows = parseTranscriptToRows(md, "ENGDSC252");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 1, "Answer any 3"],
      ["1(b)", 1, "Answer any 3"],
      ["1(g)", 1, "Answer any 3"],
      ["1(h)", 1, "Answer any 3"],
      ["1(i)", 1, "Answer any 3"],
      ["1(j)", 1, "Answer any 3"],
    ]);
    expect(rows[4].question).toBe("Ninth term.");
  });

  test("a '(j)' with no preceding (i) is not a row", () => {
    const md = `UNIT—I\n\n1. Define any two of the following terms : $1 \\times 2 = 2$\n\n(a) First term.\n\n(h) Eighth term.\n\n(j) Tenth term.\n\n(b) Second term.`;
    const rows = parseTranscriptToRows(md, "ENGDSC252");
    expect(rows.map((r) => r.label)).toEqual(["1(a)", "1(h)", "1(b)"]);
  });

  test("an (i) line after a new numbered question is not that question's part", () => {
    const md = `UNIT—I\n\n1. Define any seven of the following terms : $2 \\times 7 = 14$\n\n(a) Patriarchy\n\n(h) Matrocentric\n\n2. Answer any two of the following questions : $2 \\times 2 = 4$\n\n(i) Androgyny\n\n(a) First short.\n\n(b) Second short.`;
    const rows = parseTranscriptToRows(md, "ENGDSC252");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 2, "Answer any 7"],
      ["1(h)", 2, "Answer any 7"],
      ["2(a)", 2, "Answer any 2"],
      ["2(b)", 2, "Answer any 2"],
    ]);
  });
});

describe("parser gaps fixed from batch 15 (2026-11-23, MTM papers)", () => {
  test("'Answer either [(a) and (b)] or [(c) and (d)]' is an instruction, not a phantom row (MTMDSM301 Q2)", () => {
    const md = `UNIT—I\n\n1. Answer any two of the following questions : $2 \\times 2 = 4$\n\n(a) First short.\n\n(b) Second short.\n\n(c) Third short.\n\n2. Answer either [(a) and (b)] or [(c) and (d)] :\n\n(a) First part.\n\n(b) Second part. 6\n\n(c) Third part. 4\n\n(d) Fourth part. 5`;
    const rows = parseTranscriptToRows(md, "MTMDSM301");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 2, "Answer any 2"],
      ["1(b)", 2, "Answer any 2"],
      ["1(c)", 2, "Answer any 2"],
      ["2", null, "Answer either"],
      ["2(a)", null, "Answer either"],
      ["2(b)", 6, "Answer either"],
      ["2(c)", 4, "Answer either"],
      ["2(d)", 5, "Answer either"],
    ]);
  });

  test("pair-either with a printed total keeps the total on the instruction row (MTMDSC301T Q4)", () => {
    const md = `UNIT—II\n\n4. Answer either [(a) and (b)] or [(c) and (d)] : 10\n\n(a) First part. 5\n\n(b) Second part. 5\n\n(c) Third part. 5\n\n(d) Fourth part. 5`;
    const rows = parseTranscriptToRows(md, "MTMDSC301T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["4", 10, "Answer either"],
      ["4(a)", 5, "Answer either"],
      ["4(b)", 5, "Answer either"],
      ["4(c)", 5, "Answer either"],
      ["4(d)", 5, "Answer either"],
    ]);
  });

  test("an unnumbered per-detail group does not leak into the next question (MTMDSM301 Q4(a))", () => {
    const md = `UNIT—II\n\n2. Answer either [(a) and (b)] or [(c) and (d)] :\n\n(a) First part.\n\n(b) Second part. 6\n\n(c) Third part. 4\n\n(d) Fourth part. 5\n\nAnswer any two of the following questions : $2 \\times 2 = 4$\n\n(a) First short.\n\n(b) Second short.\n\n(c) Third short.\n\n4. Answer either [(a) and (b)] or [(c) and (d)] :\n\n(a) Find the equation of the tangent to the circle. 5\n\n(b) Prove that the straight line is a normal. 5\n\n(c) Show that three normals can be drawn.\n\n(d) Show that the product of the lengths is $b^2$.`;
    const rows = parseTranscriptToRows(md, "MTMDSM301");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["2", null, "Answer either"],
      ["2(a)", null, "Answer either"],
      ["2(b)", 6, "Answer either"],
      ["2(c)", 4, "Answer either"],
      ["2(d)", 5, "Answer either"],
      ["3(a)", 2, "Answer any 2"],
      ["3(b)", 2, "Answer any 2"],
      ["3(c)", 2, "Answer any 2"],
      ["4", null, "Answer either"],
      ["4(a)", 5, "Answer either"],
      ["4(b)", 5, "Answer either"],
      ["4(c)", null, "Answer either"],
      ["4(d)", null, "Answer either"],
    ]);
  });

  test("a numbered sub-question with no instruction ends an unnumbered per-detail group", () => {
    const md = `UNIT—II\n\nAnswer any two of the following questions : $2 \\times 2 = 4$\n\n(a) First short.\n\n(b) Second short.\n\n2. (a) First long. 5\n\n(b) Second long. 5`;
    const rows = parseTranscriptToRows(md, "MTMDSM301");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 2, "Answer any 2"],
      ["1(b)", 2, "Answer any 2"],
      ["2(a)", 5, ""],
      ["2(b)", 5, ""],
    ]);
  });

  test("a part with no trailing figure reads null, not a phantom group value (MTMDSC301T Q8(c))", () => {
    const md = `UNIT—IV\n\n6. A direct question. 5\n\nAnswer any two of the following questions : $2 \\times 2 = 4$\n\n(a) First short.\n\n(b) Second short.\n\n(c) Third short.\n\n8. Answer either [(a) and (b)] or [(c) and (d)] : 10\n\n(a) Obtain the canonical form of the PDE. 5\n\n(b) Solve the PDE. 5\n\n(c) Reduce the PDE $$\\frac{\\partial^2 z}{\\partial x^2} = x^2 \\frac{\\partial^2 z}{\\partial y^2}$$ into canonical form and hence solve it.\n\n(d) Solve the PDE using separation of variables.`;
    const rows = parseTranscriptToRows(md, "MTMDSC301T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["6", 5, ""],
      ["7(a)", 2, "Answer any 2"],
      ["7(b)", 2, "Answer any 2"],
      ["7(c)", 2, "Answer any 2"],
      ["8", 10, "Answer either"],
      ["8(a)", 5, "Answer either"],
      ["8(b)", 5, "Answer either"],
      ["8(c)", null, "Answer either"],
      ["8(d)", null, "Answer either"],
    ]);
  });

  test("merged (i)/(ii) figures sum, and a figure inside maths is not one (MTMSEC101T Q9)", () => {
    const md = `UNIT—III\n\n9. Answer any one of the following questions:\n\n(a) (i) Show that $10^n + 3\\cdot 4^{n+2} + 5$ is divisible by 9. (ii) If $p$ is prime and $p|ab$, then prove that $p|a$ or $p|b$, where $a, b \\in \\mathbb{Z}$. 2\n\n(b) (i) Show that g.c.d. of $a + b$ and $a - b$ is either 1 or 2 if $(a, b) = 1$. 3 (ii) If $a \\equiv b (\\text{mod } m)$, $c \\equiv d (\\text{mod } m)$, then prove that $a + c \\equiv b + d (\\text{mod } m)$. 2`;
    const rows = parseTranscriptToRows(md, "MTMSEC101T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["9(a)", 2, "Answer any 1"],
      ["9(b)", 5, "Answer any 1"],
    ]);
    // The figures stay in the question text (they are the sub-parts'
    // printed marks); only the total is the row's marks.
    expect(rows[1].question).toContain("3 (ii)");
  });

  test("a merged sum that disagrees with the group guard still falls back (CHMDSM252 rule)", () => {
    const md = `UNIT—I\n\n2. Answer any one of the following questions : 10\n\n(a) (i) First sub-part. 2 (ii) Second sub-part. 3`;
    const rows = parseTranscriptToRows(md, "CHMDSM252");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["2(a)", 10, "Answer any 1"],
    ]);
  });

  test("a merged sum that agrees with the group guard is the row's marks (CHMDSM252 Q4(a))", () => {
    const md = `UNIT—II\n\n4. Answer any one of the following questions : 10\n\n(a) (i) First sub-part. 2 (ii) Second sub-part. 1 (iii) Third sub-part. 4 (iv) Fourth sub-part. 3`;
    const rows = parseTranscriptToRows(md, "CHMDSM252");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["4(a)", 10, "Answer any 1"],
    ]);
  });

  test("parenthesised trailing '(5)' is marks; 'equation (5)' is not (MTMDSC301T Q10)", () => {
    const md = `UNIT—V\n\n10. Answer either [(a) and (b)] or [(c) and (d)] : 10\n\n(a) Derive heat conduction equation for a bar. (5)\n\n(b) Second part text. (5)\n\n(c) Third part text. (5)\n\n(d) Fourth part text. (5)\n\n11. Answer any one of the following questions : 10\n\n(a) Solve equation (5)`;
    const rows = parseTranscriptToRows(md, "MTMDSC301T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["10", 10, "Answer either"],
      ["10(a)", 5, "Answer either"],
      ["10(b)", 5, "Answer either"],
      ["10(c)", 5, "Answer either"],
      ["10(d)", 5, "Answer either"],
      ["11(a)", 10, "Answer any 1"],
    ]);
    expect(rows[1].question).toBe("Derive heat conduction equation for a bar.");
    expect(rows[5].question).toBe("Solve equation (5)");
  });

  test("a bare sum on its own line attaches to the preceding question (PHIDSC201T)", () => {
    const md = `UNIT—I\n\n1. Answer any one of the following questions :\n\n(a) What is existential import? Explain in this connection the Boolean square of opposition.\n\n2+8=10`;
    const rows = parseTranscriptToRows(md, "PHIDSC201T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 10, "Answer any 1"],
    ]);
  });

  test("separate-line (i)/(ii) sub-parts join the row and carry its marks (MTMDSC301T Q6(b))", () => {
    const md = `UNIT—III\n\n6. Answer either [(a) and (b)] or [(c) and (d)] : 10\n\n(a) Solve : $$(2D^2 - 5DD' + 2D'^2)z = 5 \\sin(2x + y)$$ 5\n\n(b) Solve :\n\n(i) $(D^2 - D'^2 + D - D')z = 0$ (ii) $t + s + q = 0$ $2+3=5$\n\n(c) Solve : $$(D^2 - 2DD' - 15D'^2)z = 12xy$$ 5`;
    const rows = parseTranscriptToRows(md, "MTMDSC301T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["6", 10, "Answer either"],
      ["6(a)", 5, "Answer either"],
      ["6(b)", 5, "Answer either"],
      ["6(c)", 5, "Answer either"],
    ]);
    expect(rows[2].question).toContain("(i) $(D^2 - D'^2 + D - D')z = 0$");
    expect(rows[2].question).toContain("(ii) $t + s + q = 0$");
  });

  test("separate-line (i)/(ii) with a bare trailing figure joins too (MTMDSC302T Q2(c), MTMDSM301 Q8(a))", () => {
    const md = `UNIT—I\n\n2. Answer either [(a) and (b)] or [(c) and (d)] : 10\n\n(a) First part. 5\n\n(b) Second part. 5\n\n(c) Prove that d is a metric if and only if d satisfies the two conditions\n\n(i) $d(x,y)=0 \\Leftrightarrow x=y$ (ii) $d(x,y)\\le d(x,z)+d(y,z)$ 5\n\n8. Answer either [(a) and (b)] or [(c) and (d)] :\n\n(a) Prove that—\n\n(i) $[\\vec{a}+\\vec{b} \\quad \\vec{b}+\\vec{c} \\quad \\vec{c}+\\vec{a}] = 2 [\\vec{a} \\quad \\vec{b} \\quad \\vec{c}]$ (ii) $\\hat{i} \\times (\\vec{a} \\times \\hat{i}) + \\hat{j} \\times (\\vec{a} \\times \\hat{j}) + \\hat{k} \\times (\\vec{a} \\times \\hat{k}) = 2\\vec{a}$ 3+3=6`;
    const rows = parseTranscriptToRows(md, "MTMDSC302T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["2", 10, "Answer either"],
      ["2(a)", 5, "Answer either"],
      ["2(b)", 5, "Answer either"],
      ["2(c)", 5, "Answer either"],
      ["8", null, "Answer either"],
      ["8(a)", 6, "Answer either"],
    ]);
    expect(rows[3].question).toContain("(i) $d(x,y)=0");
    expect(rows[5].question).toContain("(ii)");
  });

  test("a separate-line (i)/(ii)/(iii) with a split total joins too (MTMDSC201T Q10(d))", () => {
    const md = `UNIT—V\n\n10. Answer either [(a) and (b)] or [(c) and (d)] : 10\n\n(d) State the theorem.\n\n(i) First condition. (ii) Second condition. (iii) Third condition. 3+3+1=7`;
    const rows = parseTranscriptToRows(md, "MTMDSC201T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["10", 10, "Answer either"],
      ["10(d)", 7, "Answer either"],
    ]);
    expect(rows[1].question).toContain("(i) First condition.");
    expect(rows[1].question).toContain("(iii) Third condition.");
  });

  test("a bare 'Answer either' line opens the next question number, not the previous one", () => {
    const md = `UNIT—V\n\n9. Answer any two of the following questions : $2 \\times 2 = 4$\n\n(a) First short.\n\n(b) Second short.\n\nAnswer either [(a) and (b)] or [(c) and (d)] : 10\n\n(a) First part. 5\n\n(b) Second part. 5`;
    const rows = parseTranscriptToRows(md, "MTMDSC301T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["9(a)", 2, "Answer any 2"],
      ["9(b)", 2, "Answer any 2"],
      ["10", 10, "Answer either"],
      ["10(a)", 5, "Answer either"],
      ["10(b)", 5, "Answer either"],
    ]);
    expect(rows.map((r) => r.id)).toEqual([
      "MTMDSC301T-Q9a",
      "MTMDSC301T-Q9b",
      "MTMDSC301T-Q10",
      "MTMDSC301T-Q10a",
      "MTMDSC301T-Q10b",
    ]);
  });
});

describe("parser gaps fixed from batch 19 (2026-11-23, BENSEC201)", () => {
  test("a marks figure after a colon introducing a quoted passage is the row's marks (BENSEC201 Q8/Q9/Q10)", () => {
    const md = `UNIT—II\n\n6. যে কোনো তিনটি প্রশ্নের উত্তর দাও : ১×৩=৩\n\n(a) প্রথম প্রশ্ন।\n\n(b) দ্বিতীয় প্রশ্ন।\n\n(c) তৃতীয় প্রশ্ন।\n\n(d) চতুর্থ প্রশ্ন।\n\n7. ঈশ্বরচন্দ্র বিদ্যাসাগরের অনুদিত যে কোনো দুটি গ্রন্থের নাম লেখো। ২\n\nOR\n\n8. বাংলায় অনুবাদ করো : ২ "Arise, awake and stop not till the goal is reached."\n\nOR\n\n"सफलता वही पाता है जो निरंतर कोशिश करता रहता है।"\n\n9. বাংলায় অনুবাদ করো : ৫ "Patriotism is love for one's country."\n\nOR\n\n10. বাংলায় অনুবাদ করো : ৫ "অসমীয়া আধুনিক সাহিত্যজগতের অন্যতম পুরোধা।"`;
    const rows = parseTranscriptToRows(md, "BENSEC201");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["6(a)", 1, "Answer any 3"],
      ["6(b)", 1, "Answer any 3"],
      ["6(c)", 1, "Answer any 3"],
      ["6(d)", 1, "Answer any 3"],
      ["7", 2, "OR"],
      ["8", 2, "OR"],
      ["9", 5, "OR"],
      ["10", 5, "OR"],
    ]);
    // The colon stays, the figure goes; the passage is untouched.
    expect(rows[5].question).toBe(
      'বাংলায় অনুবাদ করো : "Arise, awake and stop not till the goal is reached."',
    );
  });

  test("a colon with no figure after it is not marks (BENSEC201 Q6(c))", () => {
    const md = `UNIT—II\n\n6. বাংলা প্রতিশব্দ লেখো : Manuscript/Feedback`;
    const rows = parseTranscriptToRows(md, "BENSEC201");
    expect(rows.map((r) => [r.label, r.marks])).toEqual([["6", null]]);
    expect(rows[0].question).toBe(
      "বাংলা প্রতিশব্দ লেখো : Manuscript/Feedback",
    );
  });

  test("the Assamese-spelled instruction is an instruction, not a direct row (BENSEC201 Q11)", () => {
    const md = `UNIT—III\n\n11. যে কোনো তিনিটি প্ৰশ্নৰ উত্তৰ দাও : ১×৩=৩\n\n(a) 'গণজ্ঞাপন'-এর ইংরেজি পরিভাষা কী?\n\n(b) 'Television'-এর বাংলা পরিভাষা কী?\n\n(c) 'গণজ্ঞাপন' পরিভাষাটির প্রবক্তা কে?\n\n(d) কে প্রথম মুদ্রণ প্রযুক্তির আবিষ্কার করেন?`;
    const rows = parseTranscriptToRows(md, "BENSEC201");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["11(a)", 1, "Answer any 3"],
      ["11(b)", 1, "Answer any 3"],
      ["11(c)", 1, "Answer any 3"],
      ["11(d)", 1, "Answer any 3"],
    ]);
    expect(rows.map((r) => r.id)).toEqual([
      "BENSEC201-Q11a",
      "BENSEC201-Q11b",
      "BENSEC201-Q11c",
      "BENSEC201-Q11d",
    ]);
  });

  test("the Bengali spelling of the same instruction still parses (no regression)", () => {
    const md = `UNIT—III\n\n11. যে কোনো তিনটি প্রশ্নের উত্তর দাও : ১×৩=৩\n\n(a) প্রথম প্রশ্ন।\n\n(b) দ্বিতীয় প্রশ্ন।\n\n(c) তৃতীয় প্রশ্ন।\n\n(d) চতুর্থ প্রশ্ন।`;
    const rows = parseTranscriptToRows(md, "BENSEC201");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["11(a)", 1, "Answer any 3"],
      ["11(b)", 1, "Answer any 3"],
      ["11(c)", 1, "Answer any 3"],
      ["11(d)", 1, "Answer any 3"],
    ]);
  });
});

// "কুড়িটি" (twenty) with the single-codepoint ড় (U+09DC) — the form
// the BNGIDC151T scan actually prints. Written as codepoint escapes,
// never typed: the two byte forms of ড় look identical and only
// codepoints tell them apart (AGENTS.md, Bengali য় trap).
const KURITI_SINGLE = "\u0995\u09c1\u09dc\u09bf\u099f\u09bf";

describe("parser gaps fixed from batch 20 (2026-11-23, BNG section papers)", () => {
  test("a section instruction propagates to every question under it (BNGDSC152T বিভাগ—ক/খ)", () => {
    const md = `## বিভাগ—ক

যে কোনো দশটি প্রশ্নের উত্তর দাও : ২×১০=২০

1. প্রথম প্রশ্ন।

2. দ্বিতীয় প্রশ্ন।

3. তৃতীয় প্রশ্ন।

## বিভাগ—খ

যে কোনো পাঁচটি প্রশ্নের উত্তর দাও : ১০×৫=৫০

4. চতুর্থ প্রশ্ন।

5. পঞ্চম প্রশ্ন।`;
    const rows = parseTranscriptToRows(md, "BNGDSC152T");
    expect(rows.map((r) => [r.label, r.marks, r.group, r.unit])).toEqual([
      ["1", 2, "Answer any 10", "ক"],
      ["2", 2, "Answer any 10", "ক"],
      ["3", 2, "Answer any 10", "ক"],
      ["4", 10, "Answer any 5", "খ"],
      ["5", 10, "Answer any 5", "খ"],
    ]);
  });

  test("‘সংক্ষিপ্ত’ without ‘অতি’ still matches the instruction (BNGDSM151T SECTION—A)", () => {
    const md = `SECTION—A

যেকোনো দশটি প্রশ্নের সংক্ষিপ্ত উত্তর দাও : ২×১০=২০

1. প্রথম প্রশ্ন।

2. দ্বিতীয় প্রশ্ন।`;
    const rows = parseTranscriptToRows(md, "BNGDSM151T");
    expect(rows.map((r) => [r.label, r.marks, r.group, r.unit])).toEqual([
      ["1", 2, "Answer any 10", "A"],
      ["2", 2, "Answer any 10", "A"],
    ]);
  });

  test("mixed বিভাগ/SECTION headings, both quote styles, Latin x, and the single-codepoint ড় count word (BNGIDC151T)", () => {
    const md = `### বিভাগ—‘ক’

যে কোনো ${KURITI_SINGLE} প্রশ্নের উত্তর দাও : ১×২০=২০

1. প্রথম প্রশ্ন।

2. দ্বিতীয় প্রশ্ন।

## বিভাগ—'খ'

যে কোনো পাঁচটি প্রশ্নের উত্তর দাও : ২×৫=১০

3. তৃতীয় প্রশ্ন।

SECTION—'গ'

যে কোনো পাঁচটি প্রশ্নের উত্তর দাও : ৮x৫=৪০

4. চতুর্থ প্রশ্ন।`;
    const rows = parseTranscriptToRows(md, "BNGIDC151T");
    expect(rows.map((r) => [r.label, r.marks, r.group, r.unit])).toEqual([
      ["1", 1, "Answer any 20", "ক"],
      ["2", 1, "Answer any 20", "ক"],
      ["3", 2, "Answer any 5", "খ"],
      ["4", 8, "Answer any 5", "গ"],
    ]);
  });

  test("a bare question number whose text starts as a blockquote still becomes a row (BNGDSM151T Q21)", () => {
    const md = `SECTION—B

যে কোনো পাঁচটি প্রশ্নের উত্তর দাও : ১০×৫=৫০

20. বিংশ প্রশ্ন।

21.

> “নতুন মঙ্গল আশে ভারত সরস ভাষে

> রাজা কৃষ্ণচন্দ্রের আজ্ঞায়।”

কবি ভারতচন্দ্র তাঁর কাব্যকে কেন ‘নতুন মঙ্গল’ বলে অভিহিত করেছেন তা সংক্ষেপে বিবৃত করো।

22. দ্বাবিংশ প্রশ্ন।`;
    const rows = parseTranscriptToRows(md, "BNGDSM151T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["20", 10, "Answer any 5"],
      ["21", 10, "Answer any 5"],
      ["22", 10, "Answer any 5"],
    ]);
    expect(rows[1].question).toContain("নতুন মঙ্গল");
    expect(rows[1].question).toContain("ভারতচন্দ্র");
    expect(rows[1].question).not.toContain(">");
  });

  test("marks printed mid-question-text show in the Marks column (BNGAEC101T Q3/Q15/Q25)", () => {
    const md = `1. নিম্নলিখিত যে কোনো তিনটি প্রশ্নের উত্তর দাও : ১×৩=৩

(a) প্রথম প্রশ্ন।

(b) দ্বিতীয় প্রশ্ন।

(c) তৃতীয় প্রশ্ন।

(d) চতুর্থ প্রশ্ন।

OR

3. টীকা লেখো : ২ তদ্ভব শব্দ

OR

15. অশুদ্ধি সংশোধন করো (যে কোনো পাঁচটি) : ১×৫=৫ কৌতুহল; উচ্ছ্বাস; গীতাঞ্জলী

OR

25. “পথিক, তুমি পথ হারাইয়াছ?” উক্তিটির আলোকে উপন্যাসে বর্ণিত ঘটনার বিবরণ দাও। ৫ ★★★ J25—13100/555 2024/FYUG/ODD/SEM/BNGAEC–101T/230`;
    const rows = parseTranscriptToRows(md, "BNGAEC101T");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 1, "Answer any 3"],
      ["1(b)", 1, "Answer any 3"],
      ["1(c)", 1, "Answer any 3"],
      ["1(d)", 1, "Answer any 3"],
      ["3", 2, "OR"],
      ["15", 5, "OR"],
      ["25", 5, "OR"],
    ]);
  });

  test("an unnumbered instruction under a UNIT heading never becomes section-scoped (MTMDSM301 UNIT—II)", () => {
    const md = `UNIT—II

Answer any two of the following questions : 2×2=4

(a) First part.

(b) Second part.

(c) Third part.

4. Answer either [(a) and (b)] or [(c) and (d)] :

(a) Fourth part a. 5

(b) Fourth part b. 5`;
    const rows = parseTranscriptToRows(md, "MTMDSM301");
    expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
      ["1(a)", 2, "Answer any 2"],
      ["1(b)", 2, "Answer any 2"],
      ["1(c)", 2, "Answer any 2"],
      ["4", null, "Answer either"],
      ["4(a)", 5, "Answer either"],
      ["4(b)", 5, "Answer either"],
    ]);
  });
});

describe("parser gaps fixed from batch 21 (2026-11-23, BNGSEC151T)", () => {
  test("পনেরোটি (15) is a count word — the বিভাগ—ক instruction is recognised (BNGSEC151T)", () => {
    // Real staged lines: batch-21/BNGSEC151T-2024/staged.md lines 35-38.
    // Before the fix the instruction was a direct question row and
    // Q1–Q20 got no group/marks (counted 35/50 instead of 50/50).
    const md = `## বিভাগ—ক

যে কোনো পনেরোটি প্রশ্নের উত্তর দাও : $1 \\times ১৫=১৫$

1. DTP (ডি.টি.পি.)-র পূর্ণরূপ কী?

2. দ্বিতীয় প্রশ্ন।`;
    const rows = parseTranscriptToRows(md, "BNGSEC151T");
    expect(rows.map((r) => [r.label, r.marks, r.group, r.unit])).toEqual([
      ["1", 1, "Answer any 15", "ক"],
      ["2", 1, "Answer any 15", "ক"],
    ]);
  });

  test("every count word from eleven to nineteen is recognised", () => {
    // None of these words contains য় or ড়, so they are typed, not
    // escaped — the same convention as একটি/দুটি/দশটি above.
    const words: [string, number][] = [
      ["এগারোটি", 11],
      ["বারোটি", 12],
      ["তেরোটি", 13],
      ["চৌদ্দটি", 14],
      ["পনেরোটি", 15],
      ["ষোলোটি", 16],
      ["সতেরোটি", 17],
      ["আঠারোটি", 18],
      ["উনিশটি", 19],
    ];
    for (const [word, n] of words) {
      const md = `যে কোনো ${word} প্রশ্নের উত্তর দাও : $1 \\times ${n}=${n}$\n\n1. প্রথম প্রশ্ন।`;
      const rows = parseTranscriptToRows(md, "BNGTEST");
      expect(rows.map((r) => [r.label, r.marks, r.group])).toEqual([
        ["1", 1, `Answer any ${n}`],
      ]);
    }
  });
});
