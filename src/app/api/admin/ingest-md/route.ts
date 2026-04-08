import { NextResponse, type NextRequest } from "next/server";
import { InputFile } from "node-appwrite/file";
import { Compression } from "node-appwrite";
import path from "path";
import { randomUUID } from "crypto";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import {
  adminDatabases,
  adminStorage,
  COLLECTION,
  DATABASE_ID,
  ID,
  MD_INGESTION_BUCKET_ID,
  Query,
} from "@/lib/appwrite";
import { parseDemoDataEntryMarkdown, type IngestionFrontmatter } from "@/lib/admin-md-ingestion";
import { FYUG_DEPT_CODES } from "@/lib/fyug-depts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYLLABUS_TEMPLATE_PATH = path.resolve(process.cwd(), "docs/MASTER_SYLLABUS_ENTRY.md");
const QUESTION_TEMPLATE_PATH = path.resolve(process.cwd(), "docs/MASTER_QUESTION_ENTRY.md");
const MAX_QUESTION_ROWS_PER_NUMBER = 100;
const MAX_SYLLABUS_MATCH_LIMIT = 200;

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isUnknownAttributeError(error: unknown, attribute?: string): boolean {
  const message = normalizeError(error).toLowerCase();
  if (!message.includes("unknown attribute")) return false;
  if (!attribute) return true;
  return message.includes(attribute.toLowerCase());
}

/**
 * Derives the semester (1–8) from a paper code following the NEP 2020 FYUG convention:
 * [3-letter dept][3-letter type][semDigit][2-digit num][opt elective A/B/C][T/P]
 * e.g. PHYDSC101T → 1, MATDSC501AT → 5
 * Returns null when the code doesn't match the expected pattern.
 */
function deriveSemesterFromCode(paperCode: string): number | null {
  const match = /^[A-Z]{3}(?:DSC|DSM|IDC|SEC|AEC|VAC)([1-8])\d{2}[ABC]?[TP]$/.exec(paperCode);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Derives the 3-letter dept code from the start of a paper code.
 * Returns null for common papers that don't map to a specific dept.
 */
function deriveDeptCode(paperCode: string): string | null {
  const prefix = paperCode.slice(0, 3).toUpperCase();
  return FYUG_DEPT_CODES.has(prefix as Parameters<typeof FYUG_DEPT_CODES.has>[0]) ? prefix : null;
}

async function ensureMdIngestionBucket() {
  const storage = adminStorage();
  try {
    await storage.getBucket({ bucketId: MD_INGESTION_BUCKET_ID });
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code !== 404) throw error;
    await storage.createBucket({
      bucketId: MD_INGESTION_BUCKET_ID,
      name: "examarchive-md-ingestion",
      permissions: [],
      fileSecurity: false,
      enabled: true,
      maximumFileSize: 2 * 1024 * 1024,
      allowedFileExtensions: ["md"],
      compression: Compression.None,
      encryption: true,
      antivirus: true,
      transformations: false,
    });
  }
}

