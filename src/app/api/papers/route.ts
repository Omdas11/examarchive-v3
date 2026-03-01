import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabaseServer";

/**
 * GET /api/papers
 * Returns approved papers. Supports the same query-param filters as the browse page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();

  let query = supabase
    .from("papers")
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending: false });

  const department = searchParams.get("department");
  const courseCode = searchParams.get("course_code");
  const year = searchParams.get("year");
  const semester = searchParams.get("semester");
  const examType = searchParams.get("exam_type");
  const search = searchParams.get("search");

  if (department) query = query.eq("department", department);
  if (courseCode) query = query.eq("course_code", courseCode);
  if (year) query = query.eq("year", Number(year));
  if (semester) query = query.eq("semester", semester);
  if (examType) query = query.eq("exam_type", examType);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
