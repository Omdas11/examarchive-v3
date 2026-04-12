import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, COLLECTION, DATABASE_ID, getAppwriteFileDownloadUrl } from "@/lib/appwrite";
import { mapJobDocument } from "@/lib/ai-generation-worker";

function mapJobResponse(doc: Record<string, unknown>) {
  const mapped = mapJobDocument(doc);
  return {
    ...mapped,
    resultPdfUrl: mapped.resultNoteId ? getAppwriteFileDownloadUrl(mapped.resultNoteId) : null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { jobId } = await params;
  if (!jobId || !jobId.trim()) {
    return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
  }

  const db = adminDatabases();
  let job;
  try {
    job = await db.getDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobId);
  } catch {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json({ job: mapJobResponse(job) });
}