async function upsertSyllabusRows(args: {
  frontmatter: IngestionFrontmatter;
  semester: number | null;
  rows: ReturnType<typeof parseDemoDataEntryMarkdown>["syllabus"];
}) {
  const db = adminDatabases();
  let added = 0;
  let updated = 0;
  for (const row of args.rows) {
    const existing = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
      Query.equal("university", args.frontmatter.university),
      Query.equal("course", args.frontmatter.course),
      Query.equal("stream", args.frontmatter.stream),
      Query.equal("type", args.frontmatter.type),
      Query.equal("paper_code", args.frontmatter.paper_code),
      Query.equal("unit_number", row.unit_number),
      Query.limit(1),
    ]);
    const rowId =
      typeof existing.documents[0]?.id === "string" && existing.documents[0].id.trim().length > 0
        ? existing.documents[0].id
        : randomUUID();
    const basePayload: Record<string, unknown> = {
      id: rowId,
      university: args.frontmatter.university,
      course: args.frontmatter.course,
      stream: args.frontmatter.stream,
      type: args.frontmatter.type,
      paper_code: args.frontmatter.paper_code,
      subject: args.frontmatter.subject,
      unit_number: row.unit_number,
      syllabus_content: row.syllabus_content,
      tags: row.tags,
    };
    const payload: Record<string, unknown> = {
      ...basePayload,
      paper_name: args.frontmatter.paper_name,
    };
    if (args.frontmatter.entry_type) payload.entry_type = args.frontmatter.entry_type;
    if (args.frontmatter.entry_id) payload.entry_id = args.frontmatter.entry_id;
    if (args.frontmatter.college) payload.college = args.frontmatter.college;
    if (args.frontmatter.group) payload.group = args.frontmatter.group;
    if (args.frontmatter.session) payload.session = args.frontmatter.session;
    if (typeof args.frontmatter.year === "number") payload.year = args.frontmatter.year;
    if (args.frontmatter.semester_code) payload.semester_code = args.frontmatter.semester_code;
    if (typeof args.frontmatter.semester_no === "number") payload.semester_no = args.frontmatter.semester_no;
    if (typeof args.frontmatter.credits === "number") payload.credits = args.frontmatter.credits;
    if (typeof args.frontmatter.marks_total === "number") payload.marks_total = args.frontmatter.marks_total;
    if (args.frontmatter.syllabus_pdf_url) payload.syllabus_pdf_url = args.frontmatter.syllabus_pdf_url;
    if (args.frontmatter.source_reference) payload.source_reference = args.frontmatter.source_reference;
    if (args.frontmatter.status) payload.status = args.frontmatter.status;
    if (Array.isArray(args.frontmatter.aliases)) payload.aliases = args.frontmatter.aliases;
    if (Array.isArray(args.frontmatter.keywords)) payload.keywords = args.frontmatter.keywords;
    if (args.frontmatter.notes) payload.notes = args.frontmatter.notes;
    if (typeof args.frontmatter.version === "number") payload.version = args.frontmatter.version;
    if (args.frontmatter.last_updated) payload.last_updated = args.frontmatter.last_updated;
    if (typeof args.semester === "number") {
      payload.semester = args.semester;
    }
    if (typeof row.lectures === "number") {
      payload.lectures = row.lectures;
    }
    try {
      if (existing.documents[0]) {
        await db.updateDocument(DATABASE_ID, COLLECTION.syllabus_table, existing.documents[0].$id, payload);
        updated += 1;
      } else {
        await db.createDocument(DATABASE_ID, COLLECTION.syllabus_table, ID.unique(), payload);
        added += 1;
      }
    } catch (error) {
      if (!isUnknownAttributeError(error)) throw error;
      console.warn("[ingest-md] Syllabus_Table v2 field fallback to base payload:", normalizeError(error), error);
      if (existing.documents[0]) {
        await db.updateDocument(DATABASE_ID, COLLECTION.syllabus_table, existing.documents[0].$id, basePayload);
        updated += 1;
      } else {
        await db.createDocument(DATABASE_ID, COLLECTION.syllabus_table, ID.unique(), basePayload);
        added += 1;
      }
    }
  }
  return { added, updated };
}

