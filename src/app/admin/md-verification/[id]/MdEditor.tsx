"use client";

import { useEffect, useState } from "react";
import MDEditor, { commands } from "@uiw/react-md-editor";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import "@uiw/react-md-editor/markdown-editor.css";

/**
 * The markdown editor for MD verification (free, MIT: @uiw/react-md-editor).
 *
 * The preview must show each question on its own line even when the stored
 * md has single newlines and no blank lines — standard markdown collapses
 * those, so remark-breaks is wired into the preview. Maths renders via
 * remark-math + KaTeX (already used by the old preview). The toolbar is
 * deliberately small: most verifiers do not know markdown.
 *
 * Dark mode follows the site: the site sets `data-theme="dark"` on
 * <html>, and this component mirrors it into the editor's
 * `data-color-mode` (and watches for changes, so the theme toggle works
 * without a reload). The h1 is scoped small on phones — the global h1
 * rule in globals.css makes the paper title fill a phone screen.
 */
const SIMPLE_COMMANDS = [
  commands.bold,
  commands.italic,
  commands.title,
  commands.divider,
  commands.unorderedListCommand,
  commands.orderedListCommand,
  commands.divider,
  commands.link,
  commands.quote,
  commands.code,
];

function readColorMode(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

export default function MdEditor({
  value,
  onChange,
  disabled,
  mode,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  mode: "edit" | "preview";
}) {
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    setColorMode(readColorMode());
    const observer = new MutationObserver(() =>
      setColorMode(readColorMode()),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="md-verify-editor mt-3 [&_.wmde-markdown_h1]:text-xl sm:[&_.wmde-markdown_h1]:text-2xl">
      <MDEditor
        value={value}
        onChange={(next) => onChange(next ?? "")}
        preview={mode === "preview" ? "preview" : "edit"}
        height="70vh"
        data-color-mode={colorMode}
        commands={SIMPLE_COMMANDS}
        extraCommands={[]}
        visibleDragbar={false}
        highlightEnable={false}
        hideToolbar={disabled}
        textareaProps={{
          disabled,
          "aria-label": "Markdown text",
          spellCheck: false,
        }}
        previewOptions={{
          remarkPlugins: [remarkMath, remarkBreaks],
          rehypePlugins: [rehypeKatex],
        }}
      />
    </div>
  );
}
