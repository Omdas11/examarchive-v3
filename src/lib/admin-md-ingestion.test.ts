import { parseDemoDataEntryMarkdown } from "./admin-md-ingestion";

describe("parseDemoDataEntryMarkdown", () => {
  it("parses frontmatter, syllabus rows, and question rows", () => {
    const markdown = `---
university: Assam University
course: FYUG
stream: Science
type: DSC
paper_code: PHYDSC101T
paper_name: Mechanics
---

## Syllabus

| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| 1 | Kinematics and vectors | 12 | motion,vector |

## Questions

    | question_no | question_subpart | year | question_content | marks | tags |
    |---|---|---|---|---|---|
    | 1 | a | 2023 | Define displacement. | 2 | motion |
`;

    const parsed = parseDemoDataEntryMarkdown(markdown);
    expect(parsed.errors).toEqual([]);
    expect(parsed.frontmatter?.paper_code).toBe("PHYDSC101T");
    expect(parsed.frontmatter?.stream).toBe("Science");
    expect(parsed.syllabus).toHaveLength(1);
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.syllabus[0]?.tags).toEqual(["motion", "vector"]);
    expect(parsed.questions[0]?.tags).toEqual(["motion"]);
    expect(parsed.questions[0]?.year).toBe(2023);
  });

  it("reports deterministic line-level errors for invalid rows", () => {
    const markdown = `---
university: Assam University
course: FYUG
stream: Science
type: DSC
paper_code: PHYDSC101T
paper_name: Mechanics
---

## Syllabus
| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| x |  | abc | |

## Questions
    | question_no | question_subpart | year | question_content | marks | tags |
    |---|---|---|---|---|---|
    |  | b | 2200 |  | -1 | |
    |  | c | 2023 | Valid body | 2 | |
`;

    const parsed = parseDemoDataEntryMarkdown(markdown);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors.some((err) => err.message.includes("Invalid unit_number"))).toBe(true);
    expect(parsed.errors.some((err) => err.message.includes("Invalid year value"))).toBe(true);
    expect(parsed.errors.some((err) => err.message.includes("question_no is required"))).toBe(true);
  });
});
