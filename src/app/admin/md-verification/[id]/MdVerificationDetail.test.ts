/**
 * Regression test for the v1 detail UI revert (2026-11-21): the detail
 * page is the raw editor + PDF iframe again, but it must keep the v2
 * behaviours — assigned-only buttons, suggest form, soft lock, 409
 * version check, how-to box, dark-theme-safe inputs.
 *
 * This test reads the component source instead of rendering it: the
 * page is a client component with fetch calls, and jest hangs in this
 * VM, so the same assertions are also run via tsc + node.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(__dirname, "MdVerificationDetail.tsx"),
  "utf-8",
);

describe("MdVerificationDetail (reverted v1 UI, v2 behaviours kept)", () => {
  test("PDF is the browser-viewer iframe, not the pdf.js viewer", () => {
    expect(source).toContain("<iframe");
    expect(source).toContain("`/api/md-verification/${item.id}/pdf`");
    expect(source).not.toContain("PdfLineViewer");
    expect(source).not.toContain("pdfjs-dist");
    expect(source).not.toContain("tesseract");
  });

  test("raw editor with Edit / Preview toggle, no question cards", () => {
    expect(source).toContain('setMode("edit")');
    expect(source).toContain('setMode("preview")');
    expect(source).not.toContain("Cards");
    expect(source).not.toContain("parseMd");
    expect(source).not.toContain("reassembleMd");
  });

  test("save sends expected_updated_at and handles 409 with Reload", () => {
    expect(source).toContain("expected_updated_at: item.updated_at");
    expect(source).toContain("res.status === 409");
    expect(source).toContain("Someone saved a newer version");
    expect(source).toContain("Reload the latest version");
  });

  test("review handles the already-approved 409", () => {
    expect(source).toContain("This item was already decided.");
  });

  test("only the assignee sees the four buttons; others get the suggest form", () => {
    expect(source).toContain(
      'const showActions = canAct && item.status !== "approved"',
    );
    expect(source).toContain(
      'const showSuggest = !canAct && item.status !== "approved"',
    );
    expect(source).toContain("Suggest an edit");
    expect(source).toContain("Send suggestion");
  });

  test("soft lock heartbeat and founder assign panel are present", () => {
    expect(source).toContain("/lock`");
    expect(source).toContain("is editing this now");
    expect(source).toContain("/assign`");
  });

  test("how-to box explains the buttons and the approval reward", () => {
    expect(source).toContain("How this works");
    expect(source).toContain("+25 XP and +5 AI credits");
    expect(source).toContain("source of truth for AI Notes");
  });

  test("preview renders maths and the title is tamed on phones", () => {
    expect(source).toContain('import remarkMath from "remark-math"');
    expect(source).toContain('import rehypeKatex from "rehype-katex"');
    expect(source).toContain("remarkPlugins={[remarkGfm, remarkMath]}");
    expect(source).toContain("rehypePlugins={[rehypeKatex]}");
    // No typography plugin in this repo, so prose-h1: generates nothing;
    // the h1 size is tamed with an arbitrary variant instead. (The huge
    // title came from the global `h1 { font-size: clamp(2rem, 4vw, 2.8rem) }`
    // rule in globals.css.)
    expect(source).toContain("[&_h1]:text-xl");
    expect(source).toContain("sm:[&_h1]:text-2xl");
  });

  test("Format button tidies the draft without saving", () => {
    expect(source).toContain(
      'import { formatQuestionMd } from "@/lib/md-verification-format"',
    );
    expect(source).toContain("setDraft(formatQuestionMd(draft))");
    expect(source).toMatch(/>\s*Format\s*</);
  });

  test("no hardcoded white boxes (dark-theme bug)", () => {
    expect(source).not.toContain("bg-white");
    expect(source).toContain("bg-[var(--color-input-bg)]");
    expect(source).toContain("dark:prose-invert");
  });
});
