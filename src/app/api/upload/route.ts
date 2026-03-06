import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  uploadFileToAppwrite,
  getAppwriteFileUrl,
  DATABASE_ID,
  COLLECTION,
  ID,
} from "@/lib/appwrite";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload
 * Accepts a multipart form upload, stores the **file in Appwrite Storage** and
 * inserts a *pending* paper metadata document in **Appwrite Databases**.
 * Requires authentication (enforced here and in middleware).
 */
export async function POST(request: NextRequest) {
  // Always return JSON so clients can safely call res.json()
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseErr) {
      const msg =
        parseErr instanceof Error
          ? parseErr.message
          : "Failed to parse form data – file may be too large";
      return NextResponse.json({ error: msg }, { status: 413 });
    }

    const title = formData.get("title") as string | null;
    const courseCode = formData.get("course_code") as string | null;
    const courseName = formData.get("course_name") as string | null;
    const department = formData.get("department") as string | null;
    const year = formData.get("year") as string | null;
    const semester = formData.get("semester") as string | null;
    const examType = formData.get("exam_type") as string | null;
    const file = formData.get("file") as File | null;

    if (!title || !courseCode || !courseName || !department || !year || !semester || !examType || !file) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    // ── 1. Upload file to Appwrite Storage ──
    let fileUrl: string;
    try {
      const { fileId } = await uploadFileToAppwrite(file);
      fileUrl = getAppwriteFileUrl(fileId);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `File upload failed: ${String(err)}`;
      console.error("[api/upload] Appwrite upload error:", err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // ── 2. Persist metadata in Appwrite Databases ──
    try {
      const db = adminDatabases();
      await db.createDocument(DATABASE_ID, COLLECTION.papers, ID.unique(), {
        title,
        course_code: courseCode,
        course_name: courseName,
        department,
        year: Number(year),
        semester,
        exam_type: examType,
        file_url: fileUrl,
        uploaded_by: user.id,
        approved: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    // Final safety net – never let an unhandled exception reach the client as HTML
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[api/upload] Unhandled error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
