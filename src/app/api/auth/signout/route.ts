import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CF_SESSION_COOKIE, deleteSessionByToken } from "@/lib/auth-cf";
import { isHttpsRequest } from "@/lib/google-oauth";

/**
 * POST /api/auth/signout
 * Deletes the D1 session row and clears the session cookie, then
 * redirects home. Also clears the legacy Appwrite session cookie, so a
 * user who still carries one from the old site is fully signed out.
 * Never fails the request: sign-out always lands back on the homepage.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const token = cookieStore.get(CF_SESSION_COOKIE)?.value;
  if (token) {
    await deleteSessionByToken(token);
  }

  const response = NextResponse.redirect(new URL("/", url.origin));
  const secure = isHttpsRequest(request);
  response.cookies.set(CF_SESSION_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  // Legacy Appwrite cookie (src/lib/auth.ts SESSION_COOKIE = "ea_session").
  response.cookies.set("ea_session", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
