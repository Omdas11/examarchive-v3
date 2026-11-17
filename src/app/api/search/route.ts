import { NextResponse, type NextRequest } from "next/server";
import { searchPapers, searchSyllabus } from "@/lib/d1";
import { syllabusDeptSlugForPaperCode } from "@/lib/syllabus-departments";

/**
 * Search suggestions for the header search box.
 * Cloudflare migration (Phase 6): reads from D1 via `src/lib/d1.ts`
 * instead of Appwrite. Papers match on course code, paper name, or
 * department (indexed LIKE, capped at 5); syllabi come from the `syllabus`
 * table, which is empty in the current data, so that half normally
 * returns nothing — same as before the port.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const [papers, syllabi] = await Promise.all([
      searchPapers(q, 5),
      searchSyllabus(q, 5),
    ]);

    const suggestions = [
      ...papers.map((paper) => ({
        type: "paper" as const,
        label: paper.course_name ?? paper.title ?? "Paper",
        sublabel: `${paper.course_code ?? "Paper code"}${paper.year ? ` · ${paper.year}` : ""}`,
        href: `/paper/${paper.id}`,
      })),
      ...syllabi.map((doc) => ({
        type: "syllabus" as const,
        label: doc.subject ?? doc.course_code ?? "Syllabus",
        sublabel: doc.course_code
          ? `${doc.course_code}${doc.semester ? ` · Sem ${doc.semester}` : ""}`
          : doc.university ?? "",
        href: doc.course_code
          ? (() => {
              const slug = syllabusDeptSlugForPaperCode(doc.course_code as string);
              return slug
                ? `/syllabus/paper/${slug}/${encodeURIComponent(doc.course_code as string)}`
                : `/syllabus/paper/${encodeURIComponent(doc.course_code as string)}`;
            })()
          : "/syllabus",
      })),
      {
        type: "browse" as const,
        label: `Search papers for "${q}"`,
        sublabel: "Browse all papers",
        href: `/browse?${new URLSearchParams({ search: q }).toString()}`,
      },
    ];

    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
