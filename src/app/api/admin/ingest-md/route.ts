import { NextResponse, type NextRequest } from "next/server";
import { InputFile } from "node-appwrite/file";
import { AppwriteException, Compression } from "node-appwrite";
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
  QUESTION_INGESTION_ASSETS_BUCKET_ID,
  Query,
  SYLLABUS_MD_INGESTION_BUCKET_ID,
} from "@/lib/appwrite";
import { parseDemoDataEntryMarkdown, type IngestionFrontmatter } from "@/lib/admin-md-ingestion";
import { FYUG_DEPT_CODES } from "@/lib/fyug-depts";
import { generatePDF, markdownToHTML } from "@/lib/pdf-generator";

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

function normalizeQuestionSubpart(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function sanitizeDownloadFilename(name: string): string {
  const trimmed = name.trim();
  const safe = trimmed.replace(/[\r\n"]/g, "").replace(/[\/\\:*?<>|]/g, "_");
  return safe.length > 0 ? safe : "ingestion.md";
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

// Cap generated question-paper PDFs to avoid runaway render sizes from malformed markdown uploads.
// PDFs beyond this threshold are truncated by the renderer and ingestion continues with a partial warning.
const MAX_QUESTION_PDF_PAGES = 80;
const MAX_QUESTION_ID_SLUG_LENGTH = 32;

function normalizePaperCode(value: string): string {
  return value.trim().toUpperCase();
}

function toPaperCodeSlug(value: string): string {
  return normalizePaperCode(value).replace(/[^A-Z0-9_-]+/g, "_");
}

function buildSyllabusPdfUrl(frontmatter: IngestionFrontmatter): string {
  const params = new URLSearchParams({
    paperCode: normalizePaperCode(frontmatter.paper_code),
    mode: "pdf",
    university: frontmatter.university,
    course: frontmatter.course,
    stream: frontmatter.stream,
    type: frontmatter.type,
  });
  return `/api/syllabus/table?${params.toString()}`;
}

function resolveSyllabusPdfUrl(frontmatter: IngestionFrontmatter): string {
  const explicit = (frontmatter.syllabus_pdf_url ?? "").trim();
  return explicit.length > 0 ? explicit : buildSyllabusPdfUrl(frontmatter);
}

function buildQuestionMarkdown(frontmatter: IngestionFrontmatter, rows: Array<{
  question_no: string;
  question_subpart: string;
  year?: number;
  question_content: string;
  marks?: number;
  tags: string[];
}>): string {
  const lines: string[] = [];
  const paperCode = normalizePaperCode(frontmatter.paper_code);
  const title = frontmatter.paper_name.trim() || paperCode;
  const examYear = typeof frontmatter.exam_year === "number" ? String(frontmatter.exam_year) : "";
  lines.push(`# ${title} — Question Paper`);
  lines.push("");
  lines.push(`**Paper Code:** ${paperCode}`);
  lines.push(`**University:** ${frontmatter.university}`);
  lines.push(`**Course:** ${frontmatter.course}`);
  lines.push(`**Stream:** ${frontmatter.stream}`);
  lines.push(`**Type:** ${frontmatter.type}`);
  if (examYear) lines.push(`**Exam Year:** ${examYear}`);
  if (frontmatter.exam_session) lines.push(`**Exam Session:** ${frontmatter.exam_session}`);
  lines.push("");
  lines.push("## Questions");
  lines.push("");
  lines.push("| No | Subpart | Year | Marks | Question | Tags |");
  lines.push("|---|---|---:|---:|---|---|");
  for (const row of rows) {
    const year = resolveQuestionRowYear(row.year, frontmatter.exam_year);
    const marks = typeof row.marks === "number" ? row.marks : "";
    const subpart = row.question_subpart || "—";
    const tags = row.tags.length > 0 ? row.tags.join(", ") : "—";
    const question = row.question_content
      .replace(/\r?\n+/g, " / ")
      .replace(/\|/g, "\\|")
      .replace(/[ \t]+/g, " ")
      .trim();
    lines.push(`| ${row.question_no} | ${subpart} | ${year} | ${marks} | ${question} | ${tags} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function questionPdfFilename(frontmatter: IngestionFrontmatter): string {
  const paperCode = toPaperCodeSlug(frontmatter.paper_code);
  const questionId = (frontmatter.question_id ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .slice(0, MAX_QUESTION_ID_SLUG_LENGTH);
  const examYear = typeof frontmatter.exam_year === "number" ? String(frontmatter.exam_year) : "unknown";
  const suffix = questionId.length > 0 ? questionId : "ingestion";
  return `${paperCode}-questions-${examYear}-${suffix}.pdf`;
}

function resolveQuestionRowYear(rowYear: number | undefined, examYear: number | undefined): number | string {
  if (typeof rowYear === "number") return rowYear;
  if (typeof examYear === "number") return examYear;
  return "";
}

async function ensureIngestionBuckets() {
  const storage = adminStorage();
  const ensureBucket = async (
    bucketId: string,
    name: string,
    allowedFileExtensions: string[],
    maximumFileSizeBytes: number,
  ) => {
    try {
      await storage.getBucket({ bucketId });
    } catch (error) {
      const code = (error as { code?: number })?.code;
      if (code !== 404) throw error;
      await storage.createBucket({
        bucketId,
        name,
        permissions: [],
        fileSecurity: false,
        enabled: true,
        maximumFileSize: maximumFileSizeBytes,
        allowedFileExtensions,
        compression: Compression.None,
        encryption: true,
        antivirus: true,
        transformations: false,
      });
    }
  };

  await ensureBucket(
    SYLLABUS_MD_INGESTION_BUCKET_ID,
    "examarchive-syllabus-md-ingestion",
    ["md"],
    2 * 1024 * 1024,
  );
  await ensureBucket(
    QUESTION_INGESTION_ASSETS_BUCKET_ID,
    "examarchive_question_ingest_assets",
    ["md", "pdf"],
    5 * 1024 * 1024,
  );
}

async function renderAndStoreQuestionPdf(args: {
  frontmatter: IngestionFrontmatter;
  rows: ReturnType<typeof parseDemoDataEntryMarkdown>["questions"];
}): Promise<{ fileId: string; fileUrl: string }> {
  const markdown = buildQuestionMarkdown(args.frontmatter, args.rows);
  const html = markdownToHTML(markdown);
  const { buffer } = await generatePDF({
    html,
    maxPages: MAX_QUESTION_PDF_PAGES,
    title: `${normalizePaperCode(args.frontmatter.paper_code)} Question Paper`,
    meta: { topic: `${normalizePaperCode(args.frontmatter.paper_code)} Question Paper` },
  });
  const fileId = ID.unique();
  await adminStorage().createFile(
    QUESTION_INGESTION_ASSETS_BUCKET_ID,
    fileId,
    InputFile.fromBuffer(buffer, questionPdfFilename(args.frontmatter)),
  );
  return {
    fileId,
    fileUrl: `/api/files/ingestion-question/${encodeURIComponent(fileId)}`,
  };
}

async function upsertSyllabusRows(args: {
  frontmatter: IngestionFrontmatter;
  semester: number | null;
  rows: ReturnType<typeof parseDemoDataEntryMarkdown>["syllabus"];
  resolvedSyllabusPdfUrl: string;
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
    payload.syllabus_pdf_url = args.resolvedSyllabusPdfUrl;
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
  resolvedQuestionPdfUrl: string;
}) {
  const db = adminDatabases();
  const linkedSyllabusEntryId = await resolveLinkedSyllabusEntryId(args.frontmatter);
  const linkStatus = args.frontmatter.link_status ?? (linkedSyllabusEntryId ? "linked" : "unmapped");
  let added = 0;
  let updated = 0;
  for (const row of args.rows) {
    const normalizedQuestionSubpart = normalizeQuestionSubpart(row.question_subpart);
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
      (document) => normalizeQuestionSubpart(document.question_subpart) === normalizedQuestionSubpart,
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
      question_content: row.question_content,
      tags: row.tags,
    };
    if (normalizedQuestionSubpart) {
      basePayload.question_subpart = normalizedQuestionSubpart;
    }
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
    // Keep existing DB value untouched when no URL was provided/generated in this run.
    const resolvedQuestionPdfUrl = args.resolvedQuestionPdfUrl.trim();
    if (resolvedQuestionPdfUrl.length > 0) {
      payload.question_pdf_url = resolvedQuestionPdfUrl;
    }
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
  sourceEntryType?: "syllabus" | "question";
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
      file_url:
        payload.fileId && payload.sourceEntryType
          ? `/api/admin/ingest-md?fileId=${encodeURIComponent(payload.fileId)}&entryType=${encodeURIComponent(payload.sourceEntryType)}`
          : "",
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
    console.warn("[ingest-md] failed to write ingestion log:", normalizeError(error));
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
    const canonicalId = typeof doc.id === "string" ? doc.id.trim() : "";
    if (canonicalId) return canonicalId;
    const docId = typeof doc.$id === "string" ? doc.$id.trim() : "";
    if (docId) return docId;
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

  const fileId = searchParams.get("fileId")?.trim();
  if (fileId) {
    const entryType = searchParams.get("entryType")?.trim().toLowerCase();
    const sourceBucketId =
      entryType === "question"
        ? QUESTION_INGESTION_ASSETS_BUCKET_ID
        : SYLLABUS_MD_INGESTION_BUCKET_ID;
    try {
      const storage = adminStorage();
      const [fileBuffer, fileMeta] = await Promise.all([
        storage.getFileDownload(sourceBucketId, fileId),
        storage.getFile(sourceBucketId, fileId),
      ]);
      const fileName = sanitizeDownloadFilename(fileMeta?.name || `${fileId}.md`);
      const encodedName = encodeURIComponent(fileName);
      const fallbackHeaderName = fileName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "private, max-age=300",
          "Content-Disposition": `inline; filename="${fallbackHeaderName}"; filename*=UTF-8''${encodedName}`,
        },
      });
    } catch (error: unknown) {
      if (error instanceof AppwriteException && (error.code === 400 || error.code === 404)) {
        return new NextResponse("Markdown file not found", { status: 404 });
      }
      console.error("[ingest-md] failed to serve markdown file", error);
      return new NextResponse("Failed to fetch markdown file", { status: 500 });
    }
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
  let logSourceEntryType: "syllabus" | "question" | undefined;
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
    const buffer = Buffer.from(await file.arrayBuffer());
    const source = buffer.toString("utf8");
    const parsed = parseDemoDataEntryMarkdown(source);
    logSourceEntryType = parsed.entryType ?? "syllabus";

    await ensureIngestionBuckets();
    const sourceBucketId =
      parsed.entryType === "question"
        ? QUESTION_INGESTION_ASSETS_BUCKET_ID
        : SYLLABUS_MD_INGESTION_BUCKET_ID;
    const fileId = ID.unique();
    logFileId = fileId;
    await adminStorage().createFile(
      sourceBucketId,
      fileId,
      InputFile.fromBuffer(buffer, file.name),
    );

    if (!parsed.frontmatter || !parsed.entryType) {
      await createIngestionLog({
        fileName: file.name,
        fileId,
        sourceEntryType: logSourceEntryType,
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
    const resolvedSyllabusPdfUrl = resolveSyllabusPdfUrl(frontmatter);
    let resolvedQuestionPdfUrl = (frontmatter.question_pdf_url ?? "").trim();

    if (parsed.entryType === "question" && resolvedQuestionPdfUrl.length === 0) {
      try {
        const renderedQuestionPdf = await renderAndStoreQuestionPdf({
          frontmatter,
          rows: parsed.questions,
        });
        resolvedQuestionPdfUrl = renderedQuestionPdf.fileUrl;
      } catch (error) {
        dbErrors.push({ line: 0, message: `Question PDF render failed: ${normalizeError(error)}` });
      }
    }

    try {
      if (parsed.entryType === "syllabus") {
        syllabusResult = await upsertSyllabusRows({
          frontmatter,
          semester,
          rows: parsed.syllabus,
          resolvedSyllabusPdfUrl,
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
          resolvedQuestionPdfUrl,
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
      sourceEntryType: parsed.entryType,
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
      syllabusPdfUrl: parsed.entryType === "syllabus" ? resolvedSyllabusPdfUrl : undefined,
      questionPdfUrl: parsed.entryType === "question" ? resolvedQuestionPdfUrl || null : undefined,
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
      sourceEntryType: logSourceEntryType,
      status: "failed",
      rowsAffected: 0,
      errors: [{ line: 0, message: normalizeError(error) }],
    });
    return NextResponse.json({ error: normalizeError(error) }, { status: 500 });
  }
}
