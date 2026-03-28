import fs from "fs";
import path from "path";

describe("AI content print/mobile styles", () => {
  const cssPath = path.join(process.cwd(), "src", "app", "globals.css");
  const css = fs.readFileSync(cssPath, "utf8");

  it("keeps pdf export source hidden on screen and visible in print", () => {
    expect(css).toMatch(
      /\.pdf-export-source\s*\{\s*display:\s*none;\s*\}/
    );
    expect(css).toMatch(
      /@media print\s*\{[\s\S]*?\.pdf-export-source\s*\{\s*display:\s*block !important;\s*width:\s*auto !important;\s*\}/
    );
  });

  it("adds overflow guards for markdown content on small screens", () => {
    expect(css).toMatch(
      /\.markdown-preview\s*\{[\s\S]*?white-space:\s*normal;[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?\}/
    );
    expect(css).toMatch(
      /\.markdown-preview pre,\s*\.markdown-preview table,\s*\.markdown-preview \.katex-display\s*\{\s*max-width:\s*100%;\s*\}/
    );
    expect(css).toMatch(
      /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.markdown-preview table\s*\{\s*display:\s*block;[\s\S]*?overflow-x:\s*auto;[\s\S]*?\}/
    );
  });
});
