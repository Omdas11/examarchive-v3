import { NextResponse, type NextRequest } from "next/server";
import { adminDatabases, adminStorage, DATABASE_ID, COLLECTION, BUCKET_ID, Query } from "@/lib/appwrite";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/cleanup-orphaned-files
 *
 * Vercel Cron job that deletes storage files older than 1 hour which have no
 * matching document in the `papers`, `uploads`, or `ai_generation_jobs`
 * collections.  This prevents permanent storage bloat from failed uploads
 * or crashed metadata-creation steps.
 *
 * Authentication: Requires `CRON_SECRET` env var to be set.  If unset the
 * endpoint refuses all requests (fail-closed).
 */
export async function GET(request: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();

  // Fail-closed: deny all requests when the secret is not configured.
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured. Endpoint disabled." },
      { status: 403 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = adminDatabases();
    const storage = adminStorage();

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let deletedCount = 0;
    let checkedCount = 0;

    let queries = [Query.limit(100), Query.orderAsc("$createdAt")];
    let hasMore = true;

    while (hasMore) {
      const response = await storage.listFiles(BUCKET_ID, queries);
      const files = response.files;

      if (files.length === 0) break;

      // Early exit: if the oldest file in this batch is newer than 1 hour,
      // every remaining file will also be newer (ordered by $createdAt ASC).
      const oldestInBatch = new Date(files[0].$createdAt);
      if (oldestInBatch >= oneHourAgo) break;

      // Collect file IDs that are old enough to be candidates for deletion.
      const candidateFiles = files.filter(
        (f) => new Date(f.$createdAt) < oneHourAgo,
      );
      const candidateIds = candidateFiles.map((f) => f.$id);
      checkedCount += candidateIds.length;

      if (candidateIds.length === 0) break;

      // Batch-fetch all referenced file IDs across papers, uploads, and
      // ai_generation_jobs to avoid N+1 queries per file.
      const [papersRes, uploadsRes, jobsRes] = await Promise.all([
        db.listDocuments(DATABASE_ID, COLLECTION.papers, [
          Query.equal("file_id", candidateIds),
          Query.limit(candidateIds.length),
          Query.select(["file_id"]),
        ]),
        db.listDocuments(DATABASE_ID, COLLECTION.uploads, [
          Query.equal("file_id", candidateIds),
          Query.limit(candidateIds.length),
          Query.select(["file_id"]),
        ]),
        db.listDocuments(DATABASE_ID, COLLECTION.ai_generation_jobs, [
          Query.equal("result_file_id", candidateIds),
          Query.limit(candidateIds.length),
          Query.select(["result_file_id"]),
        ]),
      ]);

      const referencedIds = new Set<string>();
      for (const doc of papersRes.documents) {
        const fid = String((doc as { file_id?: string }).file_id ?? "").trim();
        if (fid) referencedIds.add(fid);
      }
      for (const doc of uploadsRes.documents) {
        const fid = String((doc as { file_id?: string }).file_id ?? "").trim();
        if (fid) referencedIds.add(fid);
      }
      for (const doc of jobsRes.documents) {
        const fid = String((doc as { result_file_id?: string }).result_file_id ?? "").trim();
        if (fid) referencedIds.add(fid);
      }

      for (const file of candidateFiles) {
        if (!referencedIds.has(file.$id)) {
          await storage.deleteFile(BUCKET_ID, file.$id);
          deletedCount++;
          console.info(
            `[cron/cleanup-orphaned-files] Deleted orphaned file ${file.$id}`,
          );
        }
      }

      if (files.length < 100) {
        hasMore = false;
      } else {
        queries = [
          Query.limit(100),
          Query.orderAsc("$createdAt"),
          Query.cursorAfter(files[files.length - 1].$id),
        ];
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${checkedCount} file(s), deleted ${deletedCount} orphaned file(s).`,
    });
  } catch (error) {
    console.error("[cron/cleanup-orphaned-files] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
