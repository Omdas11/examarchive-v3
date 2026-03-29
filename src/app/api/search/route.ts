import { NextResponse, type NextRequest } from "next/server";
import {
  adminDatabases,
  COLLECTION,
  DATABASE_ID,
  Query,
} from "@/lib/appwrite";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const db = adminDatabases();
    const [papers, syllabi] = await Promise.all([
      db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("approved", true),
        Query.search("course_name", q),
        Query.limit(5),
      ]),
      db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [
        Query.equal("approval_status", "approved"),
        Query.search("subject", q),
        Query.limit(5),
      ]),
    ]);

    const suggestions = [
      ...papers.documents.map((doc) => ({
        type: "paper" as const,
        label: (doc.course_name as string) ?? (doc.title as string) ?? "Paper",
        sublabel: `${doc.course_code ?? doc.subject ?? "Paper code"}${doc.year ? ` · ${doc.year}` : ""}`,
        href: `/paper/${doc.$id}`,
      })),
      ...syllabi.documents.map((doc) => ({
        type: "syllabus" as const,
        label: (doc.subject as string) ?? (doc.course_name as string) ?? "Syllabus",
        sublabel: doc.course_code
          ? `${doc.course_code}${doc.semester ? ` · Sem ${doc.semester}` : ""}`
          : doc.university ?? "",
        href: doc.course_code ? `/syllabus/paper/${encodeURIComponent(doc.course_code as string)}` : "/syllabus",
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

