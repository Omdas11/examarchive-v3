import fs from "fs";
import path from "path";

describe("AI content print/mobile styles", () => {
  const cssPath = path.join(process.cwd(), "src", "app", "globals.css");
  const css = fs.readFileSync(cssPath, "utf8");

  it("keeps pdf export source hidden on screen and visible in print", () => {
    expect(css).toContain(".pdf-export-source {\n  display: none;\n}");
    expect(css).toContain(
      "@media print {\n  .print-action-controls,"
    );
    expect(css).toContain(
      ".pdf-export-source {\n    display: block !important;\n    width: auto !important;\n  }"
    );
  });

  it("adds overflow guards for markdown content on small screens", () => {
    expect(css).toContain(".markdown-preview {\n  white-space: normal;");
    expect(css).toContain("overflow-wrap: anywhere;");
    expect(css).toContain(".markdown-preview .katex-display {\n  max-width: 100%;");
    expect(css).toContain(
      "@media (max-width: 640px) {\n  .markdown-preview table {\n    display: block;"
    );
  });
});
