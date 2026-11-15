/**
 * View / download counting + per-user activity history.
 *
 * - Paper totals live on the `papers` document itself (`view_count` /
 *   `download_count`, which the cards and the paper page already render
 *   whenever they are > 0).
 * - Syllabus totals live in `syllabus_stats`, one document per paper,
 *   ID = normalized paper code. Syllabus_Table has one row per unit, so
 *   counts cannot live there.
 * - Per-user history lives in `user_activity` (logged-in users only) and
 *   powers the Recently viewed / Downloads sections on /profile.
 *
 * Every function here swallows its own errors: counting must never break
 * a page render or a download. Callers in pages fire-and-forget the call
 * (the write starts immediately and the counter is best-effort, so the
 * page never waits on it); callers in API routes await the call but still
 * never fail the request on a counting error.
 */
import { headers } from "next/headers";
import { ID, Query, adminDatabases, COLLECTION, DATABASE_ID } from "@/lib/appwrite";
import { isBotUserAgent } from "@/lib/bot-check";

export type ActivityAction = "view" | "download";
export type ActivityScope = "paper" | "syllabus";

export interface ActivityEntry {
  action: ActivityAction;
  scope: ActivityScope;
  title: string;
  href: string;
  paper_ref: string;
  createdAt: string;
}

/** Log one view/download for a logged-in user. No-op when userId is null. */
export async function logUserActivity(
  userId: string | null | undefined,
  entry: Omit<ActivityEntry, "createdAt">,
): Promise<void> {
  if (!userId) return;
  try {
    const db = adminDatabases();
    await db.createDocument(DATABASE_ID, COLLECTION.user_activity, ID.unique(), {
      user_id: userId,
      action: entry.action,
      scope: entry.scope,
      title: entry.title,
      href: entry.href,
      paper_ref: entry.paper_ref,
    });
  } catch {
    // History is best-effort; never break the request.
  }
}

function toCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * True when the current request looks like a real person. Reads the
 * User-Agent from the request headers; any failure (no request scope,
 * e.g. in tests) returns false so nothing is counted.
 */
export async function isHumanRequest(): Promise<boolean> {
  try {
    const ua = (await headers()).get("user-agent");
    return !isBotUserAgent(ua);
  } catch {
    return false;
  }
}

/** Record a paper view, but only for a real (non-bot) request. Never throws. */
export async function recordPaperViewIfHuman(
  paperId: string,
  opts: { userId?: string | null; title: string; href: string },
): Promise<void> {
  try {
    if (!(await isHumanRequest())) return;
    await recordPaperView(paperId, opts);
  } catch {
    // Counting is best-effort.
  }
}

/** Record a syllabus view, but only for a real (non-bot) request. Never throws. */
export async function recordSyllabusViewIfHuman(
  paperCode: string,
  opts: { userId?: string | null; title: string; href: string },
): Promise<void> {
  try {
    if (!(await isHumanRequest())) return;
    await recordSyllabusView(paperCode, opts);
  } catch {
    // Counting is best-effort.
  }
}

/** +1 view on a paper + history row. `title`/`href` are for the history row. */
export async function recordPaperView(
  paperId: string,
  opts: { userId?: string | null; title: string; href: string },
): Promise<void> {
  try {
    const db = adminDatabases();
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.papers, paperId);
    await db.updateDocument(DATABASE_ID, COLLECTION.papers, paperId, {
      view_count: toCount(doc.view_count) + 1,
    });
  } catch {
    // Counting is best-effort.
  }
  await logUserActivity(opts.userId, {
    action: "view",
    scope: "paper",
    title: opts.title,
    href: opts.href,
    paper_ref: paperId,
  });
}

/** +1 download on a paper + history row. */
export async function recordPaperDownload(
  paperId: string,
  opts: { userId?: string | null; title: string; href: string },
): Promise<void> {
  try {
    const db = adminDatabases();
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.papers, paperId);
    await db.updateDocument(DATABASE_ID, COLLECTION.papers, paperId, {
      download_count: toCount(doc.download_count) + 1,
    });
  } catch {
    // Counting is best-effort.
  }
  await logUserActivity(opts.userId, {
    action: "download",
    scope: "paper",
    title: opts.title,
    href: opts.href,
    paper_ref: paperId,
  });
}

/** Find a paper document by its storage file_id (for download counting). */
export async function findPaperByFileId(fileId: string): Promise<{
  id: string;
  title: string;
} | null> {
  try {
    const db = adminDatabases();
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
      Query.equal("file_id", fileId),
      Query.limit(1),
    ]);
    const doc = res.documents[0];
    if (!doc) return null;
    const code = String(doc.course_code ?? "").trim();
    const name = String(doc.paper_name ?? "").trim();
    return {
      id: String(doc.$id),
      title: [code, name].filter(Boolean).join(" — ") || "Question paper",
    };
  } catch {
    return null;
  }
}

