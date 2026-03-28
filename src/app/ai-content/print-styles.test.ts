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

  it("relaxes parent layout constraints in print to avoid blank pages", () => {
    expect(css).toMatch(
      /@media print[\s\S]*?html,\s*body,\s*#root,\s*#__next\s*\{[\s\S]*?height:\s*auto !important;[\s\S]*?overflow:\s*visible !important;[\s\S]*?display:\s*block !important;[\s\S]*?\}/
    );
    expect(css).toMatch(
      /@media print[\s\S]*?#__next > div\s*\{[\s\S]*?display:\s*block !important;[\s\S]*?height:\s*auto !important;[\s\S]*?overflow:\s*visible !important;[\s\S]*?\}/
    );
  });

  it("only reveals the printable notes container during print", () => {
    expect(css).toMatch(/@media print[\s\S]*?body \*\s*\{\s*visibility:\s*hidden;\s*\}/);
    expect(css).toMatch(
      /@media print[\s\S]*?#printable-exam-notes,\s*#printable-exam-notes \*\s*\{\s*visibility:\s*visible;\s*\}/
    );
    expect(css).toMatch(
      /@media print[\s\S]*?#printable-exam-notes\s*\{\s*position:\s*absolute;\s*left:\s*0;\s*top:\s*0;\s*\}/
    );
  });
});
