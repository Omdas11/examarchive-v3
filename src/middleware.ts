import { NextResponse, type NextRequest } from "next/server";
import { syllabusDeptSlugForPaperCode } from "@/lib/syllabus-departments";

/** Name of the cookie that stores the Appwrite session secret. */
const SESSION_COOKIE = "ea_session";

/**
 * Temporary closure until the next Appwrite billing cycle, when the free-plan
 * reads reset (billing cycle Nov 5 - Dec 5, 2026). The site reopens on
 * Dec 5, 2026 (00:00 IST). This replaced the earlier nightly 10pm-6am
 * closure (2026-11-12) — the site now stays closed continuously until
 * the limit resets.
 */
const REOPEN_AT_IST_MS = Date.UTC(2026, 11, 4, 18, 30, 0); // Dec 5, 2026 00:00 IST

/** True while the site is temporarily closed (before the reopen date). */
function isTemporarilyClosed(now: Date): boolean {
  return now.getTime() < REOPEN_AT_IST_MS;
}

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
  // NOTE: /paper/[id] detail pages are intentionally public (SEO + sharing).
  // The PDF itself stays gated: /api/files/papers requires a session, a
  // signed token, or a CAPTCHA-issued token (see /api/captcha-download).
  "/ai-content",
  // NOTE: /store is intentionally NOT protected here — while the store is
  // "Coming Soon" anyone can see it. When the store reopens, the page
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

  // Temporary closure until the next billing cycle (Dec 5, 2026), when the
  // free Appwrite plan reads reset. Page visits go to /closed; API calls
  // get a 503 JSON. /closed itself, the AI webhook and the public AI-status
  // endpoint stay reachable.
  if (isTemporarilyClosed(new Date())) {
    if (pathname === "/closed") return NextResponse.next();
    if (
      pathname.startsWith("/api/ai/notify-completion") ||
      pathname === "/api/ai/status"
    ) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error:
            "ExamArchive is temporarily closed until Dec 5, 2026. Please visit after then.",
        },
        { status: 503 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/closed";
    return NextResponse.redirect(url, 307);
  }

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
