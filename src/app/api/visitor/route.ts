import { NextRequest, NextResponse } from "next/server";
import { adminDatabases, DATABASE_ID, COLLECTION } from "@/lib/appwrite";
import { AppwriteException } from "node-appwrite";

const METRICS_DOC_ID = "singleton";
const VISITOR_COOKIE = "ea_vid";
// Cookie lifespan: 30 days
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
/** Fallback launch_progress value when the site_metrics collection has not been created yet. */
const DEFAULT_LAUNCH_PROGRESS = 40;

/** Read current visitor count (and other metrics) from site_metrics collection. */
export async function GET() {
  try {
    const db = adminDatabases();
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.site_metrics, METRICS_DOC_ID);
    return NextResponse.json({
      visitor_count: (doc.visitor_count as number) ?? 0,
      launch_progress: (doc.launch_progress as number) ?? DEFAULT_LAUNCH_PROGRESS,
    });
  } catch (err) {
    // Collection may not exist yet — return safe defaults
    if (err instanceof AppwriteException && err.code === 404) {
      return NextResponse.json({ visitor_count: 0, launch_progress: DEFAULT_LAUNCH_PROGRESS });
    }
    return NextResponse.json({ visitor_count: 0, launch_progress: DEFAULT_LAUNCH_PROGRESS });
  }
}

/**
 * POST — Increment visitor_count by 1 (once per browser via cookie).
 * Returns the updated count.
 */
export async function POST(req: NextRequest) {
  // If the visitor cookie is already set, they've been counted — return current value.
  const alreadyCounted = req.cookies.get(VISITOR_COOKIE);
  if (alreadyCounted) {
    // Still return current count for display
    return GET();
  }

  let newCount = 1;
  try {
    const db = adminDatabases();

    // Try to read the singleton document first
    let current = 0;
    try {
      const doc = await db.getDocument(DATABASE_ID, COLLECTION.site_metrics, METRICS_DOC_ID);
      current = (doc.visitor_count as number) ?? 0;
    } catch (inner) {
      if (inner instanceof AppwriteException && inner.code === 404) {
        // Document doesn't exist yet — we'll create it below
        current = 0;
      } else {
        throw inner;
      }
    }

    newCount = current + 1;

    try {
      await db.updateDocument(DATABASE_ID, COLLECTION.site_metrics, METRICS_DOC_ID, {
        visitor_count: newCount,
      });
    } catch (updateErr) {
      if (updateErr instanceof AppwriteException && updateErr.code === 404) {
        // Document doesn't exist — create it
        await db.createDocument(DATABASE_ID, COLLECTION.site_metrics, METRICS_DOC_ID, {
          visitor_count: newCount,
          launch_progress: DEFAULT_LAUNCH_PROGRESS,
        });
      } else {
        throw updateErr;
      }
    }
  } catch {
    // If the collection doesn't exist or any other error, skip silently
    newCount = 0;
  }

  const response = NextResponse.json({ visitor_count: newCount, launch_progress: DEFAULT_LAUNCH_PROGRESS });
  // Set the deduplication cookie
  response.cookies.set(VISITOR_COOKIE, "1", {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}

/**
 * DELETE — Reset visitor_count to 0. Admin-only server-to-server endpoint.
 *
 * Authentication uses the `x-admin-key` request header which must match
 * `APPWRITE_API_KEY`. This key is already a server-side secret used for all
 * Appwrite admin operations; reusing it here avoids introducing a separate
 * secret. The endpoint is not exposed to the public browser UI — it is called
 * only from the DevTool or admin scripts running on the server.
 */
export async function DELETE(req: NextRequest) {
  const apiKey = req.headers.get("x-admin-key");
  if (!apiKey || apiKey !== process.env.APPWRITE_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = adminDatabases();
    await db.updateDocument(DATABASE_ID, COLLECTION.site_metrics, METRICS_DOC_ID, {
      visitor_count: 0,
    });
    return NextResponse.json({ success: true, visitor_count: 0 });
  } catch (err) {
    if (err instanceof AppwriteException && err.code === 404) {
      return NextResponse.json({ success: true, visitor_count: 0 });
    }
    return NextResponse.json({ error: "Failed to reset visitor count" }, { status: 500 });
  }
}
