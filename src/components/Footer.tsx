import Link from "next/link";
import VisitorTracker from "@/components/VisitorTracker";
import FooterContactModal from "@/components/FooterContactModal";

/** Partner/platform logos uploaded to /public/branding/footer/. */
const PLATFORM_LOGOS = [
  { href: "https://github.com/Omdas11/examarchive-v2", title: "GitHub",  src: "/branding/footer/partner-github.png" },
  { href: "https://www.google.com",                    title: "Google",  src: "/branding/footer/partner-google.png" },
  { href: "https://appwrite.io",                       title: "Appwrite", src: "/branding/footer/partner-appwrite.png" },
  // Note: filename was uploaded as "partner-netxjs.png" (typo for "nextjs") — kept as-is to match the actual file.
  { href: "https://nextjs.org",                        title: "Next.js", src: "/branding/footer/partner-netxjs.png" },
];

export default function Footer() {
  return (
    <footer
      className="mt-12 pt-12 pb-8 text-sm"
      style={{
        background: "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 4%, var(--color-surface)) 0%, var(--color-surface) 100%)",
        borderTop: "1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border))",
        color: "var(--color-text-muted)",
        letterSpacing: "0.01em",
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
            <h4 className="mb-1 text-sm font-semibold tracking-wide" style={{ color: "var(--color-text)" }}>Resources</h4>
            <Link href="/" className="hover:underline hover:opacity-80 transition-opacity text-xs">Home</Link>
            <Link href="/browse" className="hover:underline hover:opacity-80 transition-opacity text-xs">Browse Question Papers</Link>
            <Link href="/upload" className="hover:underline hover:opacity-80 transition-opacity text-xs">Upload Question Paper</Link>
            <Link href="/syllabus" className="hover:underline hover:opacity-80 transition-opacity text-xs">Syllabus</Link>
            <Link href="/about" className="hover:underline hover:opacity-80 transition-opacity text-xs">About ExamArchive</Link>
          </div>

          {/* Platform info */}
          <div className="flex flex-col gap-2">
            <h4 className="mb-1 text-sm font-semibold tracking-wide" style={{ color: "var(--color-text)" }}>Platform</h4>
            <span className="text-xs">
              Currently in <strong>Early Access</strong> · Starting with Haflong Government College
            </span>
            <span className="text-xs">
              Community-driven · Admin-verified
            </span>
            <Link href="/about" className="hover:underline hover:opacity-80 transition-opacity text-xs">
              Learn more →
            </Link>
          </div>

          {/* Help & Support */}
          <div className="flex flex-col gap-2">
            <h4 className="mb-1 text-sm font-semibold tracking-wide" style={{ color: "var(--color-text)" }}>Help &amp; Support</h4>
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
          <p className="mb-4 text-xs font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--color-text)" }}>Built with the help of</p>
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

        {/* ── Footer meta ── */}
        <div
          className="pt-5 text-center flex flex-col items-center gap-2"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            © {new Date().getFullYear()} ExamArchive · Built by students for students · Early Access
          </p>
          <VisitorTracker />
        </div>
      </div>
    </footer>
  );
}
