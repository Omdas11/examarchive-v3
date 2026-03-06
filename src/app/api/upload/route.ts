import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  adminStorage,
  getAppwriteFileUrl,
  DATABASE_ID,
  COLLECTION,
  BUCKET_ID,
  ID,
} from "@/lib/appwrite";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload
 *
 * Accepts **JSON metadata only** — the file itself has already been uploaded
 * directly from the browser to Appwrite Storage (see UploadForm.tsx).
 * This route simply stores the paper metadata in the Appwrite Database
 * with `approved: false` so it enters the admin moderation queue.
 *
 * Expected JSON body:
 * {
 *   fileId:     string  — Appwrite file ID returned by the client-side upload
 *   title:      string
 *   course_code:  string
 *   course_name:  string
 *   department:   string
 *   year:         number | string
 *   semester:     string
 *   exam_type:    string
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
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const { fileId, title, course_code, course_name, department, year, semester, exam_type, institution } = body as {
      fileId?: string;
      title?: string;
      course_code?: string;
      course_name?: string;
      department?: string;
      year?: number | string;
      semester?: string;
      exam_type?: string;
      institution?: string;
    };

    if (!fileId || !title || !course_code || !course_name || !department || !year || !semester || !exam_type) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    const fileUrl = getAppwriteFileUrl(fileId);

    // Verify the file actually exists in Appwrite Storage.
    // This prevents a malicious request from associating an arbitrary fileId
    // (e.g. belonging to another user) with a new database entry.
    try {
      const storage = adminStorage();
      await storage.getFile(BUCKET_ID, fileId);
    } catch {
      return NextResponse.json(
        { error: "File not found in storage. Please re-upload the file." },
        { status: 404 },
      );
    }

    try {
      const db = adminDatabases();
      await db.createDocument(DATABASE_ID, COLLECTION.papers, ID.unique(), {
        title,
        course_code,
        course_name,
        department,
        year: Number(year),
        semester,
        exam_type,
        file_url: fileUrl,
        uploaded_by: user.id,
        approved: false,
        ...(institution ? { institution } : {}),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[api/upload] Unhandled error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

