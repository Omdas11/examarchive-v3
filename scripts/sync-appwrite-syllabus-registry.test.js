/** @jest-environment node */

const {
  buildAttributeDefinitions,
  generateDocumentId,
  parseMarkdownTable,
  renderStatusBlock,
  upsertRegistryRecord,
  upsertStatusBlock,
} = require("./sync-appwrite-syllabus-registry");

describe("sync-appwrite-syllabus-registry", () => {
  describe("parseMarkdownTable", () => {
    const md = `
# Syllabus Registry

<!-- SYLLABUS_REGISTRY_STATUS_START -->
> placeholder
<!-- SYLLABUS_REGISTRY_STATUS_END -->

| paper_code | paper_name | semester | subject | credits | programme | university | category | contact_hours | full_marks |
|---|---|---|---|---|---|---|---|---|---|
| PHY101 | Mechanics | 1 | Physics | 3 | FYUGP | Assam University | DSC | 42 | 100 |
| MAT201 | Algebra | - | Mathematics | - | CBCS | Test University | DSE |  |  |
    `;

    test("parses numeric columns and leaves blanks as null/empty", () => {
      const records = parseMarkdownTable(md);
      expect(records).toHaveLength(2);
      expect(records[0]).toMatchObject({
        paper_code: "PHY101",
        semester: 1,
        credits: 3,
        contact_hours: 42,
        full_marks: 100,
      });
      expect(records[1]).toMatchObject({
        paper_code: "MAT201",
        semester: null,
        credits: null,
        contact_hours: null,
        full_marks: null,
      });
    });
  });

  describe("buildAttributeDefinitions", () => {
    test("adds dynamic attributes discovered in rows", () => {
      const records = [
        { paper_code: "PHY101", paper_name: "Mechanics", subject: "Physics", programme: "FYUGP", university: "X" },
        { paper_code: "MAT101", paper_name: "Algebra", subject: "Maths", programme: "CBCS", university: "Y", notes: "new" },
      ];

      const attributes = buildAttributeDefinitions(records);
      const keys = attributes.map((a) => a.key);
      expect(keys).toEqual(expect.arrayContaining(["paper_code", "paper_name", "notes"]));
    });
  });

  describe("generateDocumentId", () => {
    test("sanitizes and hashes the paper code for Appwrite IDs", () => {
      const docId = generateDocumentId("DSC303/DSC351");
      expect(docId).toMatch(/^dsc303-dsc351-[a-f0-9]{8}$/);
    });
  });

  describe("upsertRegistryRecord", () => {
    test("updates when document already exists", async () => {
      const databases = {
        createDocument: jest.fn().mockRejectedValue({ code: 409 }),
        updateDocument: jest.fn().mockResolvedValue({}),
      };

      const result = await upsertRegistryRecord(
        databases,
        { paper_code: "PHY101", paper_name: "Mechanics" },
        ["paper_code", "paper_name"],
      );

      expect(result.updated).toBe(true);
      expect(databases.updateDocument).toHaveBeenCalled();
    });

    test("creates new documents when missing", async () => {
      const databases = {
        createDocument: jest.fn().mockResolvedValue({}),
        updateDocument: jest.fn(),
      };

      const result = await upsertRegistryRecord(
        databases,
        { paper_code: "PHY102", paper_name: "Optics" },
        ["paper_code", "paper_name"],
      );

      expect(result.created).toBe(true);
      expect(databases.createDocument).toHaveBeenCalled();
      expect(databases.updateDocument).not.toHaveBeenCalled();
    });
  });

  describe("status block helpers", () => {
    test("replaces existing status block", () => {
      const current = `
intro text
<!-- SYLLABUS_REGISTRY_STATUS_START -->
old
<!-- SYLLABUS_REGISTRY_STATUS_END -->
rest
      `;
      const nextBlock = renderStatusBlock({
        ok: true,
        dryRun: false,
        runAt: "2026-03-29T00:00:00Z",
        records: 2,
        created: 1,
        updated: 1,
      });
      const updated = upsertStatusBlock(current, nextBlock);
      expect(updated).toContain("✅ Synced");
      expect(updated).toContain("Records in markdown: 2");
    });
  });
});
