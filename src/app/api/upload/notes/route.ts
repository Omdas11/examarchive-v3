import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  adminStorage,
  NOTES_BUCKET_ID,
  DATABASE_ID,
  COLLECTION,
  ID,
} from "@/lib/appwrite";
import { AppwriteException } from "node-appwrite";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function rollbackUploadedNote(fileId: string) {
  try {
    const storage = adminStorage();
    await storage.deleteFile(NOTES_BUCKET_ID, fileId);
  } catch (rollbackErr) {
    console.error("[api/upload/notes] Failed to roll back uploaded note file %s:", fileId, rollbackErr);
  }
}

/**
 * POST /api/upload/notes
 *
 * Accepts **JSON metadata only** — the file itself has already been uploaded
 * directly from the browser to Appwrite Storage (see NotesUploadForm.tsx).
 *
 * Required JSON body fields:
 * {
 *   fileId:    string — Appwrite file ID returned by the client-side upload
 *   title:     string — User-supplied title for the notes
 *   file_name: string — Original filename
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const file_name = typeof body.file_name === "string" ? body.file_name.trim() : "";

    if (!fileId || !title) {
      return NextResponse.json(
        { error: "Required fields missing: fileId, title." },
        { status: 400 },
      );
    }

    const db = adminDatabases();
    try {
      await db.createDocument(DATABASE_ID, COLLECTION.uploads, ID.unique(), {
        user_id: user.id,
        file_id: fileId,
        file_name: file_name || title,
        status: "pending",
        type: "notes",
        title,
      });
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message.trim() : String(err).trim();
      const message = rawMessage
        ? /[.!?]$/.test(rawMessage)
          ? rawMessage
          : `${rawMessage}.`
        : "Notes metadata could not be saved.";
      await rollbackUploadedNote(fileId);
      return NextResponse.json(
        {
          error: `${message} The uploaded file was removed from storage because the note record could not be created.`,
        },
        { status: 500 },
      );
    }

    console.log("[api/upload/notes] Note uploaded:", { fileId, title, userId: user.id });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AppwriteException) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[api/upload/notes] Unhandled error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
