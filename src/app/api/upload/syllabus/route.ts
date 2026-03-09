import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  adminStorage,
  DATABASE_ID,
  COLLECTION,
  SYLLABUS_BUCKET_ID,
  ID,
} from "@/lib/appwrite";
import { findByPaperCode } from "@/data/syllabus-registry";

export const dynamic = "force-dynamic";

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";

function getSyllabusFileUrl(fileId: string): string {
  return `${APPWRITE_ENDPOINT}/storage/buckets/${SYLLABUS_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
}

/** Format a semester number as an ordinal string (e.g. 1 → "1st"). */
function formatSemester(n: number): string {
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

/**
 * POST /api/upload/syllabus
 *
 * Accepts JSON metadata only — the file has already been uploaded directly
 * from the browser to Appwrite Storage (syllabus-files bucket).
 *
 * All syllabus metadata is auto-resolved server-side from the syllabus registry
 * using the paper_code. The document is stored with `approval_status: "pending"`.
 *
 * Required JSON body fields:
 * {
 *   fileId:     string  — Appwrite file ID in the syllabus-files bucket
 *   paper_code: string  — Paper code used to resolve metadata from the registry
 *   university: string  — University name
 *   year:       number | string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { fileId, paper_code, university, year } = body as {
      fileId?: string;
      paper_code?: string;
      university?: string;
      year?: number | string;
    };

    if (!fileId || !paper_code || !university || !year) {
      return NextResponse.json(
        { error: "Required fields missing: fileId, paper_code, university, year." },
        { status: 400 },
      );
    }

    const yearNum = Number(year);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      return NextResponse.json({ error: "Invalid year value." }, { status: 400 });
    }

    // Resolve all metadata from the syllabus registry using the paper code.
    const registryEntry = findByPaperCode(paper_code, university);
    const subject = registryEntry?.paper_name ?? paper_code;
    const department = registryEntry?.subject ?? paper_code;
    const semester = registryEntry ? formatSemester(registryEntry.semester) : "";
    const programme = registryEntry?.programme ?? "";

    const fileUrl = getSyllabusFileUrl(fileId);

    // Verify the file exists in the syllabus-files bucket.
    try {
      const storage = adminStorage();
      await storage.getFile(SYLLABUS_BUCKET_ID, fileId);
    } catch {
      return NextResponse.json(
        { error: "File not found in syllabus storage. Please re-upload the file." },
        { status: 404 },
      );
    }

    try {
      const db = adminDatabases();
      await db.createDocument(DATABASE_ID, COLLECTION.syllabus, ID.unique(), {
        university,
        subject,
        department,
        semester,
        programme,
        year: yearNum,
        uploader_id: user.id,
        approval_status: "pending",
        file_url: fileUrl,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[api/upload/syllabus] Unhandled error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
