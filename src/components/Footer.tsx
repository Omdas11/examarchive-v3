import Link from "next/link";
import FooterContactModal from "@/components/FooterContactModal";

/** Partner/platform logos uploaded to /public/branding/footer/. */
const PLATFORM_LOGOS = [
  { href: "https://github.com/Omdas11/examarchive-v2", title: "GitHub",  src: "/branding/footer/partner-github.png" },
  { href: "https://www.google.com",                    title: "Google",  src: "/branding/footer/partner-google.png" },
  { href: "https://appwrite.io",                       title: "Appwrite", src: "/branding/footer/partner-appwrite.png" },
  // Note: filename was uploaded as "partner-netxjs.png" (typo for "nextjs") — kept as-is to match the actual file.
  { href: "https://nextjs.org",                        title: "Next.js", src: "/branding/footer/partner-netxjs.png" },
];

/** University partner logos uploaded to /public/branding/footer/. */
const UNIVERSITY_LOGOS = [
  { href: "https://www.aus.ac.in",       label: "Assam University",    short: "AUS",  src: "/branding/footer/partner-au.png" },
  { href: "https://www.gauhati.ac.in",   label: "Gauhati University",  short: "GU",   src: "/branding/footer/partner-gu.jpeg" },
  { href: "https://www.tezu.ernet.in",   label: "Tezpur University",   short: "TU",   src: "/branding/footer/partner-tu.png" },
  { href: "https://www.dibru.ac.in",     label: "Dibrugarh University",short: "DU",   src: "/branding/footer/partner-du.png" },
  { href: "https://www.iitg.ac.in",      label: "IIT Guwahati",        short: "IITG", src: "/branding/footer/partner-iitg.png" },
];

export default function Footer() {
  return (
    <footer
      className="mt-12 pt-10 pb-6 text-sm"
      style={{
        background: "var(--color-footer-bg, #f8f9fa)",
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
            <FooterContactModal label="Help &amp; Support" />
            <FooterContactModal label="Contact Us" />
            <FooterContactModal label="Send Feedback" />
            <Link href="/terms" className="hover:underline hover:opacity-80 transition-opacity text-xs">Terms &amp; Conditions</Link>
            <Link href="/privacy" className="hover:underline hover:opacity-80 transition-opacity text-xs">Privacy Policy</Link>
          </div>
        </div>

        {/* ── Platform logos ── */}
        <div
          className="py-6 text-center"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <p className="mb-4 text-xs font-semibold" style={{ color: "var(--color-text)" }}>Built with the help of</p>
          <div className="flex flex-wrap justify-center items-center gap-6">
            {PLATFORM_LOGOS.map((logo) => (
              <a
                key={logo.href}
                href={logo.href}
                target="_blank"
                rel="noopener noreferrer"
                title={logo.title}
                className="opacity-70 hover:opacity-100 transition-opacity hover:scale-110"
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.src}
                  alt={logo.title}
                  width={36}
                  height={36}
                  style={{ objectFit: "contain", maxHeight: 36 }}
                />
              </a>
            ))}
          </div>
        </div>

        {/* ── University logos ── */}
        <div className="py-5 text-center" style={{ borderTop: "1px solid var(--color-border)" }}>
          <p className="mb-4 text-xs font-semibold" style={{ color: "var(--color-text)" }}>Partner Institutions</p>
          <div className="flex flex-wrap justify-center items-center gap-5">
            {UNIVERSITY_LOGOS.map((u) => (
              <a
                key={u.href}
                href={u.href}
                target="_blank"
                rel="noopener noreferrer"
                title={u.label}
                className="opacity-70 hover:opacity-100 transition-opacity hover:scale-105"
                style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u.src}
                  alt={u.label}
                  width={40}
                  height={40}
                  style={{ objectFit: "contain", maxHeight: 40 }}
                />
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

