import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { getServerUser } from "@/lib/auth";
import { uploadFileToAppwrite, getAppwriteFileUrl } from "@/lib/appwrite";

/**
 * POST /api/upload
 * Accepts a multipart form upload, stores the **file in Appwrite Storage** and
 * inserts a *pending* paper metadata row in **Supabase**.
 * Requires authentication (enforced here and in middleware).
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();

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

  // ── 1. Upload file to Appwrite Storage (server-only key, never exposed) ──
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

  // ── 2. Persist metadata in Supabase ──
  const supabase = await createClient();
  const { error: insertError } = await supabase.from("papers").insert({
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

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
