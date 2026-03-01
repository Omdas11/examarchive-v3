import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      {/* Hero */}
      <section className="py-14 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Exam<span style={{ color: "var(--color-primary)" }}>Archive</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: "var(--color-text-muted)" }}>
          A simple and community-driven archive of past exam question papers, notes, and syllabi for students.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/browse" className="btn-primary">Browse Papers</Link>
          <Link href="/upload" className="btn">Upload Paper</Link>
          <Link href="/admin" className="btn">Login</Link>
        </div>
      </section>

      {/* Search */}
      <section className="py-6">
        <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Search papers, subjects, codes…"
            className="input-field flex-1"
          />
          <button className="btn text-xs">Mode ▾</button>
          <button className="btn-primary text-xs">Search</button>
        </div>
      </section>

      {/* Notices & Updates */}
      <section className="py-6">
        <h2 className="mb-3 text-lg font-semibold">Notices &amp; Updates</h2>
        <div className="card p-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          No notices available at the moment.
        </div>
      </section>

      {/* Academic Calendar */}
      <section className="py-6">
        <h2 className="mb-3 text-lg font-semibold">Academic Calendar</h2>
        <div className="card p-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          Calendar coming soon.
        </div>
      </section>
    </div>
  );
}
