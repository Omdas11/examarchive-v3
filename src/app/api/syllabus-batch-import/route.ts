import { NextResponse, type NextRequest } from "next/server";
import {
  adminDatabases,
  adminStorage,
  COLLECTION,
  DATABASE_ID,
  ID,
  Query,
  SYLLABUS_BUCKET_ID,
} from "@/lib/appwrite";
import { parseDemoDataEntryMarkdown } from "@/lib/admin-md-ingestion";
import {
  upsertSyllabusRows,
  deriveSemesterFromCode,
} from "@/app/api/admin/ingest-md/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// TEMPORARY — secret-guarded bulk syllabus import. DELETE AFTER USE.
const ONE_TIME_SECRET = "ce52d4a134cea48d30eadb8042fffa16d3cc55aae8cfdb04";

const BOT_UPLOADER_ID = "6ac0ddb2000746916e5d";

interface MdItem {
  filename: string;
  markdown: string;
}

interface PdfItem {
  fileId: string;
  subject: string;
  department: string;
  year: number;
  fileName: string;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.secret !== ONE_TIME_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mode = String(body.mode ?? "import-md");
  const db = adminDatabases();

  // ── List existing syllabus-collection docs (to find the 1 already-live PDF) ──
  if (mode === "list-syllabus") {
    const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [
      Query.limit(100),
    ]);
    return NextResponse.json({
      count: documents.length,
      docs: documents.map((d) => ({
        id: d.$id,
        subject: d.subject,
        department: d.department,
        course_code: d.course_code,
        course_name: d.course_name,
        year: d.year,
        university: d.university,
        approval_status: d.approval_status,
        file_url: d.file_url,
      })),
    });
  }

  // ── Import converted md files into Syllabus_Table ──
  if (mode === "import-md") {
    const items = (body.items ?? []) as MdItem[];
    const results: Array<Record<string, unknown>> = [];
    let totalAdded = 0;
    let totalUpdated = 0;
    for (const item of items) {
      try {
        const parsed = parseDemoDataEntryMarkdown(item.markdown);
        if (!parsed.frontmatter || !parsed.entryType) {
          results.push({
            filename: item.filename,
            ok: false,
            errors: parsed.errors.map((e) => `L${e.line}: ${e.message}`),
          });
          continue;
        }
        const frontmatter = parsed.frontmatter;
        // Main-site import: rows must be visible in the table view,
        // which filters status == "published".
        frontmatter.status = "published";
        const semester = deriveSemesterFromCode(frontmatter.paper_code);
        const params = new URLSearchParams({
          paperCode: frontmatter.paper_code.trim().toUpperCase(),
          mode: "pdf",
          university: frontmatter.university,
          course: frontmatter.course,
          stream: frontmatter.stream,
          type: frontmatter.type,
        });
        const res = await upsertSyllabusRows({
          frontmatter,
          semester,
          rows: parsed.syllabus,
          resolvedSyllabusPdfUrl: `/api/syllabus/table?${params.toString()}`,
        });
        totalAdded += res.added;
        totalUpdated += res.updated;
        results.push({
          filename: item.filename,
          ok: true,
          added: res.added,
          updated: res.updated,
          parseErrors: parsed.errors.map((e) => `L${e.line}: ${e.message}`),
        });
      } catch (err) {
        results.push({
          filename: item.filename,
          ok: false,
          errors: [err instanceof Error ? err.message : String(err)],
        });
      }
    }
    return NextResponse.json({ success: true, totalAdded, totalUpdated, results });
  }

  // ── Create syllabus-collection docs for uploaded department PDFs ──
  if (mode === "import-pdfs") {
    const pdfs = (body.pdfs ?? []) as PdfItem[];
    const existing = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [Query.limit(100)]);
    const have = new Set(
      existing.documents.map((d) => `${String(d.university)}|${String(d.subject)}`.toLowerCase()),
    );
    const results: Array<Record<string, unknown>> = [];
    for (const p of pdfs) {
      const key = `${"Assam University"}|${p.subject}`.toLowerCase();
      if (have.has(key)) {
        results.push({ subject: p.subject, skipped: true, reason: "already exists" });
        continue;
      }
      try {
        await db.createDocument(DATABASE_ID, COLLECTION.syllabus, ID.unique(), {
          university: "Assam University",
          subject: p.subject,
          department: p.department,
          semester: "",
          programme: "FYUGP",
          course_code: "",
          course_name: p.subject,
          year: p.year,
          uploader_id: BOT_UPLOADER_ID,
          approval_status: "approved",
          file_url: `/api/files/syllabus/${p.fileId}`,
        });
        // upload audit row (best-effort)
        try {
          await db.createDocument(DATABASE_ID, COLLECTION.uploads, ID.unique(), {
            user_id: BOT_UPLOADER_ID,
            file_id: p.fileId,
            file_name: p.fileName,
            status: "approved",
          });
        } catch { /* audit is best-effort */ }
        have.add(key);
        results.push({ subject: p.subject, created: true });
      } catch (err) {
        // roll back the storage file on DB failure
        try {
          await adminStorage().deleteFile(SYLLABUS_BUCKET_ID, p.fileId);
        } catch { /* ignore */ }
        results.push({
          subject: p.subject,
          created: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return NextResponse.json({ success: true, results });
  }

  return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
}
