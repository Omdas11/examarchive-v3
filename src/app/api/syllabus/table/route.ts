import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { InputFile } from "node-appwrite/file";
import { adminDatabases, adminStorage, COLLECTION, DATABASE_ID, Query, ID, SYLLABUS_BUCKET_ID } from "@/lib/appwrite";
import { verifyTurnstileDownloadToken } from "@/lib/turnstile";
import { getServerUser } from "@/lib/auth";
import {
  buildPaperMarkdown,
  dedupeSyllabusRowsByUnit,
  derivePaperNameFromRows,
  extractSubjectCode,
  normalizePaperCode,
  toSyllabusTableRow,
  type SyllabusTablePaperSummary,
  type SyllabusTableRow,
} from "@/lib/syllabus-table";
import { generatePDF, markdownToHTML } from "@/lib/pdf-generator";
import { findByPaperCode } from "@/data/syllabus-registry";

const MAX_PAGES_SINGLE_PAPER = 20;
const MAX_PAGES_DEPARTMENTAL = 40;
const SYLLABUS_TABLE_PAGE_SIZE = 500;
const SYLLABUS_TABLE_MAX_PAGES = 20;
const QUESTIONS_TABLE_PAGE_SIZE = 500;
const QUESTIONS_TABLE_MAX_PAGES = 20;
const SYLLABUS_PDF_DAILY_LIMIT = 5;

function isAdminPlus(role: string): boolean {
  return role === "moderator" || role === "founder";
}

function safeFilenameToken(input: string, fallback: string): string {
  // Sanitize user-controlled tokens before using them in Content-Disposition.
  // Allow only uppercase A-Z, digits, underscore, and hyphen to prevent header
  // injection and keep browser filename handling deterministic.
  const token = input
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return token || fallback;
}

async function getDailyPdfCount(userId: string, todayStr: string): Promise<number> {
  const db = adminDatabases();
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.pdf_usage, [
      Query.equal("user_id", userId),
      Query.equal("date", todayStr),
    ]);
    return res.total;
  } catch {
    return 0;
  }
}

