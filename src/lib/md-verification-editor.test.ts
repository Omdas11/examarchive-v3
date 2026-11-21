/**
 * Tests for the MD verification editor (@uiw/react-md-editor).
 *
 * The editor component imports CSS and browser-only code, so it cannot be
 * rendered in node — these tests assert on the wiring in source instead:
 * the preview plugins (line breaks + maths), the dark-mode sync, the
 * small toolbar, and the dynamic ssr:false load in the detail page. The
 * actual render of the preview pipeline is checked by the node script
 * that renders the same plugin list on the real COMDSC-352T md.
 */
import { readFileSync } from "fs";
import { join } from "path";

const DETAIL_PATH = join(
  __dirname,
  "../app/admin/md-verification/[id]/MdVerificationDetail.tsx",
);
const EDITOR_PATH = join(
  __dirname,
  "../app/admin/md-verification/[id]/MdEditor.tsx",
);

function read(p: string): string {
  return readFileSync(p, "utf8");
}

describe("md verification editor wiring", () => {
  it("wires remark-breaks, remark-math and rehype-katex into the preview", () => {
    const src = read(EDITOR_PATH);
    expect(src).toContain("remark-breaks");
    expect(src).toContain("remark-math");
    expect(src).toContain("rehype-katex");
    expect(src).toMatch(/previewOptions=\{\{\s*remarkPlugins:\s*\[remarkMath, remarkBreaks\]/);
    expect(src).toMatch(/rehypePlugins:\s*\[rehypeKatex\]/);
  });

  it("follows the site theme from data-theme and watches for changes", () => {
    const src = read(EDITOR_PATH);
    expect(src).toContain('getAttribute("data-theme")');
    expect(src).toContain("data-color-mode={colorMode}");
    expect(src).toContain("MutationObserver");
  });

  it("keeps the toolbar small and hides the extras", () => {
    const src = read(EDITOR_PATH);
    for (const cmd of [
      "commands.bold",
      "commands.italic",
      "commands.title",
      "commands.unorderedListCommand",
      "commands.orderedListCommand",
      "commands.link",
      "commands.quote",
      "commands.code",
    ]) {
      expect(src).toContain(cmd);
    }
    expect(src).toContain("extraCommands={[]}");
  });

  it("loads the editor dynamically with ssr:false, no competing preview", () => {
    const detail = read(DETAIL_PATH);
    expect(detail).toMatch(/dynamic\(\(\) => import\("\.\/MdEditor"\), \{\s*ssr: false/);
    expect(detail).not.toContain("ReactMarkdown");
    expect(detail).not.toContain("remarkGfm");
    // The md textarea moved into MdEditor; the suggest form's textarea stays.
    expect(detail).not.toContain('aria-label="Markdown text"');
  });

  it("keeps the Format button and Edit/Preview modes on the editor", () => {
    const detail = read(DETAIL_PATH);
    expect(detail).toContain("formatQuestionMd(draft)");
    expect(detail).toContain("<MdEditor");
    expect(detail).toContain('mode={mode}');
    expect(detail).toContain('setMode("edit")');
    expect(detail).toContain('setMode("preview")');
  });
});
