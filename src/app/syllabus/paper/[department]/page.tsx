import { notFound, permanentRedirect } from "next/navigation";
import { syllabusDeptSlugForPaperCode } from "@/lib/syllabus-departments";

/**
 * Legacy syllabus paper URL (/syllabus/paper/<CODE>). Papers now live at
 * /syllabus/paper/<department>/<CODE> — this route permanently redirects
 * there so old links, bookmarks and indexed URLs keep working.
 *
 * NOTE: the dynamic segment is named [department], not [paper_code],
 * because Next.js forbids two different slug names for the same dynamic
 * path position — /syllabus/paper/[paper_code] and
 * /syllabus/paper/[department]/[paper_code] would otherwise crash the
 * whole app at startup ("different slug names for the same dynamic
 * path"). The param here actually holds the paper code.
 */
export default async function LegacySyllabusPaperRedirect({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: paper_code } = await params;
  const code = decodeURIComponent(paper_code).toUpperCase();

  // Department from the code prefix (deterministic: PHYDSC401T -> physics).
  // Deliberately NO database lookup here: the redirect must throw before
  // the page shell streams, otherwise Next.js downgrades it to a
  // client-side redirect (HTTP 200 + RSC payload) instead of a 308. A
  // prefix-derived department is always right for these codes, and the
  // nested page re-validates the department from the rows anyway.
  const slug = syllabusDeptSlugForPaperCode(code);
  if (!slug) notFound();
  permanentRedirect(`/syllabus/paper/${slug}/${code}`);
}