/** +1 download on the paper that owns this storage file (if any). */
export async function recordPaperDownloadByFileId(
  fileId: string,
  userId?: string | null,
): Promise<void> {
  try {
    const db = adminDatabases();
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
      Query.equal("file_id", fileId),
      Query.limit(1),
    ]);
    const doc = res.documents[0];
    if (!doc) return;
    await db.updateDocument(DATABASE_ID, COLLECTION.papers, String(doc.$id), {
      download_count: toCount(doc.download_count) + 1,
    });
    const code = String(doc.course_code ?? "").trim();
    const name = String(doc.paper_name ?? "").trim();
    await logUserActivity(userId, {
      action: "download",
      scope: "paper",
      title: [code, name].filter(Boolean).join(" — ") || "Question paper",
      href: `/paper/${doc.$id}`,
      paper_ref: String(doc.$id),
    });
  } catch {
    // Counting is best-effort.
  }
}

async function bumpSyllabusStat(
  paperCode: string,
  field: "view_count" | "download_count",
): Promise<void> {
  const db = adminDatabases();
  try {
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.syllabus_stats, paperCode);
    await db.updateDocument(DATABASE_ID, COLLECTION.syllabus_stats, paperCode, {
      [field]: toCount(doc[field]) + 1,
    });
  } catch {
    // No stats doc yet (or the read failed): create it starting at 1.
    try {
      await db.createDocument(
        DATABASE_ID,
        COLLECTION.syllabus_stats,
        ID.custom(paperCode),
        { paper_code: paperCode, view_count: field === "view_count" ? 1 : 0, download_count: field === "download_count" ? 1 : 0 },
      );
    } catch {
      // A concurrent first view may have created it already; best-effort.
    }
  }
}

/** +1 view on a syllabus paper + history row. */
export async function recordSyllabusView(
  paperCode: string,
  opts: { userId?: string | null; title: string; href: string },
): Promise<void> {
  await bumpSyllabusStat(paperCode, "view_count");
  await logUserActivity(opts.userId, {
    action: "view",
    scope: "syllabus",
    title: opts.title,
    href: opts.href,
    paper_ref: paperCode,
  });
}

/** +1 download on a syllabus paper + history row. */
export async function recordSyllabusDownload(
  paperCode: string,
  opts: { userId?: string | null; title: string; href: string },
): Promise<void> {
  await bumpSyllabusStat(paperCode, "download_count");
  await logUserActivity(opts.userId, {
    action: "download",
    scope: "syllabus",
    title: opts.title,
    href: opts.href,
    paper_ref: paperCode,
  });
}

/** Stats for one syllabus paper; zeros when never viewed/downloaded. */
export async function getSyllabusStat(
  paperCode: string,
): Promise<{ view_count: number; download_count: number }> {
  try {
    const db = adminDatabases();
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.syllabus_stats, paperCode);
    return {
      view_count: toCount(doc.view_count),
      download_count: toCount(doc.download_count),
    };
  } catch {
    return { view_count: 0, download_count: 0 };
  }
}

/** Stats for many syllabus papers at once, keyed by normalized code. */
export async function getSyllabusStats(
  paperCodes: string[],
): Promise<Map<string, { view_count: number; download_count: number }>> {
  const out = new Map<string, { view_count: number; download_count: number }>();
  const codes = [...new Set(paperCodes.filter(Boolean))];
  if (codes.length === 0) return out;
  try {
    const db = adminDatabases();
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_stats, [
      Query.equal("paper_code", codes),
      Query.limit(100),
    ]);
    for (const doc of res.documents) {
      const code = String(doc.paper_code ?? "");
      if (!code) continue;
      out.set(code, {
        view_count: toCount(doc.view_count),
        download_count: toCount(doc.download_count),
      });
    }
  } catch {
    // Stats are optional decoration; an empty map renders no counts.
  }
  return out;
}

/** Recent activity for one user, newest first, deduped by paper (latest wins). */
export async function getRecentUserActivity(
  userId: string,
  action: ActivityAction,
  limit = 10,
): Promise<ActivityEntry[]> {
  try {
    const db = adminDatabases();
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.user_activity, [
      Query.equal("user_id", userId),
      Query.equal("action", action),
      Query.orderDesc("$createdAt"),
      Query.limit(50),
    ]);
    const seen = new Set<string>();
    const out: ActivityEntry[] = [];
    for (const doc of res.documents) {
      const ref = String(doc.paper_ref ?? "");
      const key = `${doc.scope}:${ref}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        action: doc.action as ActivityAction,
        scope: doc.scope as ActivityScope,
        title: String(doc.title ?? ""),
        href: String(doc.href ?? ""),
        paper_ref: ref,
        createdAt: String(doc.$createdAt ?? ""),
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
