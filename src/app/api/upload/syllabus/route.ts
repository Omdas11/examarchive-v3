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
import { ingestPdfToRag } from "@/lib/pdf-rag";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getSyllabusFileUrl(fileId: string): string {
  return `/api/files/syllabus/${fileId}`;
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
 * Supports two payload shapes:
 *
 * 1. Registry-resolved single-paper syllabus (SyllabusUploadForm):
 *    { fileId, paper_code, university, year }
 *    All metadata (subject, department, semester, programme) is auto-resolved
 *    from the syllabus registry using paper_code + university.
 *
 * 2. Departmental syllabus (DeptSyllabusUploadForm):
 *    { fileId, university, subject, department, semester: "", programme?, year }
 *    No paper_code — covers all semesters; stored with semester = "".
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

    const {
      fileId,
      paper_code,
      university,
      year,
      // Departmental syllabus fields (when paper_code is absent)
      subject: bodySubject,
      department: bodyDepartment,
      semester: bodySemester,
      programme: bodyProgramme,
    } = body as {
      fileId?: string;
      paper_code?: string;
      university?: string;
      year?: number | string;
      subject?: string;
      department?: string;
      semester?: string;
      programme?: string;
    };

    if (!fileId || !university || !year) {
      return NextResponse.json(
        { error: "Required fields missing: fileId, university, year." },
        { status: 400 },
      );
    }

    // Determine upload mode.
    // Departmental syllabi cover all semesters: DeptSyllabusUploadForm sends
    // `semester: ""` (empty string) along with explicit `subject`/`department`
    // fields, and no `paper_code`. This empty-string convention is the stable
    // way to distinguish departmental from single-paper syllabus uploads.
    const isDeptSyllabus = !paper_code && bodySemester === "" && !!bodySubject;
    if (!isDeptSyllabus && !paper_code) {
      return NextResponse.json(
        { error: "Required fields missing: paper_code (or subject + semester for departmental uploads)." },
        { status: 400 },
      );
    }

    const yearNum = Number(year);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      return NextResponse.json({ error: "Invalid year value." }, { status: 400 });
    }

    // Resolve metadata depending on upload mode
    let subject: string;
    let department: string;
    let semester: string;
    let programme: string;

    if (isDeptSyllabus) {
      // Departmental syllabus: user-provided fields, no registry lookup
      subject = bodySubject ?? "";
      department = bodyDepartment ?? bodySubject ?? "";
      semester = "";
      programme = bodyProgramme ?? "";
    } else {
      // Registry-resolved single-paper syllabus
      const registryEntry = findByPaperCode(paper_code!, university);
      subject = registryEntry?.paper_name ?? paper_code!;
      department = registryEntry?.subject ?? paper_code!;
      semester = registryEntry ? formatSemester(registryEntry.semester) : "";
      programme = registryEntry?.programme ?? "";
    }

    const fileUrl = getSyllabusFileUrl(fileId);

    try {
      const db = adminDatabases();
      await db.createDocument(DATABASE_ID, COLLECTION.syllabus, ID.unique(), {
        university,
        subject,
        department,
        semester,
        programme,
        course_code: isDeptSyllabus ? "" : (paper_code ?? ""),
        course_name: subject,
        year: yearNum,
        uploader_id: user.id,
        approval_status: "pending",
        file_url: fileUrl,
      });
    } catch (err: unknown) {
      // Roll back the storage file if the DB insert fails to prevent orphaned files.
      try {
        await adminStorage().deleteFile(SYLLABUS_BUCKET_ID, fileId);
      } catch (rollbackErr) {
        console.error(
          "[api/upload/syllabus] Failed to roll back uploaded syllabus file %s:",
          fileId,
          rollbackErr,
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    void ingestPdfToRag({
      fileId,
      sourceType: "syllabus",
      sourceLabel: isDeptSyllabus
        ? `${subject} ${university}`.trim()
        : `${paper_code} ${yearNum}`.trim(),
      courseCode: paper_code,
      department,
      year: yearNum,
      uploadedBy: user.id,
    }).catch((ingestErr) => {
      console.warn("[api/upload/syllabus] RAG ingestion skipped:", ingestErr);
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[api/upload/syllabus] Unhandled error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
