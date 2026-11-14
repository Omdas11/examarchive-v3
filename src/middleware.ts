import { NextResponse, type NextRequest } from "next/server";
import { syllabusDeptSlugForPaperCode } from "@/lib/syllabus-departments";
import paperIdRedirects from "@/data/paper-id-redirects.json";

/** Name of the cookie that stores the Appwrite session secret. */
const SESSION_COOKIE = "ea_session";

/** Routes that require an authenticated session. */
const PROTECTED_PATHS = [
  // App routes
  "/dashboard",
  "/admin",
  "/profile",
  "/settings",
  "/devtool",
  "/stats",
  // NOTE: /paper/[id] detail pages are intentionally public (SEO + sharing).
  // The PDF itself stays gated: /api/files/papers requires a session or a
  // signed token. (The hCaptcha gate was removed 2026-11-14.)
  "/ai-content",
  // NOTE: /store is intentionally NOT protected here — while the store is
  // closed anyone can see it. When the store reopens, the page
  // itself redirects logged-out users to /login.
  // API routes
  "/api/upload",
  "/api/admin",
  "/api/devtool",
  "/api/ai",
  "/api/generate-notes",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Legacy syllabus paper URLs moved to /syllabus/paper/<department>/<CODE>.
  // Redirected HERE, not in the page: a redirect thrown from the page
  // renders after the shell streams, so Next.js downgrades it to a
  // client-side redirect (HTTP 200 + RSC payload) instead of a real 308.
  // Middleware runs before any rendering, so this is a true HTTP 308.
  const legacyPaper = pathname.match(/^\/syllabus\/paper\/([^/]+)$/);
  if (legacyPaper) {
    const code = decodeURIComponent(legacyPaper[1]).toUpperCase();
    const slug = syllabusDeptSlugForPaperCode(code);
    if (slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/syllabus/paper/${slug}/${code}`;
      return NextResponse.redirect(url, 308);
    }
    // Unknown code prefix: fall through; the page renders a 404.
  }

  // Paper visited under the wrong department: same treatment.
  const nestedPaper = pathname.match(/^\/syllabus\/paper\/([^/]+)\/([^/]+)$/);
  if (nestedPaper) {
    const dept = nestedPaper[1];
    const code = decodeURIComponent(nestedPaper[2]).toUpperCase();
    const slug = syllabusDeptSlugForPaperCode(code);
    if (slug && slug !== dept) {
      const url = request.nextUrl.clone();
      url.pathname = `/syllabus/paper/${slug}/${code}`;
      return NextResponse.redirect(url, 308);
    }
  }

  // Old-project paper IDs (pre-migration, 2026-11-13) redirect permanently
  // to the new IDs. The migration gave every paper a new document ID, so
  // old /paper/<id> links (bookmarks, Google index, shared links) would
  // 404 without this map. Same reason as above: done here, not in the
  // page, so it is a true HTTP 308 instead of a client-side redirect.
  const paperPage = pathname.match(/^\/paper\/([^/]+)$/);
  if (paperPage) {
    const newId = (paperIdRedirects as Record<string, string>)[paperPage[1]];
    if (newId) {
      const url = request.nextUrl.clone();
      url.pathname = `/paper/${newId}`;
      return NextResponse.redirect(url, 308);
    }
    // Unknown ID: fall through; the page renders a 404.
  }

  // Allow Appwrite webhook calls to proceed; route performs its own secret validation.
  if (pathname.startsWith("/api/ai/notify-completion")) {
    return NextResponse.next();
  }

  // The AI status endpoint is public: it only reports whether AI generation is
  // configured (a boolean) and reveals no secrets, so the "not configured"
  // notice can be shown without a session and its state is easy to verify.
  if (pathname === "/api/ai/status") {
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
