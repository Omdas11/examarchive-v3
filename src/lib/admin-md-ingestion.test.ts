import { parseDemoDataEntryMarkdown } from "./admin-md-ingestion";

describe("parseDemoDataEntryMarkdown", () => {
  it("parses syllabus-only file", () => {
    const markdown = `---
entry_type: syllabus
university: Assam University
course: FYUG
stream: Science
type: DSC
paper_code: PHYDSC101T
paper_name: Mechanics
subject: Physics
---

## Syllabus

| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| 1 | Kinematics and vectors | 12 | motion,vector |
`;

    const parsed = parseDemoDataEntryMarkdown(markdown);
    expect(parsed.errors).toEqual([]);
    expect(parsed.entryType).toBe("syllabus");
    expect(parsed.frontmatter?.paper_code).toBe("PHYDSC101T");
    expect(parsed.frontmatter?.stream).toBe("Science");
    expect(parsed.frontmatter?.subject).toBe("Physics");
    expect(parsed.syllabus).toHaveLength(1);
    expect(parsed.questions).toHaveLength(0);
    expect(parsed.syllabus[0]?.tags).toEqual(["motion", "vector"]);
  });

  it("derives subject from paper_code when subject is missing", () => {
    const markdown = `---
entry_type: syllabus
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
| 1 | Kinematics | 12 | motion |
`;

    const parsed = parseDemoDataEntryMarkdown(markdown);
    expect(parsed.errors).toEqual([]);
    expect(parsed.frontmatter?.subject).toBe("PHY");
  });

  it("reports deterministic line-level errors for invalid rows", () => {
    const markdown = `---
entry_type: syllabus
university: Assam University
course: FYUG
stream: Science
type: DSC
paper_code: PHYDSC101T
paper_name: Mechanics
subject: Physics
---

## Syllabus
| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| x |  | abc | |
`;

    const parsed = parseDemoDataEntryMarkdown(markdown);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors.some((err) => err.message.includes("Invalid unit_number"))).toBe(true);
  });

  it("supports syllabus-only v2 entries with alias keys", () => {
    const markdown = `---
entry_type: syllabus
university: Assam University
course: FYUG
stream: Science
paper_type: DSC
paper_code: PHYDSC101T
paper_title: Mechanics
subject_code: PHY
semester_code: "101"
semester_no: 1
---

## Syllabus
| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| 1 | Kinematics | 12 | motion |
`;

    const parsed = parseDemoDataEntryMarkdown(markdown);
    expect(parsed.errors).toEqual([]);
    expect(parsed.entryType).toBe("syllabus");
    expect(parsed.frontmatter?.type).toBe("DSC");
    expect(parsed.frontmatter?.paper_name).toBe("Mechanics");
    expect(parsed.questions).toHaveLength(0);
    expect(parsed.syllabus).toHaveLength(1);
  });

  it("supports question-only entries", () => {
    const markdown = `---
entry_type: question
university: Assam University
course: FYUG
stream: Science
paper_type: DSC
paper_code: PHYDSC101T
paper_title: Mechanics
subject_code: PHY
exam_year: 2024
---

## Questions
| question_no | question_subpart | year | question_content | marks | tags |
|---|---|---|---|---|---|
| 1 | a | 2024 | Define displacement. | 2 | motion |
`;

    const parsed = parseDemoDataEntryMarkdown(markdown);
    expect(parsed.errors).toEqual([]);
    expect(parsed.entryType).toBe("question");
    expect(parsed.syllabus).toHaveLength(0);
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.frontmatter?.exam_year).toBe(2024);
  });

  it("rejects combined syllabus+question sections in one file", () => {
    const markdown = `---
university: Assam University
course: FYUG
stream: Science
type: DSC
paper_code: PHYDSC101T
paper_name: Mechanics
subject: Physics
---

## Syllabus
| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| 1 | Kinematics | 12 | motion |

## Questions
| question_no | question_subpart | year | question_content | marks | tags |
|---|---|---|---|---|---|
| 1 | a | 2024 | Define displacement. | 2 | motion |
`;

    const parsed = parseDemoDataEntryMarkdown(markdown);
    expect(parsed.entryType).toBeNull();
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors.some((err) => err.message.includes("cannot contain both"))).toBe(true);
    expect(parsed.syllabus).toHaveLength(0);
    expect(parsed.questions).toHaveLength(0);
  });

  it("rejects non-Assam University frontmatter", () => {
    const markdown = `---
entry_type: syllabus
university: Gauhati University
course: FYUG
stream: Science
type: DSC
paper_code: PHYDSC101T
paper_name: Mechanics
subject: Physics
---

## Syllabus
| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| 1 | Kinematics | 12 | motion |
`;

    const parsed = parseDemoDataEntryMarkdown(markdown);
    expect(parsed.frontmatter).toBeNull();
    expect(parsed.errors.some((err) => err.message.includes('Invalid university. Expected "Assam University"'))).toBe(true);
  });

  it("rejects non-FYUG course frontmatter", () => {
    const markdown = `---
entry_type: syllabus
university: Assam University
course: CBCS
stream: Science
type: DSC
paper_code: PHYDSC101T
paper_name: Mechanics
subject: Physics
---

## Syllabus
| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| 1 | Kinematics | 12 | motion |
`;

    const parsed = parseDemoDataEntryMarkdown(markdown);
    expect(parsed.frontmatter).toBeNull();
    expect(parsed.errors.some((err) => err.message.includes('Invalid course. Expected "FYUG"'))).toBe(true);
  });

  it("reports only missing-field errors when university and course are absent", () => {
    const markdown = `---
entry_type: syllabus
stream: Science
type: DSC
paper_code: PHYDSC101T
paper_name: Mechanics
subject: Physics
---

## Syllabus
| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| 1 | Kinematics | 12 | motion |
`;

    const parsed = parseDemoDataEntryMarkdown(markdown);
    expect(parsed.frontmatter).toBeNull();
    expect(parsed.errors.some((err) => err.message === "Missing required frontmatter field: university")).toBe(true);
    expect(parsed.errors.some((err) => err.message === "Missing required frontmatter field: course")).toBe(true);
    expect(parsed.errors.some((err) => err.message.includes("Invalid university"))).toBe(false);
    expect(parsed.errors.some((err) => err.message.includes("Invalid course"))).toBe(false);
  });
});
