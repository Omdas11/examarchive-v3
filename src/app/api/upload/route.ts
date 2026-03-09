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
 * This route:
 * 1. Creates an entry in the `uploads` collection (status: "pending") to track the raw upload.
 * 2. Creates a paper document in the `papers` collection with `approved: false`
 *    so it enters the admin moderation queue.
 *
 * Expected JSON body fields (must match the `papers` collection schema):
 * {
 *   fileId:      string  — Appwrite file ID returned by the client-side upload
 *   file_name:   string  — Original filename (stored in uploads collection)
 *   course_name: string  — Full course / paper name
 *   department:  string  — Department or academic stream
 *   year:        number | string
 *   semester?:   string  — e.g. "1st", "2nd" (optional)
 *   exam_type?:  string  — "Theory" | "Practical" (optional)
 *   institute?:  string  — University or institution name (optional)
 *   paper_type?: string  — "DSC" | "DSM" | "SEC" | "IDC" | "GE" | "CC" | "DSE" | "GEC" (optional)
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

    const {
      fileId,
      file_name,
      course_name,
      department,
      year,
      semester,
      exam_type,
      institute,
      paper_type,
    } = body as {
      fileId?: string;
      file_name?: string;
      course_name?: string;
      department?: string;
      year?: number | string;
      semester?: string;
      exam_type?: string;
      institute?: string;
      paper_type?: string;
    };

    if (!fileId || !course_name || !department || !year) {
      return NextResponse.json(
        { error: "Required fields missing: fileId, course_name, department, year." },
        { status: 400 },
      );
    }

    const yearNum = Number(year);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      return NextResponse.json({ error: "Invalid year value." }, { status: 400 });
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

    const db = adminDatabases();

    // Step 1 — Record the raw upload in the `uploads` collection (status: "pending").
    // This provides an audit trail of all file uploads independent of approval status.
    try {
      await db.createDocument(DATABASE_ID, COLLECTION.uploads, ID.unique(), {
        user_id: user.id,
        file_id: fileId,
        file_name: file_name ?? "",
        status: "pending",
      });
    } catch (uploadErr: unknown) {
      // Non-fatal: the uploads collection may not exist yet in some deployments.
      console.warn("[api/upload] Could not write to uploads collection:", uploadErr);
    }

    // Step 2 — Create the paper document using only fields present in the schema.
    // Fields not present in the `papers` collection schema are intentionally omitted.
    try {
      await db.createDocument(DATABASE_ID, COLLECTION.papers, ID.unique(), {
        course_name,
        department,
        year: yearNum,
        file_url: fileUrl,
        uploaded_by: user.id,
        approved: false,
        ...(semester ? { semester } : {}),
        ...(exam_type ? { exam_type } : {}),
        ...(institute ? { institute } : {}),
        ...(paper_type ? { paper_type } : {}),
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

