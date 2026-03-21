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
 * Returns stats for the currently authenticated user sourced from AppWrite:
 * - upload_count  : from users.upload_count (backend-maintained counter)
 * - pending_count : live count of papers with approved=false
 * - xp            : from UserProfile (already fetched by getServerUser)
 * - streak_days   : from UserProfile
 * - tier          : from UserProfile
 * - recent_papers : last 5 approved papers this user uploaded
 */
export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = adminDatabases();

    // Fetch approved papers + pending count in parallel
    const [approvedResult, pendingResult, userDoc] = await Promise.all([
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
      // Fetch upload_count from users collection (backend-maintained counter)
      db.getDocument(DATABASE_ID, COLLECTION.users, user.id).catch(() => null),
    ]);

    // Prefer the backend-maintained upload_count; fall back to live papers total
    const uploadCount: number =
      userDoc && typeof userDoc.upload_count === "number" && userDoc.upload_count >= 0
        ? (userDoc.upload_count as number)
        : approvedResult.total;

    const recentPapers = approvedResult.documents.map((doc) => ({
      id: doc.$id,
      title:
        (doc.paper_name as string) ||
        (doc.course_code as string) ||
        "Untitled Paper",
      course_code: (doc.course_code as string) || "",
      year: (doc.year as number) || 0,
      semester: (doc.semester as string) || "",
      department: (doc.department as string) || "",
      created_at: doc.$createdAt,
    }));

    return NextResponse.json({
      upload_count: uploadCount,
      pending_count: pendingResult.total,
      xp: user.xp,
      streak_days: user.streak_days,
      tier: user.tier ?? "bronze",
      recent_papers: recentPapers,
    });
  } catch (err) {
    // Log only the error type/message, not the full stack, to avoid leaking sensitive paths
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dashboard/stats] Error:", message);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