async function upsertQuestionRows(args: {
  frontmatter: IngestionFrontmatter;
  rows: ReturnType<typeof parseDemoDataEntryMarkdown>["questions"];
}) {
  const db = adminDatabases();
  const linkedSyllabusEntryId = await resolveLinkedSyllabusEntryId(args.frontmatter);
  const linkStatus = args.frontmatter.link_status ?? (linkedSyllabusEntryId ? "linked" : "unmapped");
  let added = 0;
  let updated = 0;
  for (const row of args.rows) {
    const existingByQuestionNo = await db.listDocuments(DATABASE_ID, COLLECTION.questions_table, [
      Query.equal("university", args.frontmatter.university),
      Query.equal("course", args.frontmatter.course),
      Query.equal("stream", args.frontmatter.stream),
      Query.equal("type", args.frontmatter.type),
      Query.equal("paper_code", args.frontmatter.paper_code),
      Query.equal("question_no", row.question_no),
      Query.limit(MAX_QUESTION_ROWS_PER_NUMBER),
    ]);
    const existing = existingByQuestionNo.documents.find(
      (document) =>
        document.question_subpart === row.question_subpart ||
        ((document.question_subpart === null || document.question_subpart === undefined) &&
          (row.question_subpart === null || row.question_subpart === undefined)),
    );
    const rowId =
      typeof existing?.id === "string" && existing.id.trim().length > 0
        ? existing.id
        : randomUUID();
    const basePayload: Record<string, unknown> = {
      id: rowId,
      university: args.frontmatter.university,
      course: args.frontmatter.course,
      stream: args.frontmatter.stream,
      type: args.frontmatter.type,
      paper_code: args.frontmatter.paper_code,
      paper_name: args.frontmatter.paper_name,
      subject: args.frontmatter.subject,
      question_no: row.question_no,
      question_subpart: row.question_subpart,
      question_content: row.question_content,
      tags: row.tags,
    };
    const payload: Record<string, unknown> = { ...basePayload };
    if (args.frontmatter.entry_type) payload.entry_type = args.frontmatter.entry_type;
    if (args.frontmatter.question_id) payload.question_id = args.frontmatter.question_id;
    if (args.frontmatter.college) payload.college = args.frontmatter.college;
    if (args.frontmatter.group) payload.group = args.frontmatter.group;
    if (typeof args.frontmatter.exam_year === "number") payload.exam_year = args.frontmatter.exam_year;
    if (args.frontmatter.exam_session) payload.exam_session = args.frontmatter.exam_session;
    if (args.frontmatter.exam_month) payload.exam_month = args.frontmatter.exam_month;
    if (args.frontmatter.attempt_type) payload.attempt_type = args.frontmatter.attempt_type;
    if (args.frontmatter.semester_code) payload.semester_code = args.frontmatter.semester_code;
    if (typeof args.frontmatter.semester_no === "number") payload.semester_no = args.frontmatter.semester_no;
    if (args.frontmatter.question_pdf_url) payload.question_pdf_url = args.frontmatter.question_pdf_url;
    if (args.frontmatter.source_reference) payload.source_reference = args.frontmatter.source_reference;
    if (args.frontmatter.status) payload.status = args.frontmatter.status;
    if (linkedSyllabusEntryId) payload.linked_syllabus_entry_id = linkedSyllabusEntryId;
    if (linkStatus) payload.link_status = linkStatus;
    if (args.frontmatter.ocr_text_path) payload.ocr_text_path = args.frontmatter.ocr_text_path;
    if (args.frontmatter.ai_summary_status) payload.ai_summary_status = args.frontmatter.ai_summary_status;
    if (args.frontmatter.difficulty_estimate) payload.difficulty_estimate = args.frontmatter.difficulty_estimate;
    if (typeof row.year === "number") {
      payload.year = row.year;
    } else if (typeof args.frontmatter.exam_year === "number") {
      payload.year = args.frontmatter.exam_year;
    }
    if (typeof row.marks === "number") {
      payload.marks = row.marks;
    }
    try {
      if (existing) {
        await db.updateDocument(DATABASE_ID, COLLECTION.questions_table, existing.$id, payload);
        updated += 1;
      } else {
        await db.createDocument(DATABASE_ID, COLLECTION.questions_table, ID.unique(), payload);
        added += 1;
      }
    } catch (error) {
      if (!normalizeError(error).toLowerCase().includes("unknown attribute")) {
        throw error;
      }
      console.warn("[ingest-md] Questions_Table v2 field fallback to base payload:", normalizeError(error));
      if (existing) {
        await db.updateDocument(DATABASE_ID, COLLECTION.questions_table, existing.$id, basePayload);
        updated += 1;
      } else {
        await db.createDocument(DATABASE_ID, COLLECTION.questions_table, ID.unique(), basePayload);
        added += 1;
      }
    }
  }
  return { added, updated };
}

