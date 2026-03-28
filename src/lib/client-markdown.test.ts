import { markdownToHtmlWithKatex } from "./client-markdown";

describe("markdownToHtmlWithKatex", () => {
  it("renders markdown headings and inline/block math with KaTeX markup", () => {
    const source = `## Mechanics

Inline equation $F=ma$.

$$
E=mc^2
$$`;

    const html = markdownToHtmlWithKatex(source);

    expect(html).toContain("<h2>Mechanics</h2>");
    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');
    expect(html).toContain("equation-block");
  });

  it("sanitizes script tags and inline event handlers from markdown output", () => {
    const source = `Hello <script>alert("x")</script>

[dangerous link](javascript:alert(1))`;

    const html = markdownToHtmlWithKatex(source);

    expect(html).not.toContain("<script>alert(");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="#"');
  });
});
