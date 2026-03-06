import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="mt-12 pt-10 pb-6 text-sm"
      style={{
        background: "var(--color-accent-soft)",
        borderTop: "1px solid var(--color-border)",
        color: "var(--color-text-muted)",
      }}
    >
      <div
        className="mx-auto px-4"
        style={{ maxWidth: "var(--max-w)" }}
      >
        {/* ── 3-column link grid ── */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          {/* Resources */}
          <div className="flex flex-col gap-2">
            <h4 className="mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>Resources</h4>
            <Link href="/" className="hover:underline hover:opacity-80 transition-opacity text-xs">Home</Link>
            <Link href="/browse" className="hover:underline hover:opacity-80 transition-opacity text-xs">Browse Papers</Link>
            <Link href="/upload" className="hover:underline hover:opacity-80 transition-opacity text-xs">Upload Paper</Link>
            <Link href="/syllabus" className="hover:underline hover:opacity-80 transition-opacity text-xs">Syllabus</Link>
            <Link href="/about" className="hover:underline hover:opacity-80 transition-opacity text-xs">About ExamArchive</Link>
          </div>

          {/* Institutions */}
          <div className="flex flex-col gap-2">
            <h4 className="mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>Institutions</h4>
            <a href="https://www.aus.ac.in" target="_blank" rel="noopener noreferrer" className="hover:underline hover:opacity-80 transition-opacity text-xs">Assam University</a>
            <a href="https://www.gauhati.ac.in" target="_blank" rel="noopener noreferrer" className="hover:underline hover:opacity-80 transition-opacity text-xs">Gauhati University</a>
            <a href="https://www.tezu.ernet.in" target="_blank" rel="noopener noreferrer" className="hover:underline hover:opacity-80 transition-opacity text-xs">Tezpur University</a>
            <a href="https://www.dibru.ac.in" target="_blank" rel="noopener noreferrer" className="hover:underline hover:opacity-80 transition-opacity text-xs">Dibrugarh University</a>
            <a href="https://www.iitg.ac.in" target="_blank" rel="noopener noreferrer" className="hover:underline hover:opacity-80 transition-opacity text-xs">IIT Guwahati</a>
          </div>

          {/* Help & Support */}
          <div className="flex flex-col gap-2">
            <h4 className="mb-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>Help &amp; Support</h4>
            <Link href="/support" className="hover:underline hover:opacity-80 transition-opacity text-xs">Help &amp; Support</Link>
            <a href="mailto:omdasg11@gmail.com" className="hover:underline hover:opacity-80 transition-opacity text-xs">Contact Us</a>
            <a href="mailto:omdasg11@gmail.com?subject=Feedback for ExamArchive" className="hover:underline hover:opacity-80 transition-opacity text-xs">Send Feedback</a>
            <Link href="/terms" className="hover:underline hover:opacity-80 transition-opacity text-xs">Terms &amp; Conditions</Link>
          </div>
        </div>

        {/* ── Platform logos ── */}
        <div
          className="py-6 text-center"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <p className="mb-4 text-xs font-semibold" style={{ color: "var(--color-text)" }}>Built with the help of</p>
          <div className="flex flex-wrap justify-center items-center gap-6">
            {/* GitHub */}
            <a href="https://github.com/Omdas11/examarchive-v2" target="_blank" rel="noopener noreferrer" title="GitHub" className="opacity-70 hover:opacity-100 transition-opacity hover:scale-110" style={{ display: "inline-flex" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-label="GitHub"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            </a>
            {/* Google */}
            <a href="https://www.google.com" target="_blank" rel="noopener noreferrer" title="Google" className="opacity-70 hover:opacity-100 transition-opacity hover:scale-110" style={{ display: "inline-flex" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-label="Google">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </a>
            {/* Appwrite */}
            <a href="https://appwrite.io" target="_blank" rel="noopener noreferrer" title="Appwrite" className="opacity-70 hover:opacity-100 transition-opacity hover:scale-110" style={{ display: "inline-flex" }}>
              <svg width="36" height="36" viewBox="0 0 36 36" aria-label="Appwrite">
                <rect width="36" height="36" rx="8" fill="#f02e65" opacity="0.15"/>
                <text x="18" y="22" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="700" fontSize="7" fill="#f02e65">Appwrite</text>
              </svg>
            </a>
            {/* Next.js */}
            <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" title="Next.js" className="opacity-70 hover:opacity-100 transition-opacity hover:scale-110" style={{ display: "inline-flex" }}>
              <svg width="36" height="36" viewBox="0 0 36 36" aria-label="Next.js">
                <rect width="36" height="36" rx="8" fill="#000" opacity="0.1"/>
                <text x="18" y="22" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="700" fontSize="6.5" fill="currentColor">Next.js</text>
              </svg>
            </a>
          </div>
        </div>

        {/* ── University logos ── */}
        <div className="py-5 text-center" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="flex flex-wrap justify-center items-center gap-5">
            {[
              { href: "https://www.aus.ac.in", label: "Assam University", short: "AUS" },
              { href: "https://www.gauhati.ac.in", label: "Gauhati University", short: "GU" },
              { href: "https://www.tezu.ernet.in", label: "Tezpur University", short: "TU" },
              { href: "https://www.dibru.ac.in", label: "Dibrugarh University", short: "DU" },
              { href: "https://www.iitg.ac.in", label: "IIT Guwahati", short: "IITG" },
            ].map((u) => (
              <a
                key={u.href}
                href={u.href}
                target="_blank"
                rel="noopener noreferrer"
                title={u.label}
                className="opacity-70 hover:opacity-100 transition-opacity hover:scale-105"
                style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              >
                <svg width="40" height="40" viewBox="0 0 40 40" aria-label={u.label}>
                  <rect width="40" height="40" rx="8" fill="#1a365d" opacity="0.1"/>
                  <path d="M20 7l-11 5.5v2.5h22v-2.5L20 7z" fill="#1a365d" opacity="0.5"/>
                  <rect x="10" y="17" width="3.5" height="11" rx="1" fill="#1a365d" opacity="0.35"/>
                  <rect x="18" y="17" width="3.5" height="11" rx="1" fill="#1a365d" opacity="0.35"/>
                  <rect x="26.5" y="17" width="3.5" height="11" rx="1" fill="#1a365d" opacity="0.35"/>
                  <rect x="8" y="28" width="24" height="3" rx="1" fill="#1a365d" opacity="0.5"/>
                </svg>
                <span style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{u.short}</span>
              </a>
            ))}
          </div>
        </div>

        {/* ── Copyright ── */}
        <div
          className="pt-5 text-center"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            © {new Date().getFullYear()} ExamArchive · Built by students for students
          </p>
        </div>
      </div>
    </footer>
  );
}

