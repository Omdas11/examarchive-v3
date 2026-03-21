import { NextResponse } from "next/server";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import { getServerUser } from "@/lib/auth";

/**
 * GET /api/dashboard/stats
 * Returns stats for the currently authenticated user:
 * - upload_count (approved papers uploaded)
 * - pending_count (papers awaiting approval)
 * - xp
 * - streak_days
 * - tier
 * - recent_papers: last 5 approved papers this user uploaded
 */
export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = adminDatabases();

    // Fetch approved papers uploaded by this user
    const [approvedResult, pendingResult] = await Promise.all([
      db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("uploaded_by", user.id),
        Query.equal("approved", true),
        Query.orderDesc("$createdAt"),
        Query.limit(5),
      ]),
      db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("uploaded_by", user.id),
        Query.equal("approved", false),
        Query.limit(1),
      ]),
    ]);

    const recentPapers = approvedResult.documents.map((doc) => ({
      id: doc.$id,
      title: (doc.paper_name as string) || (doc.course_code as string) || "Untitled Paper",
      course_code: (doc.course_code as string) || "",
      year: (doc.year as number) || 0,
      semester: (doc.semester as string) || "",
      department: (doc.department as string) || "",
      created_at: doc.$createdAt,
    }));

    return NextResponse.json({
      upload_count: approvedResult.total,
      pending_count: pendingResult.total,
      xp: user.xp,
      streak_days: user.streak_days,
      tier: user.tier ?? "bronze",
      recent_papers: recentPapers,
    });
  } catch (err) {
    console.error("[dashboard/stats]", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
