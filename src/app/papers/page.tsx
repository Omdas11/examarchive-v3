import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Papers",
  description: "Explore all exam papers in the ExamArchive.",
};

export default function PapersPage() {
  return (
    <section className="mx-auto px-4 py-20 text-center" style={{ maxWidth: "var(--max-w)" }}>
      {/* Icon */}
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: "var(--color-accent-soft)" }}>
        <svg
          className="h-10 w-10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
          style={{ color: "var(--color-primary)" }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
      </div>

      <h1 className="text-3xl font-bold">Papers</h1>
      <p className="mt-3 text-lg font-medium" style={{ color: "var(--color-primary)" }}>
        Under Development
      </p>
      <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: "var(--color-text-muted)" }}>
        A comprehensive papers catalog with advanced filtering, AI-powered search, and
        course-wise organisation is being built and will be available soon.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/browse" className="btn-primary px-6 py-2.5">
          Browse Papers Now
        </Link>
        <Link href="/" className="btn px-6 py-2.5">
          Back to Home
        </Link>
      </div>

      {/* Upcoming features teaser */}
      <div className="mt-12 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto text-left">
        {[
          {
            icon: "🔍",
            title: "Smart Search",
            desc: "AI-powered search across all papers, syllabi, and topics.",
          },
          {
            icon: "📁",
            title: "Course Catalog",
            desc: "Browse papers organised by course, department, and year.",
          },
          {
            icon: "⭐",
            title: "Bookmarks",
            desc: "Save and organise papers for quick access later.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="card p-4"
          >
            <p className="text-2xl mb-2">{f.icon}</p>
            <h3 className="text-sm font-semibold">{f.title}</h3>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
