import { marked } from "marked";
import katex from "katex";

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

  return replaceDisplay.replace(/(^|[^\\])\$([^$\n]+?)\$/g, (_, prefix, expr) => {
    try {
      return `${prefix}${katex.renderToString(String(expr).trim(), {
        displayMode: false,
        throwOnError: false,
        strict: "ignore",
      })}`;
    } catch {
      return `${prefix}<code>${escapeHtml(String(expr))}</code>`;
    }
  });
}

function sanitizeRenderedHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<(iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
}

export function markdownToHtmlWithKatex(markdown: string): string {
  marked.setOptions({
    gfm: true,
    breaks: true,
  });
  const escapedRawMarkdown = (markdown || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const withMath = renderMath(escapedRawMarkdown);
  const html = marked.parse(withMath);
  if (typeof html !== "string") return "";
  return sanitizeRenderedHtml(html);
}
