import { marked } from "marked";
import katex from "katex";
import DOMPurify from "dompurify";

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function renderMath(input: string): string {
  const replaceDisplay = input.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    try {
      return `<div class="equation-block">${katex.renderToString(expr.trim(), {
        displayMode: true,
        throwOnError: false,
        strict: "ignore",
      })}</div>`;
    } catch {
      return `<pre>${escapeHtml(String(expr))}</pre>`;
    }
  });

  let output = "";
  let inlineBuffer = "";
  let inInlineMath = false;
  let trailingBackslashes = 0;

  for (let i = 0; i < replaceDisplay.length; i += 1) {
    const ch = replaceDisplay[i];
    const isUnescapedDollar = ch === "$" && trailingBackslashes % 2 === 0;

    if (inInlineMath) {
      if (ch === "\n") {
        output += `$${inlineBuffer}\n`;
        inlineBuffer = "";
        inInlineMath = false;
      } else if (isUnescapedDollar) {
        const expr = inlineBuffer.trim();
        try {
          output += katex.renderToString(expr, {
            displayMode: false,
            throwOnError: false,
            strict: "ignore",
          });
        } catch {
          output += `<code>${escapeHtml(expr)}</code>`;
        }
        inlineBuffer = "";
        inInlineMath = false;
      } else {
        inlineBuffer += ch;
      }
    } else if (isUnescapedDollar) {
      inInlineMath = true;
      inlineBuffer = "";
    } else {
      output += ch;
    }

    trailingBackslashes = ch === "\\" ? trailingBackslashes + 1 : 0;
  }

  if (inInlineMath) {
    output += `$${inlineBuffer}`;
  }

  return output;
}

function sanitizeRenderedHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
  });
}

export function markdownToHtmlWithKatex(markdown: string): string {
  marked.setOptions({
    gfm: true,
    breaks: true,
  });
  const withMath = renderMath(markdown || "");
  const html = marked.parse(withMath);
  if (typeof html !== "string") return "";
  return sanitizeRenderedHtml(html);
}
