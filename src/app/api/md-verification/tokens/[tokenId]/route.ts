import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import { isFounder } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/md-verification/tokens/[tokenId] — revoke an upload code
 * (founder only). Revoking sets revoked_at; the code stops working
 * immediately and can never be re-enabled. The hash row stays for audit.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const user = await getServerUser();
  if (!user || !isFounder(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tokenId } = await params;
  try {
    const db = await getD1();
    const res = await db
      .prepare(
        "UPDATE md_upload_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
      )
      .bind(Date.now(), tokenId)
      .run();
    if ((res.meta?.changes ?? 0) === 0) {
      return NextResponse.json(
        { error: "Code not found or already revoked" },
        { status: 404 },
      );
    }
    return NextResponse.json({ revoked: true });
  } catch {
    return NextResponse.json(
      { error: "Could not revoke the code" },
      { status: 500 },
    );
  }
}
