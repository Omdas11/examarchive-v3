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
  "/paper",
  "/ai-content",
  "/store",
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

  // Allow Appwrite webhook calls to proceed; route performs its own secret validation.
  if (pathname.startsWith("/api/ai/notify-completion")) {
    return NextResponse.next();
  }

  // Allow Razorpay webhook calls to proceed; route performs its own HMAC validation.
  if (pathname.startsWith("/api/payments/razorpay/webhook")) {
    return NextResponse.next();
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