async function createIngestionLog(payload: {
  fileName: string;
  fileId?: string;
  paperCode?: string;
  paperName?: string;
  subject?: string;
  entryType?: "syllabus" | "question";
  status: "success" | "partial" | "failed";
  rowsAffected: number;
  errors: Array<{ line: number; message: string }>;
}) {
  try {
    const db = adminDatabases();
    const errorSummary = payload.errors.length > 0
      ? payload.errors.map((e) => `L${e.line}: ${e.message}`).join("; ").slice(0, 2000)
      : "";
    const doc: Record<string, unknown> = {
      paper_code: payload.paperCode ?? "",
      source_label: payload.fileName,
      file_id: payload.fileId ?? "",
      file_url: payload.fileId ? `/api/admin/ingest-md?fileId=${encodeURIComponent(payload.fileId)}` : "",
      status: payload.status,
      model: "deterministic-md-parser",
      characters_ingested: payload.rowsAffected,
      digest: JSON.stringify({
        paperCode: payload.paperCode ?? "",
        rowsAffected: payload.rowsAffected,
        errors: payload.errors,
      }),
      // ── New fields for syllabus tracker / mobile dashboard ──
      ingested_at: new Date().toISOString(),
      row_count: payload.rowsAffected,
    };
    if (payload.entryType) doc.entry_type = payload.entryType;
    if (payload.paperName) doc.paper_name = payload.paperName;
    if (payload.subject) doc.subject = payload.subject;
    if (errorSummary) doc.error_summary = errorSummary;
    const deptCode = payload.paperCode ? deriveDeptCode(payload.paperCode) : null;
    if (deptCode) doc.dept_code = deptCode;
    await db.createDocument(DATABASE_ID, COLLECTION.ai_ingestions, ID.unique(), doc);
  } catch (error) {
    console.warn("[ingest-md] failed to write ingestion log:", error);
  }
}

