import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support, Feedback, and Bug Reports",
  description:
    "Contact ExamArchive support, send feedback, and report issues related to papers, syllabus, and account usage.",
  keywords: ["examarchive support", "report bug", "student feedback", "help center"],
  alternates: { canonical: "/support" },
  openGraph: {
    title: "Support | ExamArchive",
    description: "Get help, report issues, or send feedback to the ExamArchive team.",
    url: "https://examarchive.dev/support",
    type: "website",
  },
};

const contacts = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
    label: "Email Us",
    desc: "contact@examarchive.dev",
    href: "mailto:contact@examarchive.dev",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
    label: "Send Feedback",
    desc: "Share your thoughts",
    href: "mailto:feedback@examarchive.dev",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
    label: "Report a Bug",
    desc: "Let us know about issues",
    href: "mailto:bugs@examarchive.dev",
  },
];

export default function SupportPage() {
  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Help &amp; Support</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Need help? Reach out to us through any of the channels below.
      </p>

      {/* Contact cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {contacts.map((c) => (
          <a
            key={c.label}
            href={c.href}
            className="card flex items-start gap-3 p-5 transition-shadow hover:shadow-md"
          >
            <span style={{ color: "var(--color-primary)" }}>{c.icon}</span>
            <div>
              <p className="font-semibold text-sm">{c.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{c.desc}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Admin Application */}
      <div className="card mt-8 p-6">
        <h2 className="text-lg font-semibold">Admin Application</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Interested in becoming an admin or moderator? Fill out the form below and we&apos;ll review your application.
        </p>
        <div className="mt-4 rounded-md p-8 text-center text-sm" style={{ background: "var(--color-accent-soft)", color: "var(--color-text-muted)" }}>
          Application form coming soon.
        </div>
      </div>
    </section>
  );
}
