import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="py-10 text-sm"
      style={{
        background: "var(--color-accent-soft)",
        borderTop: "1px solid var(--color-border)",
        color: "var(--color-text-muted)",
      }}
    >
      <div className="mx-auto grid gap-8 px-4 sm:grid-cols-2 lg:grid-cols-3" style={{ maxWidth: "var(--max-w)" }}>
        {/* Col 1 */}
        <div>
          <h4 className="mb-3 text-base font-semibold" style={{ color: "var(--color-text)" }}>ExamArchive</h4>
          <ul className="space-y-2">
            <li><Link href="/browse" className="hover:underline">Browse</Link></li>
            <li><Link href="/upload" className="hover:underline">Upload</Link></li>
            <li><Link href="/syllabus" className="hover:underline">Syllabus</Link></li>
          </ul>
        </div>
        {/* Col 2 */}
        <div>
          <h4 className="mb-3 text-base font-semibold" style={{ color: "var(--color-text)" }}>Resources</h4>
          <ul className="space-y-2">
            <li><Link href="/about" className="hover:underline">About</Link></li>
            <li><Link href="/support" className="hover:underline">Support</Link></li>
            <li><Link href="/terms" className="hover:underline">Terms</Link></li>
          </ul>
        </div>
        {/* Col 3 */}
        <div>
          <h4 className="mb-3 text-base font-semibold" style={{ color: "var(--color-text)" }}>Connect</h4>
          <ul className="space-y-2">
            <li><a href="mailto:contact@examarchive.org" className="hover:underline">Email</a></li>
            <li><a href="https://github.com/examarchive" target="_blank" rel="noopener noreferrer" className="hover:underline">GitHub</a></li>
          </ul>
        </div>
      </div>
      <div
        className="mx-auto mt-8 pt-6 text-center text-xs"
        style={{ maxWidth: "var(--max-w)", borderTop: "1px solid var(--color-border)" }}
      >
        © {new Date().getFullYear()} ExamArchive. All rights reserved.
      </div>
    </footer>
  );
}
