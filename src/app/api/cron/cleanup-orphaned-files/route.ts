import { NextResponse, type NextRequest } from "next/server";
import { adminDatabases, adminStorage, DATABASE_ID, COLLECTION, BUCKET_ID, Query } from "@/lib/appwrite";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = adminDatabases();
    const storage = adminStorage();

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let deletedCount = 0;
    let checkedCount = 0;

    let hasMore = true;
    let queries = [Query.limit(100), Query.orderAsc("$createdAt")];

    while (hasMore) {
      const response = await storage.listFiles(BUCKET_ID, queries);
      const files = response.files;

      if (files.length === 0) {
        hasMore = false;
        break;
      }

      for (const file of files) {
        checkedCount++;
        const createdAt = new Date(file.$createdAt);
        if (createdAt >= oneHourAgo) {
          // File is too new, skip it
          continue;
        }

        // Check if file exists in papers collection
        const papers = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
          Query.equal("file_id", file.$id),
          Query.limit(1),
        ]);

        if (papers.documents.length === 0) {
          // Check uploads collection as well just to be safe
          const uploads = await db.listDocuments(DATABASE_ID, COLLECTION.uploads, [
            Query.equal("file_id", file.$id),
            Query.limit(1),
          ]);

          if (uploads.documents.length === 0) {
            // No references found and older than 1 hour, safe to delete
            await storage.deleteFile(BUCKET_ID, file.$id);
            deletedCount++;
            console.info(`[cron/cleanup-orphaned-files] Deleted orphaned file ${file.$id}`);
          }
        }
      }

      if (files.length < 100) {
        hasMore = false;
      } else {
        queries = [
          Query.limit(100),
          Query.orderAsc("$createdAt"),
          Query.cursorAfter(files[files.length - 1].$id)
        ];
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cron job completed successfully. Checked ${checkedCount} files, deleted ${deletedCount} orphaned files.`,
    });
  } catch (error) {
    console.error("[cron/cleanup-orphaned-files] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
