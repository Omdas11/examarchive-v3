import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  adminStorage,
  getAppwriteFileUrl,
  DATABASE_ID,
  COLLECTION,
  BUCKET_ID,
  ID,
} from "@/lib/appwrite";
import { AppwriteException } from "node-appwrite";
import { findByPaperCode } from "@/data/syllabus-registry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Derive exam type from the last character of the paper code. */
function examTypeFromCode(code: string): string | undefined {
  const last = code.trim().toUpperCase().slice(-1);
  if (last === "T") return "Theory";
  if (last === "P") return "Practical";
  return undefined;
}

/** Format a semester number as an ordinal string (e.g. 1 → "1st"). */
function formatSemester(n: number): string {
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

/**
 * POST /api/upload
 *
 * Accepts **JSON metadata only** — the file itself has already been uploaded
 * directly from the browser to Appwrite Storage (see UploadForm.tsx).
 * This route:
 * 1. Creates an entry in the `uploads` collection (status: "pending").
 * 2. Creates a paper document in the `papers` collection (approved: false).
 *
 * All paper metadata is auto-resolved server-side from the syllabus registry
 * using the paper_code. The paper code suffix determines exam type:
 *   T → Theory, P → Practical
 *
 * Required JSON body fields:
 * {
 *   fileId:     string  — Appwrite file ID returned by the client-side upload
 *   paper_code: string  — Paper code (e.g. "PHYDSC101T"); used to resolve metadata
 *   university: string  — University name (used to narrow registry lookup)
 *   year:       number | string
 *   file_name?: string  — Original filename (stored in uploads collection)
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
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const {
      fileId,
      file_name,
      paper_code,
      university,
      year,
    } = body as {
      fileId?: string;
      file_name?: string;
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
    const course_name = registryEntry?.paper_name ?? paper_code;
    const department = registryEntry?.subject ?? paper_code;
    const semester = registryEntry ? formatSemester(registryEntry.semester) : undefined;
    const paper_type = registryEntry?.category ?? undefined;
    const exam_type = examTypeFromCode(paper_code);
    const institute = university ?? registryEntry?.university ?? undefined;

    const fileUrl = getAppwriteFileUrl(fileId);

    // Verify file ownership: use the admin client to fetch the file's metadata
    // and confirm the current user has the uploader-specific write permission.
    // This is reliable even after the bucket was opened to Role.users() — a
    // session-scoped getFile() would succeed for any authenticated user, but
    // the write permission is only granted to the actual uploader at upload time.
    try {
      const fileData = await adminStorage().getFile(BUCKET_ID, fileId);
      // Permission format set by appwrite-client.ts: write("user:<uploaderId>")
      const ownerWritePerm = `write("user:${user.id}")`;
      const isOwner = (fileData.$permissions as string[]).includes(ownerWritePerm);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Access denied: you do not own this file." },
          { status: 403 },
        );
      }
    } catch (storageErr: unknown) {
      if (storageErr instanceof AppwriteException) {
        if (storageErr.code === 404 || storageErr.code === 400) {
          return NextResponse.json(
            { error: "File not found in storage. Please re-upload the file." },
            { status: 404 },
          );
        }
      }
      return NextResponse.json(
        { error: "File not found in storage. Please re-upload the file." },
        { status: 404 },
      );
    }

    const db = adminDatabases();

    // Step 1 — Record the raw upload in the `uploads` collection (status: "pending").
    try {
      await db.createDocument(DATABASE_ID, COLLECTION.uploads, ID.unique(), {
        user_id: user.id,
        file_id: fileId,
        file_name: file_name ?? "",
        status: "pending",
      });
    } catch (uploadErr: unknown) {
      console.warn("[api/upload] Could not write to uploads collection:", uploadErr);
    }

    // Step 2 — Create the paper document using only fields present in the schema.
    try {
      await db.createDocument(DATABASE_ID, COLLECTION.papers, ID.unique(), {
        course_name,
        department,
        year: yearNum,
        file_url: fileUrl,
        uploaded_by: user.id,
        approved: false,
        course_code: paper_code.trim().toUpperCase(),
        ...(semester ? { semester } : {}),
        ...(exam_type ? { exam_type } : {}),
        ...(institute ? { institute } : {}),
        ...(paper_type ? { paper_type } : {}),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[api/upload] Unhandled error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
