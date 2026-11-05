import { notFound, permanentRedirect } from "next/navigation";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import {
  syllabusDeptBySubjectCode,
  syllabusDeptSlugForPaperCode,
} from "@/lib/syllabus-departments";

/**
 * Legacy syllabus paper URL (/syllabus/paper/<CODE>). Papers now live at
 * /syllabus/paper/<department>/<CODE> — this route permanently redirects
 * there so old links, bookmarks and indexed URLs keep working.
 */
export default async function LegacySyllabusPaperRedirect({
  params,
}: {
  params: Promise<{ paper_code: string }>;
}) {
  const { paper_code } = await params;
  const code = decodeURIComponent(paper_code).toUpperCase();

  // Department from the paper's syllabus rows (ground truth); fall back to
  // the code prefix when the paper has no rows.
  let slug = syllabusDeptSlugForPaperCode(code);
  try {
    const db = adminDatabases();
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
      Query.equal("paper_code", code),
      Query.limit(1),
      Query.select(["subject"]),
    ]);
    const subject = String(res.documents[0]?.subject ?? "").trim().toUpperCase();
    const bySubject = syllabusDeptBySubjectCode(subject);
    if (bySubject) slug = bySubject.slug;
  } catch {
    // fall through to the code-derived slug
  }

  if (!slug) notFound();
  permanentRedirect(`/syllabus/paper/${slug}/${code}`);
}
