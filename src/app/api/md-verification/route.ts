import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import {
  MD_ITEM_LIST_COLUMNS,
  canAccessMdVerification,
  rowToMdItem,
  type MdVerificationRow,
} from "@/lib/md-verification-access";
import {
  MD_VERIFICATION_PAGE_SIZE,
  clampPage,
  isMdVerificationStatus,
  isMdVerificationType,
} from "@/lib/md-verification";

export const dynamic = "force-dynamic";

/**
 * GET /api/md-verification?status=&type=&mine=1&page=
 * Paginated queue list, 20 per page, newest first. The list never
 * selects md_text (only its LENGTH), so a queue page stays cheap.
 * Verifier+ only (moderator, founder, or assigned verifier).
 */
export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const status = params.get("status") ?? "";
  const type = params.get("type") ?? "";
  const mine = params.get("mine") === "1";
  const page = clampPage(params.get("page"));

  if (status && !isMdVerificationStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (type && !isMdVerificationType(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const where: string[] = [];
  const values: unknown[] = [];
  if (status) {
    where.push("status = ?");
    values.push(status);
  }
  if (type) {
    where.push("type = ?");
    values.push(type);
  }
  if (mine) {
    where.push("assigned_to = ?");
    values.push(user.id);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const db = await getD1();
    const limit = MD_VERIFICATION_PAGE_SIZE;
    const offset = (page - 1) * limit;
    const columns = MD_ITEM_LIST_COLUMNS.join(", ");
    const [listRes, countRes] = await Promise.all([
      db
        .prepare(
          `SELECT ${columns} FROM md_verification_items ${whereSql} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
        )
        .bind(...values, limit, offset)
        .all<MdVerificationRow>(),
      db
        .prepare(`SELECT COUNT(*) AS total FROM md_verification_items ${whereSql}`)
        .bind(...values)
        .first<{ total: number }>(),
    ]);
    return NextResponse.json({
      items: (listRes.results ?? []).map((row) => {
        const item = rowToMdItem(row);
        return { ...item, md_text: undefined };
      }),
      page,
      total: countRes?.total ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load the verification queue" },
      { status: 500 },
    );
  }
}
