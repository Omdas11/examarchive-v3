"use client";

import MarkdownNotesRenderer from "./MarkdownNotesRenderer";

interface PrintableNotesDocumentProps {
  markdown: string;
  syllabusContent: string;
  paperName: string;
  paperCode: string;
  generatedAt: string;
  model?: string;
}

export default function PrintableNotesDocument({
  markdown,
  syllabusContent,
  paperName,
  paperCode,
  generatedAt,
  model,
}: PrintableNotesDocumentProps) {
  const ABBREV_DOT_RE = /(?:\d+(?:st|nd|rd|th)|\b(?:vs|etc|i\.e|e\.g|cf|al|dr|prof|mr|mrs|ms|st|nd))\./gi;
  const ABBREV_PLACEHOLDER = "\x00";
  const syllabusItems = syllabusContent
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      const protected_ = item.replace(
        ABBREV_DOT_RE,
        (m) => m.slice(0, -1) + ABBREV_PLACEHOLDER,
      );
      return protected_
        .split(/\.\s+(?=[A-Z0-9])/)
        .map((p) => p.replace(/\x00/g, ".").trim())
        .filter(Boolean);
    })
    .filter(Boolean);

  return (
    <article id="printable-exam-notes" className="pdf-export-source print-root-wrapper">
      <div className="print-root printable-notes-document">
        <header className="print-doc-header print-header avoid-break">
          <h1 className="print-brand-title">EXAMARCHIVE</h1>
          <h2 className="print-paper-title">{paperName || paperCode || "Untitled Paper"}</h2>
          <p className="print-doc-meta">
            Generated {generatedAt} | Model: {model || "gemini-3.1-flash-lite-preview"}
          </p>
          {syllabusItems.length > 0 && (
            <div className="print-syllabus-block">
              <p className="print-syllabus-title">Unit Syllabus</p>
              <ul className="print-syllabus-list">
                {syllabusItems.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </header>

        <section className="print-body print-content markdown-preview">
          <MarkdownNotesRenderer
            markdown={markdown}
            emptyFallback={<p>No output yet. Generate notes to print this document.</p>}
          />
        </section>

        <footer className="print-footer">
          AI-generated content. Please cross-check with standard textbooks and university resources.
        </footer>
        <p className="print-fixed-disclaimer">
          AI can make mistakes. Verify critical mathematical derivations.
        </p>
      </div>
    </article>
  );
}
