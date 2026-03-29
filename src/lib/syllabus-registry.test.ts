import fs from "fs";

jest.mock("fs", () => ({
  statSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe("syllabus registry parser", () => {
  const mockStat = fs.statSync as jest.Mock;
  const mockRead = fs.readFileSync as jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    mockStat.mockReset();
    mockRead.mockReset();
  });

  it("parses numeric columns and preserves extra columns", async () => {
    const md = [
      "| paper_code | paper_name | semester | credits | subject | programme | university | category | extra_col |",
      "|------------|------------|----------|---------|---------|-----------|------------|----------|-----------|",
      "| CODE1 | Name 1 | 1 | 3 | Physics | FYUGP | Uni | DSC | keepme |",
    ].join("\n");

    mockStat.mockReturnValue({ mtimeMs: 1 });
    mockRead.mockReturnValue(md);

    const { loadSyllabusRegistry } = await import("./syllabus-registry");
    const rows = await loadSyllabusRegistry();
    expect(rows).toHaveLength(1);
    expect(rows[0].semester).toBe(1);
    expect(rows[0].credits).toBe(3);
    expect(rows[0].extra_col).toBe("keepme");
  });

  it("skips rows without paper_code and handles malformed rows", async () => {
    const md = [
      "| paper_code | paper_name | semester | credits | subject | programme | university |",
      "|------------|------------|----------|---------|---------|-----------|------------|",
      "| | Missing code | 1 | 3 | Physics | FYUGP | Uni |",
      "| CODE2 | Name 2 | 2 | | Physics | FYUGP | Uni |",
      "Not a table row",
    ].join("\n");

    mockStat.mockReturnValue({ mtimeMs: 2 });
    mockRead.mockReturnValue(md);

    const { loadSyllabusRegistry } = await import("./syllabus-registry");
    const rows = await loadSyllabusRegistry();
    expect(rows).toHaveLength(1);
    expect(rows[0].paper_code).toBe("CODE2");
    expect(rows[0].credits).toBeNull();
  });

  it("refreshes cache when mtime changes", async () => {
    const md1 = [
      "| paper_code | paper_name | semester | credits | subject | programme | university |",
      "|------------|------------|----------|---------|---------|-----------|------------|",
      "| CODE3 | Old Name | 1 | 3 | Physics | FYUGP | Uni |",
    ].join("\n");
    const md2 = [
      "| paper_code | paper_name | semester | credits | subject | programme | university |",
      "|------------|------------|----------|---------|---------|-----------|------------|",
      "| CODE3 | New Name | 2 | 4 | Physics | FYUGP | Uni |",
    ].join("\n");

    mockStat.mockReturnValueOnce({ mtimeMs: 3 });
    mockRead.mockReturnValueOnce(md1);
    const { loadSyllabusRegistry } = await import("./syllabus-registry");
    const first = await loadSyllabusRegistry();
    expect(first[0].paper_name).toBe("Old Name");

    mockStat.mockReturnValueOnce({ mtimeMs: 4 });
    mockRead.mockReturnValueOnce(md2);
    const refreshed = await loadSyllabusRegistry();
    expect(refreshed[0].paper_name).toBe("New Name");
    expect(refreshed[0].semester).toBe(2);
    expect(refreshed[0].credits).toBe(4);
  });
});
