import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { getServerUser } from "@/lib/auth";

/**
 * POST /api/upload
 * Accepts a multipart form upload, stores the file in Supabase Storage and
 * inserts a *pending* paper row.  Requires authentication.
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

  const supabase = await createClient();

  // Upload file to Supabase Storage
  const filePath = `papers/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(filePath, file, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("uploads").getPublicUrl(filePath);

  // Insert paper record (unapproved by default)
  const { error: insertError } = await supabase.from("papers").insert({
    title,
    course_code: courseCode,
    course_name: courseName,
    department,
    year: Number(year),
    semester,
    exam_type: examType,
    file_url: publicUrl,
    uploaded_by: user.id,
    approved: false,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
