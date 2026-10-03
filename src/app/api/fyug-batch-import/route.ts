import { NextResponse, type NextRequest } from "next/server";
import {
  adminDatabases,
  adminStorage,
  BUCKET_ID,
  DATABASE_ID,
  COLLECTION,
  ID,
  Query,
  getAppwriteFileUrl,
} from "@/lib/appwrite";
import { findByPaperCode } from "@/data/syllabus-registry";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * TEMPORARY one-off route for the FYUG batch import (2026-10-03). NOTE: intentionally NOT under /api/admin so the session middleware does not block it;
 * Protected by a one-time secret instead of a user session because the
 * import is driven by a server-side script that holds no browser session.
 * DELETE THIS FILE after the import is verified.
 */
const ONE_TIME_SECRET = "53fffd5ed4b1ed49bc7e154f5c0db0ecca7aacbc7ca1bf4b"

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
  programme?: string;
}

const FYUG_SEM_NO: Record<string, number> = {
  "10": 1, "15": 2, "20": 3, "25": 4,
  "30": 5, "35": 6, "40": 7, "45": 8,
};
const FYUG_FALLBACK_RE =
  /^[A-Z]{3}(?:DSC|DSM|IDC|SEC|AEC|VAC|GEC)((?:10|15|20|25|30|35|40|45))[1-9](?:\/\d{3})?[ABC]?[TP]?(?:\([A-Z]\))?$/;

const UPDATE_FIELDS = ["department", "paper_name", "semester", "programme"] as const;

export async function POST(request: NextRequest) {
  let body: {
    secret?: string;
    payloads?: BulkPayload[];
    updates?: { id: string; fields: Record<string, string> }[];
    audit?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (body.secret !== ONE_TIME_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = adminDatabases();

  // ── Full audit: total count, (course_code, year) duplicates, missing PDFs ──
  if (body.audit) {
    const docs: { id: string; course_code: string; year: number; file_id: string; approved: boolean }[] = [];
    let offset = 0;
    for (;;) {
      const page = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.limit(500),
        Query.offset(offset),
        Query.select(["$id", "course_code", "year", "file_id", "approved"]),
      ]);
      for (const d of page.documents) {
        docs.push({
          id: d.$id,
          course_code: String(d.course_code ?? ""),
          year: Number(d.year ?? 0),
          file_id: String(d.file_id ?? ""),
          approved: d.approved === true,
        });
      }
      if (page.documents.length < 500) break;
      offset += 500;
    }
    const seen = new Map<string, string[]>();
    for (const d of docs) {
      const key = `${d.course_code}|||${d.year}`;
      const arr = seen.get(key) ?? [];
      arr.push(d.id);
      seen.set(key, arr);
    }
    const duplicates = [...seen.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([key, ids]) => {
        const [course_code, year] = key.split("|||");
        return { course_code, year: Number(year), count: ids.length, ids };
      });
    const storage = adminStorage();
    const missingFiles: { id: string; course_code: string; year: number; file_id: string }[] = [];
    let checkedFiles = 0;
    const checkOne = async (d: (typeof docs)[number]) => {
      if (!d.file_id) {
        missingFiles.push({ id: d.id, course_code: d.course_code, year: d.year, file_id: "" });
        return;
      }
      checkedFiles++;
      try {
        await storage.getFile(BUCKET_ID, d.file_id);
      } catch {
        missingFiles.push({ id: d.id, course_code: d.course_code, year: d.year, file_id: d.file_id });
      }
    };
    // 25 concurrent storage checks per batch to stay well under the timeout.
    for (let i = 0; i < docs.length; i += 25) {
      await Promise.all(docs.slice(i, i + 25).map(checkOne));
    }
    return NextResponse.json({
      success: true,
      total: docs.length,
      approved: docs.filter((d) => d.approved).length,
      duplicates,
      missingFiles,
      checkedFiles,
    });
  }
  const importResults: { paper_code: string; ok: boolean; error?: string }[] = [];

  for (const p of body.payloads ?? []) {
    const paper_code = typeof p.paper_code === "string" ? p.paper_code.trim() : "";
    const fileId = typeof p.fileId === "string" ? p.fileId.trim() : "";
    const university = typeof p.university === "string" ? p.university.trim() : "";
    const yearNum = Number(p.year);
    if (!paper_code || !fileId || !university || !Number.isInteger(yearNum)) {
      importResults.push({ paper_code: paper_code || "(missing)", ok: false, error: "Missing required fields" });
      continue;
    }
    try {
      const registryEntry = findByPaperCode(paper_code, university);
      const courseCode = paper_code.toUpperCase();
      const paperName = p.paper_name?.trim() || registryEntry?.paper_name || courseCode;
      const department = p.department?.trim() || registryEntry?.subject || courseCode;
      let semester = p.semester?.trim() || (registryEntry ? formatSemester(registryEntry.semester) : undefined);
      let programme = p.programme?.trim() || registryEntry?.programme;
      const fyugMatch = FYUG_FALLBACK_RE.exec(courseCode);
      if (fyugMatch) {
        if (!semester) semester = formatSemester(FYUG_SEM_NO[fyugMatch[1]]);
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
        uploaded_by: "6ac0ddb2000746916e5d",
        approved: true,
        status: "approved",
      });
      importResults.push({ paper_code, ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      importResults.push({ paper_code, ok: false, error: message });
    }
  }

  const updateResults: { id: string; ok: boolean; error?: string }[] = [];
  for (const u of body.updates ?? []) {
    try {
      const update: Record<string, string> = {};
      for (const key of UPDATE_FIELDS) {
        const v = u.fields?.[key];
        if (typeof v === "string" && v.trim()) update[key] = v.trim().slice(0, 200);
      }
      if (Object.keys(update).length === 0) throw new Error("Nothing to update");
      await db.updateDocument(DATABASE_ID, COLLECTION.papers, u.id, update);
      updateResults.push({ id: u.id, ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      updateResults.push({ id: u.id, ok: false, error: message });
    }
  }

  const created = importResults.filter((r) => r.ok).length;
  return NextResponse.json({
    success: true,
    created,
    total: importResults.length,
    importResults,
    updateResults,
  });
}
