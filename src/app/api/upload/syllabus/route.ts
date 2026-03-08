import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  adminStorage,
  DATABASE_ID,
  COLLECTION,
  SYLLABUS_BUCKET_ID,
  ID,
} from "@/lib/appwrite";

export const dynamic = "force-dynamic";

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";

function getSyllabusFileUrl(fileId: string): string {
  return `${APPWRITE_ENDPOINT}/storage/buckets/${SYLLABUS_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
}

/**
 * POST /api/upload/syllabus
 *
 * Accepts JSON metadata only — the file has already been uploaded directly
 * from the browser to Appwrite Storage (syllabus-files bucket).
 * This route stores the syllabus metadata in the Appwrite Database
 * with `approval_status: "pending"` for admin review.
 *
 * Expected JSON body:
 * {
 *   fileId:       string  — Appwrite file ID in the syllabus-files bucket
 *   university:   string
 *   subject:      string
 *   department:   string
 *   semester:     string
 *   programme:    string
 *   year:         number | string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { fileId, university, subject, department, semester, programme, year } = body as {
      fileId?: string;
      university?: string;
      subject?: string;
      department?: string;
      semester?: string;
      programme?: string;
      year?: number | string;
    };

    if (!fileId || !university || !subject || !department || !year) {
      return NextResponse.json(
        { error: "Required fields missing: fileId, university, subject, department, year." },
        { status: 400 },
      );
    }

    // semester is optional — departmental syllabi (covering all semesters) use an empty string

    const fileUrl = getSyllabusFileUrl(fileId);

    const yearNum = Number(year);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      return NextResponse.json({ error: "Invalid year value." }, { status: 400 });
    }

    // Verify the file exists in the syllabus-files bucket.
    try {
      const storage = adminStorage();
      await storage.getFile(SYLLABUS_BUCKET_ID, fileId);
    } catch {
      return NextResponse.json(
        { error: "File not found in syllabus storage. Please re-upload the file." },
        { status: 404 },
      );
    }

    try {
      const db = adminDatabases();
      await db.createDocument(DATABASE_ID, COLLECTION.syllabus, ID.unique(), {
        university,
        subject,
        department,
        semester: semester || "",
        programme: programme || "",
        year: yearNum,
        uploader_id: user.id,
        approval_status: "pending",
        file_url: fileUrl,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[api/upload/syllabus] Unhandled error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
