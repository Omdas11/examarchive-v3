import { NextResponse } from "next/server";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import { getServerUser } from "@/lib/auth";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  href: string;
  time: string;
}

/**
 * GET /api/notifications
 * Returns a small feed of useful notifications:
 * - recently approved papers (last 14 days) for everyone,
 * - the signed-in user's own recent upload decisions.
 */
export async function GET() {
  const notifications: AppNotification[] = [];

  try {
    const db = adminDatabases();
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Recently approved papers
    const recent = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
      Query.equal("approval_status", "approved"),
      Query.greaterThan("$createdAt", twoWeeksAgo),
      Query.orderDesc("$createdAt"),
      Query.limit(5),
    ]);
    for (const doc of recent.documents) {
      const code = String(doc.course_code ?? doc.paper_code ?? "Paper");
      const year = doc.year ? ` (${doc.year})` : "";
      notifications.push({
        id: `paper-${doc.$id}`,
        title: `${recent.total} new paper${recent.total === 1 ? "" : "s"} this fortnight`,
        body: `Latest: ${code}${year}`,
        href: `/paper/${doc.$id}`,
        time: String(doc.$createdAt ?? ""),
      });
      break; // one summary item is enough
    }

    // Moderators: uploads awaiting review
    const user = await getServerUser().catch(() => null);
    if (user && (user.role === "moderator" || user.role === "founder")) {
      const pending = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("approval_status", "pending"),
        Query.limit(1),
      ]);
      if (pending.total > 0) {
        notifications.push({
          id: "pending-review",
          title: `${pending.total} upload${pending.total === 1 ? "" : "s"} awaiting review`,
          body: "Tap to open the moderation queue.",
          href: "/admin",
          time: new Date().toISOString(),
        });
      }
    }

    // Personal upload decisions
    if (user) {
      const mine = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("uploaded_by", user.id),
        Query.orderDesc("$updatedAt"),
        Query.limit(5),
      ]);
      for (const doc of mine.documents) {
        const status = String(doc.approval_status ?? "");
        if (status !== "approved" && status !== "rejected") continue;
        const code = String(doc.course_code ?? doc.paper_code ?? "Your upload");
        notifications.push({
          id: `mine-${doc.$id}`,
          title: status === "approved" ? "Upload approved" : "Upload needs attention",
          body: `${code}${doc.year ? ` (${doc.year})` : ""} was ${status}.`,
          href: `/paper/${doc.$id}`,
          time: String(doc.$updatedAt ?? ""),
        });
      }
    }
  } catch {
    // Notifications are best-effort; never break the header.
  }

  return NextResponse.json({ notifications });
}
