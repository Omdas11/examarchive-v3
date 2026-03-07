import type { Metadata } from "next";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import type { Syllabus } from "@/types";
import { toSyllabus } from "@/types";
import { toRoman } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Syllabus",
  description: "Browse approved course syllabi by department.",
};

export default async function SyllabusPage() {
  let syllabi: Syllabus[] = [];
  try {
    const db = adminDatabases();
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.syllabus,
      [
        Query.equal("approval_status", "approved"),
        Query.orderDesc("$createdAt"),
      ],
    );
    syllabi = documents.map(toSyllabus);
  } catch {
    // collection may not exist yet
  }

  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Syllabus</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Browse and download approved syllabi for various courses.
      </p>

      {syllabi && syllabi.length > 0 ? (
        <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {syllabi.map((s: Syllabus) => {
            const semNum = parseInt(s.semester ?? "", 10);
            const semRoman = !isNaN(semNum) ? toRoman(semNum) : null;
            return (
              <div key={s.id} className="card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                {/* Subject heading */}
                <h3 className="font-semibold text-sm leading-snug">{s.subject || s.course_name}</h3>

                {/* University */}
                {s.university && (
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {s.university}
                  </p>
                )}

                {/* Badges row */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.department && (
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: "var(--color-border)", color: "var(--color-primary)" }}
                    >
                      {s.department}
                    </span>
                  )}
                  {s.semester && (
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[11px]"
                      style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
                    >
                      Sem {semRoman || s.semester}
                    </span>
                  )}
                  {s.programme && (
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[11px]"
                      style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
                    >
                      {s.programme}
                    </span>
                  )}
                  {s.year != null && s.year > 0 && (
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[11px]"
                      style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
                    >
                      {s.year}
                    </span>
                  )}
                </div>

                {/* Download link */}
                <div className="mt-3 flex items-center justify-end">
                  <a
                    href={s.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ color: "var(--color-primary)" }}
                  >
                    Download PDF
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
                    </svg>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-12 text-center">
          <svg className="mx-auto h-12 w-12 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg>
          <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>No approved syllabi yet.</p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <a href="/upload?type=syllabus" style={{ color: "var(--color-primary)" }}>Upload a syllabus</a> to get started.
          </p>
        </div>
      )}
    </section>
  );
}

