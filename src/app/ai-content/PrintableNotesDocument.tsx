"use client";

interface PrintableNotesDocumentProps {
  markdownHtml: string;
  paperName: string;
  paperCode: string;
  generatedAt: string;
  model?: string;
}

export default function PrintableNotesDocument({
  markdownHtml,
  paperName,
  paperCode,
  generatedAt,
  model,
}: PrintableNotesDocumentProps) {
  return (
    <article id="printable-exam-notes" className="pdf-export-source print-root-wrapper">
      <div className="print-root printable-notes-document">
        <header className="print-doc-header avoid-break">
          <h1 className="print-brand-title">EXAMARCHIVE</h1>
          <h2 className="print-paper-title">{paperName || paperCode || "Untitled Paper"}</h2>
          <p className="print-doc-meta">
            Generated {generatedAt} | Model: {model || "gemini-3.1-flash-lite-preview"}
          </p>
        </header>

        <section className="print-body markdown-preview">
          {markdownHtml ? (
            <div dangerouslySetInnerHTML={{ __html: markdownHtml }} />
          ) : (
            <p>No output yet. Generate notes to print this document.</p>
          )}
        </section>

        <footer className="print-footer">
          Thank you for generating your study notes with ExamArchive! If you found this helpful, please share
          it with your friends and classmates. Visit ExamArchive website.
        </footer>
      </div>
    </article>
  );
}
