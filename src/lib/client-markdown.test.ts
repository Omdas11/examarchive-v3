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

[dangerous link](javascript:alert(1))

<img src="x" onClick="alert(1)" />`;

    const html = markdownToHtmlWithKatex(source);

    expect(html).not.toContain("<script>alert(");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("onClick=");
    expect(html).toContain("<a>dangerous link</a>");
  });

  it("does not treat escaped dollar signs as inline math delimiters", () => {
    const source = String.raw`Price is \$20 and not math, but this is math: $x+y$`;

    const html = markdownToHtmlWithKatex(source);

    expect(html).toContain("Price is $20");
    expect(html).toContain('class="katex"');
  });
});
