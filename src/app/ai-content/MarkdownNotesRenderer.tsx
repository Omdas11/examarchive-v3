"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MarkdownNotesRendererProps {
  markdown: string;
  emptyFallback?: React.ReactNode;
}

export default function MarkdownNotesRenderer({
  markdown,
  emptyFallback,
}: MarkdownNotesRendererProps) {
  if (!markdown) {
    return <>{emptyFallback ?? null}</>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      skipHtml
    >
      {markdown}
    </ReactMarkdown>
  );
}
