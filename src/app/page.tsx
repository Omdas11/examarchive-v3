import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import HomeSearch from "@/components/HomeSearch";

export default async function HomePage() {
  const user = await getServerUser();

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
          {!user && <Link href="/login" className="btn">Login</Link>}
          {user && <Link href="/profile" className="btn">My Profile</Link>}
        </div>
      </section>

      {/* Search */}
      <section className="py-6">
        <HomeSearch />
      </section>

      {/* Notices & Updates */}
      <section className="py-6">
        <h2 className="mb-3 text-lg font-semibold">Notices &amp; Updates</h2>
        <div className="card p-8 text-center">
          <svg className="mx-auto h-10 w-10 opacity-30 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Coming Soon</p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Notices and updates will appear here once available.
          </p>
        </div>
      </section>

      {/* Academic Calendar */}
      <section className="py-6">
        <h2 className="mb-3 text-lg font-semibold">Academic Calendar</h2>
        <div className="card p-8 text-center">
          <svg className="mx-auto h-10 w-10 opacity-30 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Under Development</p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            The academic calendar feature is being built and will be available soon.
          </p>
        </div>
      </section>
    </div>
  );
}
