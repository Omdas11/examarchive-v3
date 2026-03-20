import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";

/**
 * GET: Returns a list of approved papers and syllabus for source PDF selection
 */
export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  try {
    const db = adminDatabases();

    const [papersRes, syllabusRes] = await Promise.all([
      db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("approved", true),
        Query.limit(20),
        Query.orderDesc("$createdAt"),
      ]),
      db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [
        Query.equal("approval_status", "approved"),
        Query.limit(10),
        Query.orderDesc("$createdAt"),
      ]),
    ]);

    const papers = papersRes.documents.map((doc) => ({
      id: doc.$id,
      paper_name: doc.paper_name as string | undefined,
      title: doc.title as string | undefined,
      course_code: doc.course_code as string | undefined,
    }));

    const syllabus = syllabusRes.documents.map((doc) => ({
      id: doc.$id,
      name: doc.name as string | undefined,
      title: doc.title as string | undefined,
      course_code: doc.course_code as string | undefined,
    }));

    return NextResponse.json({ papers, syllabus });
  } catch (error) {
    console.error("[Archive list] Error:", error);
    return NextResponse.json({ error: "Failed to fetch archive list." }, { status: 500 });
  }
}
