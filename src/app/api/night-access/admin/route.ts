import { type NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import {
  NIGHT_ACCESS_COOKIE,
  nextSixAmIstMs,
  signNightAccess,
} from "@/lib/night-access";

export const dynamic = "force-dynamic";

/**
 * POST /api/night-access/admin
 *
 * Admin bypass for the nightly closure. The caller must be logged in as
 * a moderator or founder. On success it sets a signed `ea_night_access`
 * bypass cookie (valid until 6am) so the admin can use the site during
 * closed hours without an access code.
 */
export async function POST(_request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json(
      { error: "Only an admin can use this." },
      { status: 403 },
    );
  }

  const now = new Date();
  const cookieExp = nextSixAmIstMs(now);
  const token = await signNightAccess(cookieExp);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(NIGHT_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(cookieExp),
  });
  return res;
}