async function recordPdfGeneration(userId: string, todayStr: string): Promise<void> {
  const db = adminDatabases();
  try {
    await db.createDocument(DATABASE_ID, COLLECTION.pdf_usage, ID.unique(), {
      user_id: userId,
      date: todayStr,
    });
  } catch (error) {
    console.error("[syllabus-table] Failed to record PDF usage:", error);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paperCode = (searchParams.get("paperCode") || "").trim();
  const subjectCode = (searchParams.get("subjectCode") || "").trim().toUpperCase();
  const subjectName = (searchParams.get("subjectName") || "").trim();
  const mode = (searchParams.get("mode") || "").trim().toLowerCase();
  const university = (searchParams.get("university") || "").trim();
  const course = (searchParams.get("course") || "").trim();
  const stream = (searchParams.get("stream") || "").trim();
  const type = (searchParams.get("type") || "").trim();

  try {
    const user = await getServerUser();
    const isPdfMode = mode === "pdf";
    // PDF downloads need a Turnstile token (`ctoken`, issued after passing
    // the Turnstile check) — for EVERYONE, logged-in or not. A bare session
    // is not enough, so a bot with an account cannot bulk-download generated
    // PDFs and burn the Appwrite read budget. The download buttons always
    // supply a `ctoken`. The token is bound to the paper code
    // (single-paper PDF) or `dept-<code>` (departmental PDF).
    if (isPdfMode) {
      const ctoken = (searchParams.get("ctoken") || "").trim();
      const normalizedCode = normalizePaperCode(paperCode);
      const deptScope = subjectCode ? `dept-${subjectCode}` : "";
      const hasValidTurnstile =
        (normalizedCode &&
          verifyTurnstileDownloadToken({ fileId: normalizedCode, token: ctoken })) ||
        (deptScope &&
          verifyTurnstileDownloadToken({ fileId: deptScope, token: ctoken }));
      if (!hasValidTurnstile) {
        return NextResponse.json(
          { error: "Complete the human check to download this PDF." },
          { status: 401 },
        );
      }
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    let usedBefore = 0;
    if (isPdfMode && user && !isAdminPlus(user.role)) {
      usedBefore = await getDailyPdfCount(user.id, todayStr);
      if (usedBefore >= SYLLABUS_PDF_DAILY_LIMIT) {
        return NextResponse.json(
          {
            error: "Daily syllabus PDF limit reached. Please try again tomorrow.",
            code: "PDF_DAILY_LIMIT_REACHED",
            limit: SYLLABUS_PDF_DAILY_LIMIT,
            remaining: 0,
          },
          { status: 429 },
        );
      }
    }

    const db = adminDatabases();
    const normalizedPaperCode = normalizePaperCode(paperCode);
    // Single-paper mode: fetch the whole subject and match by canonical code
    // below — the table stores the same paper under several spellings
    // ("PHYSEC-101" vs "PHYSEC101"), so an exact paper_code query would
    // miss half the rows. Falls back to the exact query when the code
    // carries no recognisable subject prefix.
    const subjectForPaper = normalizedPaperCode
      ? extractSubjectCode(normalizedPaperCode)
      : "";
    const filterQueries = [
      Query.equal("status", "published"),
      university ? Query.equal("university", university) : null,
      course ? Query.equal("course", course) : null,
      stream ? Query.equal("stream", stream) : null,
      type ? Query.equal("type", type) : null,
      normalizedPaperCode && subjectForPaper
        ? Query.equal("subject", subjectForPaper)
        : normalizedPaperCode
          ? Query.equal("paper_code", normalizedPaperCode)
          : null,
    ].filter(Boolean) as string[];
    const rows: SyllabusTableRow[] = [];
    let cursorAfter: string | null = null;
    let pageCount = 0;
    while (pageCount < SYLLABUS_TABLE_MAX_PAGES) {
      const pageQueries = [
        ...filterQueries,
        Query.orderAsc("$id"),
        Query.limit(SYLLABUS_TABLE_PAGE_SIZE),
        cursorAfter ? Query.cursorAfter(cursorAfter) : null,
      ].filter(Boolean) as string[];
      const page = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, pageQueries);
      rows.push(
        ...page.documents.map((doc) => {
          const row = toSyllabusTableRow(doc as Record<string, unknown>);
          return { ...row, paper_code: row.paper_code.toUpperCase() };
        }),
      );
      if (page.documents.length < SYLLABUS_TABLE_PAGE_SIZE) break;
      cursorAfter = page.documents[page.documents.length - 1]?.$id ?? null;
      if (!cursorAfter) break;
      pageCount += 1;
    }
    if (pageCount >= SYLLABUS_TABLE_MAX_PAGES) {
      console.warn("[syllabus-table] Hit pagination cap while listing Syllabus_Table rows.");
    }

    if (normalizedPaperCode) {
      let paperRows = dedupeSyllabusRowsByUnit(
        rows.filter((row) => normalizePaperCode(row.paper_code) === normalizedPaperCode),
      ).sort((a, b) => a.unit_number - b.unit_number);
      if (paperRows.length === 0) {
        // Defensive fallback: rows whose subject field disagrees with the
        // code prefix are invisible to the subject-scoped fetch above.
        const retry = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
          Query.equal("status", "published"),
          Query.equal("paper_code", paperCode.toUpperCase()),
          Query.limit(SYLLABUS_TABLE_PAGE_SIZE),
        ]);
        paperRows = dedupeSyllabusRowsByUnit(
          retry.documents.map((doc) => toSyllabusTableRow(doc as Record<string, unknown>)),
        ).sort((a, b) => a.unit_number - b.unit_number);
      }
      if (paperRows.length === 0) {
        return NextResponse.json({ error: "No syllabus rows found for this paper." }, { status: 404 });
      }

      const paperName = derivePaperNameFromRows(normalizedPaperCode, paperRows);
      const markdown = buildPaperMarkdown({
        paperCode: normalizedPaperCode,
        paperName,
        rows: paperRows,
        university: paperRows[0]?.university,
        course: paperRows[0]?.course,
        stream: paperRows[0]?.stream,
        type: paperRows[0]?.type,
      });

      if (mode === "pdf") {
        const downloadToken = safeFilenameToken(normalizedPaperCode, "SYLLABUS");
        const pdfHeaders = {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${downloadToken}_syllabus.pdf"`,
        };

        // ── Bucket cache: serve a previously generated PDF when the syllabus
        // content hasn't changed, instead of hitting Gotenberg every time. ──
        const contentHash = createHash("sha256").update(markdown).digest("hex").slice(0, 16);
        const cacheFileId = `syllabus-pdf-${downloadToken.toLowerCase()}-${contentHash}`;
        try {
          const cached = await adminStorage().getFileDownload(SYLLABUS_BUCKET_ID, cacheFileId);
          const cachedBuffer = Buffer.from(cached);
          return new NextResponse(cachedBuffer as unknown as BodyInit, {
            status: 200,
            headers: { ...pdfHeaders, "Content-Length": cachedBuffer.length.toString() },
          });
        } catch {
          // Cache miss — generate below.
        }

        const html = markdownToHTML(markdown);
        const { buffer } = await generatePDF({
          html,
          maxPages: MAX_PAGES_SINGLE_PAPER,
          title: `${normalizedPaperCode} Syllabus`,
          meta: { topic: `${normalizedPaperCode} Syllabus` },
        });
        if (user && !isAdminPlus(user.role)) {
          await recordPdfGeneration(user.id, todayStr);
        }

        // Store the fresh PDF for future downloads (best-effort; the download
        // itself must succeed even if caching fails).
        try {
          await adminStorage().createFile(
            SYLLABUS_BUCKET_ID,
            cacheFileId,
            InputFile.fromBuffer(Buffer.from(buffer), `${downloadToken}_syllabus.pdf`),
          );
        } catch {
          // Cache write failure is non-fatal.
        }

        return new NextResponse(buffer as unknown as BodyInit, {
          status: 200,
          headers: {
            ...pdfHeaders,
            "Content-Length": buffer.length.toString(),
          },
        });
      }

      return NextResponse.json({
        paper: {
          paperCode: normalizedPaperCode,
          paperName,
          subjectCode: extractSubjectCode(paperCode),
          university: paperRows[0]?.university ?? "",
          course: paperRows[0]?.course ?? "",
          stream: paperRows[0]?.stream ?? "",
          type: paperRows[0]?.type ?? "",
          units: paperRows,
          markdown,
        },
      });
    }

    if ((subjectCode || subjectName) && mode === "pdf") {
      const groupedByPaper = new Map<string, SyllabusTableRow[]>();
      for (const row of rows) {
        const rowSubject = row.subject.trim().toLowerCase();
        if (subjectName) {
          if (!rowSubject || rowSubject !== subjectName.toLowerCase()) continue;
        } else if (subjectCode && !row.paper_code.startsWith(subjectCode)) {
          continue;
        }
        // Canonical key: variant spellings of one paper merge into a single
        // section instead of appearing twice in the departmental PDF.
        const key = normalizePaperCode(row.paper_code);
        if (!key) continue;
        if (!groupedByPaper.has(key)) groupedByPaper.set(key, []);
        groupedByPaper.get(key)!.push(row);
      }
      if (groupedByPaper.size === 0) {
        return NextResponse.json({ error: "No syllabus rows found for this subject." }, { status: 404 });
      }
      const orderedCodes = Array.from(groupedByPaper.keys()).sort((a, b) => a.localeCompare(b));
      const mergedSections: string[] = [];
      for (const code of orderedCodes) {
        const paperRows = dedupeSyllabusRowsByUnit(groupedByPaper.get(code) ?? []);
        const paperName = derivePaperNameFromRows(code, paperRows);
        const md = buildPaperMarkdown({
          paperCode: code,
          paperName,
          rows: paperRows,
          university: paperRows[0]?.university,
          course: paperRows[0]?.course,
          stream: paperRows[0]?.stream,
          type: paperRows[0]?.type,
        });
        mergedSections.push(md);
      }
      const heading = subjectName || subjectCode;
      const mergedMarkdown = [
        `# ${heading} Departmental Syllabus`,
        "",
        `Compiled from ${orderedCodes.length} paper syllabi.`,
        "",
        mergedSections.join("\n\n---\n\n"),
      ].join("\n");
      const html = markdownToHTML(mergedMarkdown);
      const { buffer } = await generatePDF({
        html,
        maxPages: MAX_PAGES_DEPARTMENTAL,
        title: `${heading} Departmental Syllabus`,
        meta: { topic: `${heading} Departmental Syllabus` },
      });
      if (user && !isAdminPlus(user.role)) {
        await recordPdfGeneration(user.id, todayStr);
      }
      const downloadToken = safeFilenameToken(heading, "DEPARTMENT");
      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${downloadToken}_departmental_syllabus.pdf"`,
          "Content-Length": buffer.length.toString(),
        },
      });
    }

    const grouped = new Map<string, SyllabusTableRow[]>();
    for (const row of rows) {
      if (!row.paper_code) continue;
      // Canonical key: variant spellings of one paper merge into one entry.
      const key = normalizePaperCode(row.paper_code);
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    // Build question-paper year map from approved papers collection.
    const questionDocs: Array<Record<string, unknown>> = [];
    let papersCursorAfter: string | null = null;
    let papersPageCount = 0;
    while (papersPageCount < QUESTIONS_TABLE_MAX_PAGES) {
      const questionQueries = [
        Query.equal("approved", true),
        Query.orderAsc("$id"),
        Query.limit(QUESTIONS_TABLE_PAGE_SIZE),
        papersCursorAfter ? Query.cursorAfter(papersCursorAfter) : null,
      ].filter(Boolean) as string[];
      const page = await db.listDocuments(DATABASE_ID, COLLECTION.papers, questionQueries);
      questionDocs.push(...(page.documents as Array<Record<string, unknown>>));
      if (page.documents.length < QUESTIONS_TABLE_PAGE_SIZE) break;
      papersCursorAfter = page.documents[page.documents.length - 1]?.$id ?? null;
      if (!papersCursorAfter) break;
      papersPageCount += 1;
    }
    if (papersPageCount >= QUESTIONS_TABLE_MAX_PAGES) {
      console.warn("[syllabus-table] Hit pagination cap while listing approved papers.");
    }

    const questionYearsByCode = questionDocs.reduce<Map<string, Map<string, { paperId: string; year: number; examType?: string }>>>((acc, doc) => {
      // Canonical key: the papers collection stores hyphenated codes
      // ("COMGE-601T") that must match the normalised syllabus code.
      const code = normalizePaperCode(String(doc.course_code ?? ""));
      const yearRaw = Number(doc.year ?? 0);
      if (!code || !Number.isInteger(yearRaw) || yearRaw < 1900 || yearRaw > 2100) return acc;
      const paperId = String(doc.$id ?? doc.id ?? "");
      const examType = String(doc.exam_type ?? "").trim();
      const byYear = acc.get(code) ?? new Map<string, { paperId: string; year: number; examType?: string }>();
      const yearKey = `${yearRaw}:${examType.toLowerCase()}`;
      if (!byYear.has(yearKey) && paperId) {
        byYear.set(yearKey, { paperId, year: yearRaw, examType: examType || undefined });
      }
      acc.set(code, byYear);
      return acc;
    }, new Map());

    const papers: SyllabusTablePaperSummary[] = Array.from(grouped.entries())
      .map(([code, rawPaperRows]) => {
        // One row per unit: variant spellings of one paper must not
        // double-count lectures or units in the summary.
        const paperRows = dedupeSyllabusRowsByUnit(rawPaperRows);
        const derivedSubjectCode = extractSubjectCode(code);
        const storedSubject = paperRows.find((r) => r.subject)?.subject ?? "";
        // The registry matches exact spellings, so try the canonical code
        // first, then each raw variant stored in the table.
        const rawCodes = [...new Set(rawPaperRows.map((r) => r.paper_code.trim().toUpperCase()))];
        const registry =
          findByPaperCode(code) ?? rawCodes.map((c) => findByPaperCode(c)).find(Boolean);
        const questionPapers = Array.from(questionYearsByCode.get(code)?.values() ?? []).sort((a, b) =>
          a.year === b.year
            ? (a.examType ?? "").localeCompare(b.examType ?? "")
            : a.year - b.year,
        );
        return {
          paperCode: code,
          paperName: derivePaperNameFromRows(code, paperRows),
          subject: storedSubject,
          subjectCode: derivedSubjectCode,
          credits: registry?.credits,
          university: paperRows[0]?.university ?? "",
          course: paperRows[0]?.course ?? "",
          stream: paperRows[0]?.stream ?? "",
          type: paperRows[0]?.type ?? "",
          units: new Set(paperRows.map((row) => row.unit_number)).size,
          lectures: paperRows.reduce(
            (sum, row) => sum + (typeof row.lectures === "number" ? row.lectures : 0),
            0,
          ),
          questionPapers,
        };
      })
      .sort((a, b) => a.paperCode.localeCompare(b.paperCode));

    // Keep subject groups keyed by subjectCode to ensure Dept PDF prefix filter stays correct.
    const subjectStats = Array.from(
      papers.reduce<Map<string, { subjectCode: string; subjectName: string; papers: number; units: number }>>((acc, paper) => {
        const key = paper.subjectCode;
        const current = acc.get(key) ?? {
          subjectCode: paper.subjectCode,
          subjectName: paper.subject || paper.subjectCode,
          papers: 0,
          units: 0,
        };
        current.papers += 1;
        current.units += paper.units;
        acc.set(key, current);
        return acc;
      }, new Map()).values(),
    ).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    return NextResponse.json({ papers, subjects: subjectStats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
