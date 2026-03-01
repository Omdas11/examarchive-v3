import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";

/**
 * POST /api/admin
 * Admin-only route handler for managing papers.
 * Accepts `action` and `id` via query params or form body.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let action = searchParams.get("action");
  let id = searchParams.get("id");

  // Also support form-encoded body (used by the admin page HTML form).
  if (!action || !id) {
    try {
      const formData = await request.formData();
      action = action ?? (formData.get("action") as string | null);
      id = id ?? (formData.get("id") as string | null);
    } catch {
      // body may not be form-encoded – ignore
    }
  }

  if (!action || !id) {
    return NextResponse.json({ error: "Missing action or id." }, { status: 400 });
  }

  const supabase = await createClient();

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