async function resolveLinkedSyllabusEntryId(frontmatter: IngestionFrontmatter): Promise<string | null> {
  if (frontmatter.linked_syllabus_entry_id?.trim()) {
    return frontmatter.linked_syllabus_entry_id.trim();
  }

  const db = adminDatabases();
  const matches = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
    Query.equal("university", frontmatter.university),
    Query.equal("course", frontmatter.course),
    Query.equal("stream", frontmatter.stream),
    Query.equal("type", frontmatter.type),
    Query.equal("paper_code", frontmatter.paper_code),
    Query.limit(MAX_SYLLABUS_MATCH_LIMIT),
  ]);

  for (const doc of matches.documents) {
    const entryId = typeof doc.entry_id === "string" ? doc.entry_id.trim() : "";
    if (entryId) return entryId;

    if (typeof doc.id === "string" && doc.id.trim().length > 0) {
      return doc.id.trim();
    }
    if (typeof doc.$id === "string" && doc.$id.trim().length > 0) {
      return doc.$id.trim();
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const templateKind = searchParams.get("template");
  if (templateKind) {
    const fs = await import("fs/promises");
    const templatePath = templateKind === "question"
      ? QUESTION_TEMPLATE_PATH
      : SYLLABUS_TEMPLATE_PATH;
    const template = await fs.readFile(templatePath, "utf8");
    return new NextResponse(template, {
      status: 200,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  const db = adminDatabases();
  try {
    const list = await db.listDocuments(DATABASE_ID, COLLECTION.ai_ingestions, [
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]);
    const logs = list.documents.map((doc) => {
      let digest: { paperCode?: string; rowsAffected?: number; errors?: Array<{ line: number; message: string }> } = {};
      try {
        digest = typeof doc.digest === "string" ? JSON.parse(doc.digest) : {};
      } catch {
        digest = {};
      }
      return {
        id: doc.$id,
        timestamp: doc.$createdAt,
        fileName: doc.source_label ?? "",
        paperCode: (() => {
          if (typeof doc.paper_code === "string") {
            const trimmedCode = doc.paper_code.trim();
            if (trimmedCode.length > 0) return trimmedCode;
          }
          return digest.paperCode ?? "";
        })(),
        status: String(doc.status ?? "failed").toLowerCase(),
        rowsAffected: Number(digest.rowsAffected ?? doc.characters_ingested ?? 0),
        errors: Array.isArray(digest.errors) ? digest.errors : [],
      };
    });
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json({ logs: [], error: normalizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let logFileName = "unknown.md";
  let logFileId: string | undefined;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".md")) {
      return NextResponse.json({ error: "Only .md files are supported." }, { status: 400 });
    }

    logFileName = file.name;
    await ensureMdIngestionBucket();
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileId = ID.unique();
    logFileId = fileId;
    await adminStorage().createFile(
      MD_INGESTION_BUCKET_ID,
      fileId,
      InputFile.fromBuffer(buffer, file.name),
    );

    const source = buffer.toString("utf8");
    const parsed = parseDemoDataEntryMarkdown(source);

    if (!parsed.frontmatter || !parsed.entryType) {
      await createIngestionLog({
        fileName: file.name,
        fileId,
        entryType: parsed.entryType ?? undefined,
        status: "failed",
        rowsAffected: 0,
        errors: parsed.errors,
      });
      return NextResponse.json(
        { status: "failed", fileId, fileName: file.name, added: 0, updated: 0, errors: parsed.errors },
        { status: 400 },
      );
    }

    const frontmatter = parsed.frontmatter;
    let syllabusResult = { added: 0, updated: 0 };
    let questionResult = { added: 0, updated: 0 };
    const dbErrors = [...parsed.errors];
    const semester = deriveSemesterFromCode(frontmatter.paper_code);

    try {
      if (parsed.entryType === "syllabus") {
        syllabusResult = await upsertSyllabusRows({
          frontmatter,
          semester,
          rows: parsed.syllabus,
        });
      }
    } catch (error) {
      dbErrors.push({ line: 0, message: `Syllabus upsert failed: ${normalizeError(error)}` });
    }

    try {
      if (parsed.entryType === "question") {
        questionResult = await upsertQuestionRows({
          frontmatter,
          rows: parsed.questions,
        });
      }
    } catch (error) {
      dbErrors.push({ line: 0, message: `Question upsert failed: ${normalizeError(error)}` });
    }

    const added = syllabusResult.added + questionResult.added;
    const updated = syllabusResult.updated + questionResult.updated;
    const rowsAffected = added + updated;
    const status: "success" | "partial" | "failed" =
      dbErrors.length === 0 ? "success" : rowsAffected > 0 ? "partial" : "failed";

    await createIngestionLog({
      fileName: file.name,
      fileId,
      paperCode: frontmatter.paper_code,
      paperName: frontmatter.paper_name,
      subject: frontmatter.subject,
      entryType: parsed.entryType,
      status,
      rowsAffected,
      errors: dbErrors,
    });

    return NextResponse.json({
      status,
      fileId,
      fileName: file.name,
      paperCode: frontmatter.paper_code,
      entryType: parsed.entryType,
      added,
      updated,
      rowsAffected,
      details: {
        syllabus: syllabusResult,
        questions: questionResult,
      },
      errors: dbErrors,
    });
  } catch (error) {
    await createIngestionLog({
      fileName: logFileName,
      fileId: logFileId,
      status: "failed",
      rowsAffected: 0,
      errors: [{ line: 0, message: normalizeError(error) }],
    });
    return NextResponse.json({ error: normalizeError(error) }, { status: 500 });
  }
}
