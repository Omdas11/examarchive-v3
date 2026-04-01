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
import { parseDemoDataEntryMarkdown } from "@/lib/admin-md-ingestion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEMPLATE_PATH = path.resolve(process.cwd(), "DEMO_DATA_ENTRY.md");

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
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
  university: string;
  course: string;
  type: string;
  paperCode: string;
  rows: ReturnType<typeof parseDemoDataEntryMarkdown>["syllabus"];
}) {
  const db = adminDatabases();
  let added = 0;
  let updated = 0;
  for (const row of args.rows) {
    const existing = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
      Query.equal("paper_code", args.paperCode),
      Query.equal("unit_number", row.unit_number),
      Query.limit(1),
    ]);
    const rowId =
      typeof existing.documents[0]?.id === "string" && existing.documents[0].id.trim().length > 0
        ? existing.documents[0].id
        : randomUUID();
    const payload: Record<string, unknown> = {
      id: rowId,
      university: args.university,
      course: args.course,
      type: args.type,
      paper_code: args.paperCode,
      unit_number: row.unit_number,
      syllabus_content: row.syllabus_content,
      tags: row.tags,
    };
    if (typeof row.lectures === "number") {
      payload.lectures = row.lectures;
    }
    if (existing.documents[0]) {
      await db.updateDocument(DATABASE_ID, COLLECTION.syllabus_table, existing.documents[0].$id, payload);
      updated += 1;
    } else {
      await db.createDocument(DATABASE_ID, COLLECTION.syllabus_table, ID.unique(), payload);
      added += 1;
    }
  }
  return { added, updated };
}

async function upsertQuestionRows(args: {
  university: string;
  course: string;
  type: string;
  paperCode: string;
  paperName: string;
  rows: ReturnType<typeof parseDemoDataEntryMarkdown>["questions"];
}) {
  const db = adminDatabases();
  let added = 0;
  let updated = 0;
  for (const row of args.rows) {
    const existing = await db.listDocuments(DATABASE_ID, COLLECTION.questions_table, [
      Query.equal("paper_code", args.paperCode),
      Query.equal("question_no", row.question_no),
      Query.limit(1),
    ]);
    const rowId =
      typeof existing.documents[0]?.id === "string" && existing.documents[0].id.trim().length > 0
        ? existing.documents[0].id
        : randomUUID();
    const payload: Record<string, unknown> = {
      id: rowId,
      university: args.university,
      course: args.course,
      type: args.type,
      paper_code: args.paperCode,
      paper_name: args.paperName,
      question_no: row.question_no,
      question_subpart: row.question_subpart,
      question_content: row.question_content,
      tags: row.tags,
    };
    if (typeof row.marks === "number") {
      payload.marks = row.marks;
    }
    if (existing.documents[0]) {
      await db.updateDocument(DATABASE_ID, COLLECTION.questions_table, existing.documents[0].$id, payload);
      updated += 1;
    } else {
      await db.createDocument(DATABASE_ID, COLLECTION.questions_table, ID.unique(), payload);
      added += 1;
    }
  }
  return { added, updated };
}

async function createIngestionLog(payload: {
  fileName: string;
  fileId?: string;
  paperCode?: string;
  status: "success" | "partial" | "failed";
  rowsAffected: number;
  errors: Array<{ line: number; message: string }>;
}) {
  try {
    const db = adminDatabases();
    await db.createDocument(DATABASE_ID, COLLECTION.ai_ingestions, ID.unique(), {
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
    });
  } catch (error) {
    console.warn("[ingest-md] failed to write ingestion log:", error);
  }
}

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("template") === "1") {
    const fs = await import("fs/promises");
    const template = await fs.readFile(TEMPLATE_PATH, "utf8");
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
        paperCode: digest.paperCode ?? "",
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

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".md")) {
    return NextResponse.json({ error: "Only .md files are supported." }, { status: 400 });
  }

  await ensureMdIngestionBucket();
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileId = ID.unique();
  await adminStorage().createFile(
    MD_INGESTION_BUCKET_ID,
    fileId,
    InputFile.fromBuffer(buffer, file.name),
  );

  const source = buffer.toString("utf8");
  const parsed = parseDemoDataEntryMarkdown(source);

  if (!parsed.frontmatter) {
    await createIngestionLog({
      fileName: file.name,
      fileId,
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

  try {
    syllabusResult = await upsertSyllabusRows({
      university: frontmatter.university,
      course: frontmatter.course,
      type: frontmatter.type,
      paperCode: frontmatter.paper_code,
      rows: parsed.syllabus,
    });
  } catch (error) {
    dbErrors.push({ line: 0, message: `Syllabus upsert failed: ${normalizeError(error)}` });
  }

  try {
    questionResult = await upsertQuestionRows({
      university: frontmatter.university,
      course: frontmatter.course,
      type: frontmatter.type,
      paperCode: frontmatter.paper_code,
      paperName: frontmatter.paper_name,
      rows: parsed.questions,
    });
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
    status,
    rowsAffected,
    errors: dbErrors,
  });

  return NextResponse.json({
    status,
    fileId,
    fileName: file.name,
    paperCode: frontmatter.paper_code,
    added,
    updated,
    rowsAffected,
    details: {
      syllabus: syllabusResult,
      questions: questionResult,
    },
    errors: dbErrors,
  });
}
