import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { isModerator } from "@/lib/roles";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  ID,
  getAppwriteFileUrl,
} from "@/lib/appwrite";
import { findByPaperCode } from "@/data/syllabus-registry";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function formatSemester(n: number): string {
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

function examTypeFromCode(code: string): string | undefined {
  const last = code.trim().toUpperCase().slice(-1);
  if (last === "T") return "Theory";
  if (last === "P") return "Practical";
  return undefined;
}

interface BulkPayload {
  fileId: string;
  paper_code: string;
  university: string;
  year: number | string;
  file_name?: string;
  paper_name?: string;
  department?: string;
  semester?: string;
}

/**
 * POST /api/admin/bulk-import (moderator only)
 *
 * Accepts a JSON array of paper payloads (same shape as /api/upload) and
 * creates approved paper documents directly. Intended for curated bot imports
 * where files are already in Appwrite Storage.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user || !isModerator(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payloads: BulkPayload[];
    try {
      const body = await request.json();
      payloads = Array.isArray(body) ? body : body.payloads;
      if (!Array.isArray(payloads)) throw new Error("expected array");
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body: expected an array of paper payloads." },
        { status: 400 }
      );
    }

    const db = adminDatabases();
    const results: { paper_code: string; ok: boolean; error?: string }[] = [];

    for (const p of payloads) {
      const paper_code = typeof p.paper_code === "string" ? p.paper_code.trim() : "";
      const fileId = typeof p.fileId === "string" ? p.fileId.trim() : "";
      const university = typeof p.university === "string" ? p.university.trim() : "";
      const yearNum = Number(p.year);
      if (!paper_code || !fileId || !university || !Number.isInteger(yearNum)) {
        results.push({ paper_code: paper_code || "(missing)", ok: false, error: "Missing required fields" });
        continue;
      }

      try {
        const registryEntry = findByPaperCode(paper_code, university);
        const courseCode = paper_code.toUpperCase();
        const paperName = p.paper_name?.trim() || registryEntry?.paper_name || courseCode;
        const department = p.department?.trim() || registryEntry?.subject || courseCode;
        let semester = p.semester?.trim() || (registryEntry ? formatSemester(registryEntry.semester) : undefined);
        let programme = registryEntry?.programme;

        const fyugMatch = /^[A-Z]{3}(?:DSC|DSM|IDC|SEC|AEC|VAC|GEC)([1-8])\d{2}[ABC]?[TP]$/.exec(courseCode);
        if (fyugMatch) {
          if (!semester) semester = formatSemester(parseInt(fyugMatch[1], 10));
          if (!programme) programme = "FYUGP";
        }

        const fileUrl = getAppwriteFileUrl(fileId);

        await db.createDocument(DATABASE_ID, COLLECTION.papers, ID.unique(), {
          course_code: courseCode,
          paper_name: paperName,
          year: yearNum,
          semester,
          department,
          programme,
          institute: university,
          exam_type: examTypeFromCode(paper_code),
          file_id: fileId,
          file_url: fileUrl,
          uploaded_by: user.id,
          approved: true,
          status: "approved",
        });
        results.push({ paper_code, ok: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ paper_code, ok: false, error: message });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({ success: true, created: okCount, total: results.length, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
