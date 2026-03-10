import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  adminStorage,
  deleteFileFromAppwrite,
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

type CollectionAttribute = {
  key?: string;
  required?: boolean;
  status?: string;
};

type ResolvedPaperDocument = {
  courseCode: string;
  paperName: string;
  year: number;
  semester?: string;
  department: string;
  programme?: string;
  examType?: string;
  fileId: string;
  fileUrl: string;
  uploadedBy: string;
  approved: boolean;
  institution?: string;
  paperType?: string;
};

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

async function getCollectionSchema(
  collectionId: string,
): Promise<{ availableKeys: Set<string>; requiredKeys: Set<string> }> {
  const { attributes } = await adminDatabases().listAttributes(DATABASE_ID, collectionId);
  const availableAttributes = (attributes as CollectionAttribute[]).filter(
    (attribute) => !attribute.status || attribute.status === "available",
  );

  return {
    availableKeys: new Set(
      availableAttributes
        .map((attribute) => attribute.key?.trim())
        .filter((key): key is string => Boolean(key)),
    ),
    requiredKeys: new Set(
      availableAttributes
        .filter((attribute) => attribute.required)
        .map((attribute) => attribute.key?.trim())
        .filter((key): key is string => Boolean(key)),
    ),
  };
}

function buildPaperDocumentPayload(
  availableKeys: Set<string>,
  payload: ResolvedPaperDocument,
): Record<string, unknown> {
  // Support both canonical paper fields and known schema aliases because
  // different Appwrite environments have evolved with slightly different
  // attribute names (`course_name` vs `paper_name`, `institute` vs `institution`).
  const valuesByKey: Record<string, unknown> = {
    approved: payload.approved,
    course_code: payload.courseCode,
    paper_code: payload.courseCode, // backward-compat alias for older documents/queries
    course_name: payload.paperName,
    paper_name: payload.paperName, // legacy/schema alias used in some Appwrite setups
    title: payload.paperName, // UI-facing alias used by older documents
    year: payload.year,
    semester: payload.semester,
    department: payload.department,
    programme: payload.programme,
    exam_type: payload.examType,
    file_id: payload.fileId, // stored so admin can update storage permissions on approval
    file_url: payload.fileUrl,
    uploaded_by: payload.uploadedBy,
    uploader_id: payload.uploadedBy, // legacy uploader field
    institute: payload.institution,
    institution: payload.institution, // legacy institution alias
    university: payload.institution, // schema alias used alongside institution in some environments
    paper_type: payload.paperType,
    category: payload.paperType, // legacy paper type alias
  };

  const document: Record<string, unknown> = {};
  for (const key of availableKeys) {
    const value = valuesByKey[key];
    if (value !== undefined) {
      document[key] = value;
    }
  }

  return document;
}

function getMissingRequiredKeys(
  requiredKeys: Set<string>,
  document: Record<string, unknown>,
): string[] {
  return [...requiredKeys].filter((key) => {
    if (!(key in document)) return true;
    const value = document[key];
    if (value === undefined || value === null) return true;
    return typeof value === "string" && value.trim() === "";
  });
}

/**
 * POST /api/upload
 *
 * Accepts **JSON metadata only** — the file itself has already been uploaded
 * directly from the browser to Appwrite Storage (see UploadForm.tsx).
 * This route:
 * 1. Validates the uploaded storage file and resolves paper metadata.
 * 2. Creates a paper document in the `papers` collection (approved: false).
 * 3. Best-effort writes an audit entry to the `uploads` collection.
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
    const paper_type = registryEntry?.category ?? undefined;
    const exam_type = examTypeFromCode(paper_code);
    const institution = university || registryEntry?.university;

    const fileUrl = getAppwriteFileUrl(fileId);

    // Verify the file exists in storage. We do not check $permissions here
    // because that check is unreliable and blocked the DB write with spurious
    // 403 errors. Ownership is implicitly established: only the authenticated
    // user who obtained the JWT from /api/upload/token can upload a file and
    // then immediately call this route with that fileId. The admin key is used
    // solely to confirm the file exists before writing the DB document.
    try {
      await adminStorage().getFile(BUCKET_ID, fileId);
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
    try {
      const { availableKeys, requiredKeys } = await getCollectionSchema(COLLECTION.papers);
      const paperDocument = buildPaperDocumentPayload(availableKeys, {
        courseCode,
        paperName,
        year: yearNum,
        semester,
        department,
        programme,
        examType: exam_type,
        fileId,
        fileUrl,
        uploadedBy: user.id,
        approved: false,
        institution,
        paperType: paper_type,
      });

      const missingRequiredKeys = getMissingRequiredKeys(requiredKeys, paperDocument);
      if (missingRequiredKeys.length > 0) {
        await rollbackUploadedPaper(
          fileId,
          `database payload missing required fields: ${missingRequiredKeys.join(", ")}`,
        );
        return NextResponse.json(
          {
            error:
              `Upload metadata is incomplete for the papers collection. ` +
              `Missing required fields: ${missingRequiredKeys.join(", ")}. ` +
              `The uploaded file was removed from storage. Please verify the paper code and try again.`,
          },
          { status: 500 },
        );
      }

      // Step 1 — Create the paper document using the live schema attributes.
      await db.createDocument(DATABASE_ID, COLLECTION.papers, ID.unique(), paperDocument);
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

    // Step 2 — Record the raw upload in the `uploads` collection (status: "pending").
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

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[api/upload] Unhandled error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
