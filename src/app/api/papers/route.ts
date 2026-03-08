import { NextResponse, type NextRequest } from "next/server";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";

/**
 * GET /api/papers
 * Returns approved papers. Supports the same query-param filters as the browse page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const queries: string[] = [
      Query.equal("approved", true),
      Query.orderDesc("$createdAt"),
    ];

    const department = searchParams.get("department");
    const courseCode = searchParams.get("course_code");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const examType = searchParams.get("exam_type");
    const search = searchParams.get("search");

    if (department) queries.push(Query.equal("department", department));
    if (courseCode) queries.push(Query.equal("course_code", courseCode));
    if (year) {
      const yearNum = Number(year);
      if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
        queries.push(Query.equal("year", yearNum));
      }
    }
    if (semester) queries.push(Query.equal("semester", semester));
    if (examType) queries.push(Query.equal("exam_type", examType));
    if (search) queries.push(Query.search("title", search));

    // Cap results to prevent unbounded queries
    queries.push(Query.limit(200));

    const db = adminDatabases();
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.papers,
      queries,
    );

    return NextResponse.json(documents);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
