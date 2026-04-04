import { buildPdfHtml, buildSafePdfFileName } from "./ai-pdf-pipeline";

jest.mock("node-appwrite/file", () => ({
  InputFile: {
    fromBuffer: jest.fn(),
  },
}));
jest.mock("@/lib/appwrite", () => ({
  adminStorage: jest.fn(),
  BUCKET_ID: "bucket",
  ID: { unique: jest.fn(() => "id") },
  getAppwriteFileDownloadUrl: jest.fn((id: string) => `/api/files/papers/${id}?download=1`),
}));

describe("ai-pdf-pipeline", () => {
  it("sanitizes rendered markdown html content", () => {
    const html = buildPdfHtml({
      markdown: `## Safe\n<script>alert("x")</script>\n<img src="x" onerror="alert(1)" /><a href="javascript:alert(2)">x</a>`,
    });
    const mainContent = html.slice(html.indexOf("<main>"), html.indexOf("</main>"));

    expect(mainContent).toContain("<h2>Safe</h2>");
    expect(mainContent).not.toContain("<script");
    expect(mainContent).not.toContain("alert(");
    expect(mainContent).not.toContain('href="javascript:');
    expect(mainContent).not.toContain("onerror=");
    expect(mainContent).not.toContain("javascript:");
  });

  it("escapes untrusted metadata on cover and syllabus bullets", () => {
    const html = buildPdfHtml({
      markdown: "content",
      paperCode: `<img src=x onerror=alert(1)>`,
      syllabusContent: `A&B;<b>Topic</b>;"quoted"`,
      unitNumber: 1,
      year: 2025,
    });

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("A&amp;B");
    expect(html).toContain("&lt;b&gt;Topic&lt;/b&gt;");
    expect(html).toContain("&quot;quoted&quot;");
  });

  it("always returns a .pdf filename", () => {
    expect(buildSafePdfFileName({ fileBaseName: "abc" })).toBe("abc.pdf");
    expect(buildSafePdfFileName({ fileBaseName: "abc", fileName: "weird name" })).toBe("weird_name.pdf");
    expect(buildSafePdfFileName({ fileBaseName: "abc", fileName: "x.pdf" })).toBe("x.pdf");
    expect(buildSafePdfFileName({ fileBaseName: "!!!", fileName: "???" })).toBe("generated_document.pdf");
  });
});
