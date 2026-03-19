import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  deleteFileFromAppwrite,
  getAppwriteFileUrl,
  DATABASE_ID,
  COLLECTION,
  ID,
} from "@/lib/appwrite";
import { findByPaperCode } from "@/data/syllabus-registry";
import { ingestPdfToRag } from "@/lib/pdf-rag";

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

async function rollbackUploadedPaper(fileId: string, reason: string) {
  try {
    await deleteFileFromAppwrite(fileId);
  } catch (rollbackErr) {
    console.error(
      `[api/upload] Failed to roll back uploaded file ${fileId} after ${reason.toLowerCase()}:`,
      rollbackErr,
    );
  }
}

/**
 * POST /api/upload
 *
 * Accepts **JSON metadata only** — the file itself has already been uploaded
 * directly from the browser to Appwrite Storage (see UploadForm.tsx).
 * This route:
 * 1. Validates and resolves paper metadata from the syllabus registry.
 * 2. Creates a paper document in the `papers` collection (status: "pending").
 * 3. If the document cannot be created, automatically deletes the uploaded file
 *    to prevent orphaned storage entries.
 *
 * Required JSON body fields:
 * {
 *   fileId:     string  — Appwrite file ID returned by the client-side upload
 *   paper_code: string  — Paper code (e.g. "PHYDSC101T")
 *   university: string  — University name
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

    const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";
    const file_name = typeof body.file_name === "string" ? body.file_name : undefined;
    const paper_code = typeof body.paper_code === "string" ? body.paper_code.trim() : "";
    const university = typeof body.university === "string" ? body.university.trim() : "";
    const year = typeof body.year === "string" ? body.year.trim() : body.year;
    // `year` can arrive as either a string from form JSON or a number from tests/manual calls.

    if (!fileId || !paper_code || !university || year === undefined || year === null || year === "") {
      return NextResponse.json(
        { error: "Required fields missing: fileId, paper_code, university, year." },
        { status: 400 },
      );
    }

    const yearNum = Number(year); // handles both trimmed string input and numeric callers
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
      return NextResponse.json({ error: "Invalid year value." }, { status: 400 });
    }

    // Resolve all metadata from the syllabus registry using the paper code.
    const registryEntry = findByPaperCode(paper_code, university);
    const courseCode = paper_code.trim().toUpperCase();
    const paperName = registryEntry?.paper_name ?? courseCode;
    const department = registryEntry?.subject ?? courseCode;
    const semester = registryEntry ? formatSemester(registryEntry.semester) : undefined;
    const programme = registryEntry?.programme ?? undefined;
    const examType = examTypeFromCode(paper_code);

    const fileUrl = getAppwriteFileUrl(fileId);

    // Step 1 — Create the paper document. If this fails, roll back the uploaded
    // storage file to prevent orphaned entries.
    const db = adminDatabases();
    try {
      await db.createDocument(DATABASE_ID, COLLECTION.papers, ID.unique(), {
        course_code: courseCode,
        paper_name: paperName,
        year: yearNum,
        semester,
        department,
        programme,
        exam_type: examType,
        file_id: fileId,
        file_url: fileUrl,
        uploaded_by: user.id,
        approved: false,
        status: "pending",
      });
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message.trim() : String(err).trim();
      const message = rawMessage
        ? /[.!?]$/.test(rawMessage)
          ? rawMessage
          : `${rawMessage}.`
        : "Paper metadata could not be saved.";
      await rollbackUploadedPaper(fileId, "paper metadata persistence failed");
      return NextResponse.json(
        {
          error: `${message} The uploaded file was removed from storage because the paper record could not be created.`,
        },
        { status: 500 },
      );
    }

    // Step 2 — Record the raw upload in the `uploads` collection (best-effort).
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

    // Step 3 — Best-effort RAG ingestion for AI retrieval features.
    try {
      await ingestPdfToRag({
        fileId,
        sourceType: "paper",
        sourceLabel: `${courseCode} ${yearNum}`,
        courseCode,
        department,
        year: yearNum,
        uploadedBy: user.id,
      });
    } catch (ingestErr) {
      console.warn("[api/upload] RAG ingestion skipped:", ingestErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[api/upload] Unhandled error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
