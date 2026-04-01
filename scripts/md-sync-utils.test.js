const {
  hashCoreContent,
  parseDatabaseSchemaMarkdown,
  renderSyncRemarks,
  stripSyncRemarks,
  upsertSyncRemarks,
} = require("./md-sync-utils");

describe("md-sync-utils", () => {
  test("hashCoreContent ignores sync remarks section", () => {
    const base = "# Title\n\nBody\n";
    const withRemarks = `${base}\n---\n### Sync Remarks (Auto-Generated)\n**Last Synced:** now\n`;
    expect(hashCoreContent(base)).toBe(hashCoreContent(withRemarks));
    expect(stripSyncRemarks(withRemarks)).toBe("# Title\n\nBody\n");
  });

  test("upsertSyncRemarks replaces previous remarks block", () => {
    const first = upsertSyncRemarks("# Doc\n", renderSyncRemarks({
      timestamp: "t1",
      overallStatus: "Success",
      connected: ["a"],
      errors: [],
    }));
    const second = upsertSyncRemarks(first, renderSyncRemarks({
      timestamp: "t2",
      overallStatus: "Failed",
      connected: [],
      errors: ["x"],
    }));
    expect(second).toContain("t2");
    expect(second).not.toContain("t1");
    expect(second).toContain("Failed");
  });

  test("parseDatabaseSchemaMarkdown extracts table definitions from markdown", () => {
    const markdown = `# DATABASE_SCHEMA

## Table: \`Syllabus_Table\`

| Field | Type | Required | Notes |
|---|---|---|---|
| \`unit_number\` | Integer | **Yes** | Unit |
| \`syllabus_content\` | String | **Yes** | Text |
`;
    const parsed = parseDatabaseSchemaMarkdown(markdown);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("Syllabus_Table");
    expect(parsed[0].attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "unit_number", type: "integer", required: true }),
        expect.objectContaining({ key: "syllabus_content", type: "string", required: true }),
      ]),
    );
  });
});
