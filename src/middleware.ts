import { NextResponse, type NextRequest } from "next/server";

/** Name of the cookie that stores the Appwrite session secret. */
const SESSION_COOKIE = "ea_session";

/** Routes that require an authenticated session. */
const PROTECTED_PATHS = [
  // App routes
  "/upload",
  "/dashboard",
  "/admin",
  "/profile",
  "/settings",
  "/devtool",
  "/stats",
  "/ai-content",
  // API routes
  "/api/upload",
  "/api/admin",
  "/api/devtool",
  "/api/ai",
  "/api/generate-notes",
  "/api/generate-notes-stream",
  "/api/generate-solved-paper-stream",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const canonicalHost = "www.examarchive.dev";

  // Canonical host redirect for SEO consistency.
  if (
    host === "examarchive.dev" &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next/")
  ) {
    const url = request.nextUrl.clone();
    url.host = canonicalHost;
    url.protocol = "https:";
    return NextResponse.redirect(url, 301);
  }

  // Check if the user has an active session cookie.
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  // Redirect unauthenticated users away from protected routes.
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (isProtected && !session) {
    // API routes must return JSON — never redirect them to an HTML login page,
    // because clients calling these endpoints expect JSON responses and cannot
    // parse an HTML redirect body.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run middleware on everything except static files and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
