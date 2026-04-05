import { NextResponse, type NextRequest } from "next/server";
import { adminDatabases, COLLECTION, DATABASE_ID, Query } from "@/lib/appwrite";
import {
  buildPaperMarkdown,
  extractSubjectCode,
  toSyllabusTableRow,
  type SyllabusTablePaperSummary,
  type SyllabusTableRow,
} from "@/lib/syllabus-table";
import { generatePDF, markdownToHTML } from "@/lib/pdf-generator";

const MAX_PAGES_SINGLE_PAPER = 20;
const MAX_PAGES_DEPARTMENTAL = 40;

function normalizePaperName(paperCode: string, rows: SyllabusTableRow[]): string {
  const derivedPaperName = rows
    .map((row) => row.syllabus_content.trim())
    .find((content) => content.length > 0)
    ?.split(/[.;\n]/)[0]
    ?.trim();
  if (!derivedPaperName) return paperCode;
  return derivedPaperName.length > 80
    ? `${derivedPaperName.slice(0, 77)}...`
    : derivedPaperName;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paperCode = (searchParams.get("paperCode") || "").trim();
  const subjectCode = (searchParams.get("subjectCode") || "").trim().toUpperCase();
  const mode = (searchParams.get("mode") || "").trim().toLowerCase();
  const university = (searchParams.get("university") || "").trim();
  const course = (searchParams.get("course") || "").trim();
  const stream = (searchParams.get("stream") || "").trim();
  const type = (searchParams.get("type") || "").trim();

  try {
    const db = adminDatabases();
    const normalizedPaperCode = paperCode.toUpperCase();
    const baseQueries = [
      university ? Query.equal("university", university) : null,
      course ? Query.equal("course", course) : null,
      stream ? Query.equal("stream", stream) : null,
      type ? Query.equal("type", type) : null,
      normalizedPaperCode ? Query.equal("paper_code", normalizedPaperCode) : null,
      Query.limit(5000),
    ].filter(Boolean) as string[];
    const rowsRes = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, baseQueries);
    const rows = rowsRes.documents.map((doc) => toSyllabusTableRow(doc as Record<string, unknown>));

    if (normalizedPaperCode) {
      const paperRows = rows
        .filter((row) => row.paper_code === normalizedPaperCode)
        .sort((a, b) => a.unit_number - b.unit_number);
      if (paperRows.length === 0) {
        return NextResponse.json({ error: "No syllabus rows found for this paper." }, { status: 404 });
      }

      const paperName = normalizePaperName(normalizedPaperCode, paperRows);
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
        const html = markdownToHTML(markdown);
        const { buffer } = await generatePDF({
          html,
          maxPages: MAX_PAGES_SINGLE_PAPER,
          title: `${normalizedPaperCode} Syllabus`,
          meta: { topic: `${normalizedPaperCode} Syllabus` },
        });
        return new NextResponse(buffer as unknown as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${normalizedPaperCode}_syllabus.pdf"`,
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

    if (subjectCode && mode === "pdf") {
      const groupedByPaper = new Map<string, SyllabusTableRow[]>();
      for (const row of rows) {
        if (!row.paper_code.startsWith(subjectCode)) continue;
        if (!groupedByPaper.has(row.paper_code)) groupedByPaper.set(row.paper_code, []);
        groupedByPaper.get(row.paper_code)!.push(row);
      }
      if (groupedByPaper.size === 0) {
        return NextResponse.json({ error: "No syllabus rows found for this subject." }, { status: 404 });
      }
      const orderedCodes = Array.from(groupedByPaper.keys()).sort((a, b) => a.localeCompare(b));
      const mergedSections: string[] = [];
      for (const code of orderedCodes) {
        const paperRows = groupedByPaper.get(code) ?? [];
        const paperName = normalizePaperName(code, paperRows);
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
      const mergedMarkdown = [
        `# ${subjectCode} Departmental Syllabus`,
        "",
        `Compiled from ${orderedCodes.length} paper syllabi.`,
        "",
        mergedSections.join("\n\n---\n\n"),
      ].join("\n");
      const html = markdownToHTML(mergedMarkdown);
      const { buffer } = await generatePDF({
        html,
        maxPages: MAX_PAGES_DEPARTMENTAL,
        title: `${subjectCode} Departmental Syllabus`,
        meta: { topic: `${subjectCode} Departmental Syllabus` },
      });
      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${subjectCode}_departmental_syllabus.pdf"`,
          "Content-Length": buffer.length.toString(),
        },
      });
    }

    const grouped = new Map<string, SyllabusTableRow[]>();
    for (const row of rows) {
      if (!row.paper_code) continue;
      if (!grouped.has(row.paper_code)) grouped.set(row.paper_code, []);
      grouped.get(row.paper_code)!.push(row);
    }

    const papers: SyllabusTablePaperSummary[] = Array.from(grouped.entries())
      .map(([code, paperRows]) => ({
        paperCode: code,
        paperName: normalizePaperName(code, paperRows),
        subjectCode: extractSubjectCode(code),
        university: paperRows[0]?.university ?? "",
        course: paperRows[0]?.course ?? "",
        stream: paperRows[0]?.stream ?? "",
        type: paperRows[0]?.type ?? "",
        units: new Set(paperRows.map((row) => row.unit_number)).size,
        lectures: paperRows.reduce(
          (sum, row) => sum + (typeof row.lectures === "number" ? row.lectures : 0),
          0,
        ),
      }))
      .sort((a, b) => a.paperCode.localeCompare(b.paperCode));
    const subjectStats = Array.from(
      papers.reduce<Map<string, { subjectCode: string; papers: number; units: number }>>((acc, paper) => {
        const current = acc.get(paper.subjectCode) ?? {
          subjectCode: paper.subjectCode,
          papers: 0,
          units: 0,
        };
        current.papers += 1;
        current.units += paper.units;
        acc.set(paper.subjectCode, current);
        return acc;
      }, new Map()).values(),
    ).sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));

    return NextResponse.json({ papers, subjects: subjectStats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
