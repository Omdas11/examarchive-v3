import type { Metadata } from "next";
import { createClient } from "@/lib/supabaseServer";
import type { Syllabus } from "@/types";

export const metadata: Metadata = {
  title: "Syllabus",
  description: "Browse course syllabi by department.",
};

export default async function SyllabusPage() {
  const supabase = await createClient();

  const { data: syllabi } = await supabase
    .from("syllabi")
    .select("*")
    .order("course_code", { ascending: true });

  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Syllabus</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Browse and download syllabi for various courses.
      </p>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <select className="input-field sm:max-w-[200px]">
          <option value="">University</option>
        </select>
        <select className="input-field sm:max-w-[200px]">
          <option value="">Programme</option>
        </select>
        <input type="text" placeholder="Search syllabus…" className="input-field flex-1" />
      </div>

      {syllabi && syllabi.length > 0 ? (
        <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {syllabi.map((s: Syllabus) => (
            <div key={s.id} className="card p-4">
              <h3 className="font-semibold">{s.course_name}</h3>
              <div className="mt-2 flex flex-wrap gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <span>{s.department}</span>
                <span>·</span>
                <span>{s.course_code}</span>
              </div>
              <a
                href={s.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium"
                style={{ color: "var(--color-primary)" }}
              >
                Download PDF
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-12 text-center">
          <svg className="mx-auto h-12 w-12 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg>
          <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>No syllabi available.</p>
        </div>
      )}
    </section>
  );
}
