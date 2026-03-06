import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";

/**
 * PATCH /api/profile
 * Update the authenticated user's display profile (name, username, avatar_url).
 * Role and tier changes are NOT permitted here — use /api/admin/users for that.
 */
export async function PATCH(request: NextRequest) {
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

  // Only allow editing safe display fields
  const allowedFields = ["name", "username", "avatar_url"] as const;
  type AllowedField = (typeof allowedFields)[number];

  const update: Partial<Record<AllowedField, string>> = {};

  for (const field of allowedFields) {
    if (field in body) {
      const value = body[field];
      if (typeof value !== "string") {
        return NextResponse.json(
          { error: `Field '${field}' must be a string` },
          { status: 400 },
        );
      }
      update[field] = value.trim();
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  // Validate username: alphanumeric + underscores, 1–30 chars, or empty string to clear
  if (update.username !== undefined && update.username !== "") {
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(update.username)) {
      return NextResponse.json(
        { error: "Username must be 1–30 alphanumeric characters (underscores allowed)" },
        { status: 400 },
      );
    }

    // Validate username uniqueness (exclude current user's own document)
    try {
      const db = adminDatabases();
      const { documents } = await db.listDocuments(
        DATABASE_ID,
        COLLECTION.users,
        [Query.equal("username", update.username), Query.limit(2)],
      );
      const takenByOther = documents.some((doc) => doc.$id !== user.id);
      if (takenByOther) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 },
        );
      }
    } catch (err) {
      // If uniqueness check fails (e.g. missing index), log and continue rather than block
      console.warn("[api/profile] Username uniqueness check failed:", err);
    }
  }

  // Validate name: max 60 chars
  if (update.name !== undefined && update.name.length > 60) {
    return NextResponse.json(
      { error: "Name must be 60 characters or fewer" },
      { status: 400 },
    );
  }

  // Validate avatar_url: must be a URL or empty string
  if (update.avatar_url !== undefined && update.avatar_url !== "") {
    try {
      new URL(update.avatar_url);
    } catch {
      return NextResponse.json(
        { error: "avatar_url must be a valid URL or empty" },
        { status: 400 },
      );
    }
  }

  try {
    console.log("[api/profile] Updating profile for user:", user.id, "with:", update);
    const db = adminDatabases();
    const updated = await db.updateDocument(
      DATABASE_ID,
      COLLECTION.users,
      user.id,
      update,
    );
    console.log("[api/profile] Profile updated successfully");

    return NextResponse.json({
      id: updated.$id,
      name: updated.name ?? "",
      username: updated.username ?? "",
      avatar_url: updated.avatar_url ?? "",
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[api/profile] Failed to update profile:", errorMessage, err);
    return NextResponse.json(
      { error: "Failed to update profile", details: errorMessage },
      { status: 500 },
    );
  }
}

/**
 * GET /api/profile
 * Return the current user's display profile.
 */
export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    avatar_url: user.avatar_url,
    xp: user.xp,
    streak_days: user.streak_days,
    last_activity: user.last_activity,
  });
}
