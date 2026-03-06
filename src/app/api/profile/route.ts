import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";

const USERNAME_COOLDOWN_DAYS = 7;

/**
 * PATCH /api/profile
 * Update the authenticated user's display profile (display_name, username).
 * Username changes are rate-limited to once every 7 days.
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

  const allowedFields = ["name", "username"] as const;
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

  // Validate username
  if (update.username !== undefined && update.username !== "") {
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(update.username)) {
      return NextResponse.json(
        { error: "Username must be 1–30 alphanumeric characters (underscores allowed)" },
        { status: 400 },
      );
    }

    // Enforce 7-day cooldown on username changes
    try {
      const db = adminDatabases();
      const profile = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
      const lastChanged = profile.username_last_changed as string | null;
      if (lastChanged) {
        const daysSince = (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24);
        const currentUsername = (profile.username as string | null | undefined) ?? "";
        if (daysSince < USERNAME_COOLDOWN_DAYS && currentUsername !== update.username) {
          const daysLeft = Math.ceil(USERNAME_COOLDOWN_DAYS - daysSince);
          return NextResponse.json(
            { error: `Username can only be changed once every ${USERNAME_COOLDOWN_DAYS} days. Try again in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.` },
            { status: 429 },
          );
        }
      }
    } catch {
      // If document lookup fails, allow the change (graceful degradation)
    }

    // Validate username uniqueness
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
      console.warn("[api/profile] Username uniqueness check failed:", err);
    }
  }

  // Validate name length
  if (update.name !== undefined && update.name.length > 60) {
    return NextResponse.json(
      { error: "Name must be 60 characters or fewer" },
      { status: 400 },
    );
  }

  try {
    const db = adminDatabases();

    const dbUpdate: Record<string, string> = {};
    if (update.name !== undefined) dbUpdate.display_name = update.name;
    if (update.username !== undefined) {
      dbUpdate.username = update.username;
      dbUpdate.username_last_changed = new Date().toISOString();
    }

    const updated = await db.updateDocument(
      DATABASE_ID,
      COLLECTION.users,
      user.id,
      dbUpdate,
    );

    return NextResponse.json({
      id: updated.$id,
      name: (updated.display_name as string) ?? "",
      username: (updated.username as string) ?? "",
      username_last_changed: (updated.username_last_changed as string) ?? null,
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

  // Fetch username_last_changed from the DB
  let username_last_changed: string | null = null;
  try {
    const db = adminDatabases();
    const profile = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
    username_last_changed = (profile.username_last_changed as string) ?? null;
  } catch {
    // ignore
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
    username_last_changed,
  });
}
