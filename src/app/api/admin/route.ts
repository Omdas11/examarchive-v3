import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";

/**
 * POST /api/admin?action=approve&id=<paper_id>
 * Admin-only route handler for managing papers.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const id = searchParams.get("id");

  if (!action || !id) {
    return NextResponse.json({ error: "Missing action or id." }, { status: 400 });
  }

  const supabase = createClient();

  switch (action) {
    case "approve": {
      const { error } = await supabase
        .from("papers")
        .update({ approved: true })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }
    case "delete": {
      const { error } = await supabase.from("papers").delete().eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
