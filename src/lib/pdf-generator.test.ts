import { sanitizeHtmlLikeContent } from "./pdf-generator";

describe("sanitizeHtmlLikeContent", () => {
  it("strips scripts and event handlers from malicious html", () => {
    const unsafe = `
      <h1 onclick="alert('x')">Hello</h1>
      <img src="javascript:alert(1)" onerror="alert(2)" />
      <script>alert("bad")</script>
      <a href="javascript:alert(3)">click</a>
      <p>safe text</p>
    `;

    const sanitized = sanitizeHtmlLikeContent(unsafe);

    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("onclick=");
    expect(sanitized).not.toContain("onerror=");
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).toContain("<h1>Hello</h1>");
    expect(sanitized).toContain("<p>safe text</p>");
  });

  it("removes external image urls to prevent outbound fetches during rendering", () => {
    const unsafe = `<p>hello</p><img src="https://example.com/x.png" alt="x" />`;
    const sanitized = sanitizeHtmlLikeContent(unsafe);
    expect(sanitized).toContain("<p>hello</p>");
    expect(sanitized).not.toContain("https://example.com/x.png");
  });
});
