import { NextResponse } from "next/server";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/syllabus
 * Public JSON list of approved syllabus library entries (department PDFs).
 * Used by the native ExamArchive app.
 */
export async function GET() {
  try {
    const db = adminDatabases();
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.syllabus,
      [
        Query.equal("approval_status", "approved"),
        Query.orderAsc("subject"),
        Query.limit(100),
      ],
    );
    return NextResponse.json({
      count: documents.length,
      items: documents.map((d) => ({
        id: d.$id,
        subject: d.subject ?? "",
        department: d.department ?? "",
        course_name: d.course_name ?? "",
        year: d.year ?? null,
        university: d.university ?? "",
        file_url: d.file_url ?? "",
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
