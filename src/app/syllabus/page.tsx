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

/**
 * Group syllabi by University → Programme → Subject → Semester.
 * Each level is a Map to preserve insertion order and allow efficient lookups.
 */
function groupSyllabi(syllabi: Syllabus[]): Map<string, Map<string, Map<string, Syllabus[]>>> {
  const tree = new Map<string, Map<string, Map<string, Syllabus[]>>>();

  for (const s of syllabi) {
    const uni = s.university || "Unknown University";
    const prog = s.programme || "General";
    const subjectKey = s.subject || s.course_name || "Unknown Subject";

    if (!tree.has(uni)) tree.set(uni, new Map());
    const progMap = tree.get(uni)!;

    if (!progMap.has(prog)) progMap.set(prog, new Map());
    const subjectMap = progMap.get(prog)!;

    if (!subjectMap.has(subjectKey)) subjectMap.set(subjectKey, []);
    subjectMap.get(subjectKey)!.push(s);
  }

  return tree;
}

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

  const grouped = groupSyllabi(syllabi);

  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Syllabus</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Browse and download approved syllabi grouped by university and programme.
      </p>

      {syllabi.length > 0 ? (
        <div className="mt-8 space-y-10">
          {Array.from(grouped.entries()).map(([uni, progMap]) => (
            <div key={uni}>
              {/* University heading */}
              <h2 className="text-lg font-bold border-b pb-2" style={{ borderColor: "var(--color-border)" }}>
                {uni}
              </h2>

              <div className="mt-4 space-y-6">
                {Array.from(progMap.entries()).map(([prog, subjectMap]) => (
                  <div key={prog}>
                    {/* Programme sub-heading */}
                    <h3 className="text-sm font-semibold mb-3 inline-block rounded-full px-3 py-1"
                      style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}>
                      {prog}
                    </h3>

                    <div className="space-y-4">
                      {Array.from(subjectMap.entries()).map(([subject, entries]) => (
                        <div key={subject}>
                          {/* Subject heading */}
                          <h4 className="text-sm font-medium mb-2" style={{ color: "var(--color-text-muted)" }}>
                            {subject}
                          </h4>

                          {/* Semester cards */}
                          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                            {entries.map((s) => {
                              const semNum = parseInt(s.semester ?? "", 10);
                              const semRoman = !isNaN(semNum) ? toRoman(semNum) : null;
                              return (
                                <div key={s.id} className="card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                                  {/* Semester + year badges */}
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {s.semester && (
                                      <span
                                        className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                                        style={{ background: "var(--color-border)", color: "var(--color-primary)" }}
                                      >
                                        Sem {semRoman || s.semester}
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
                                    {s.department && (
                                      <span
                                        className="inline-block rounded-full px-2 py-0.5 text-[11px]"
                                        style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
                                      >
                                        {s.department}
                                      </span>
                                    )}
                                  </div>

                                  {/* Download link */}
                                  <div className="flex items-center justify-end">
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
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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

