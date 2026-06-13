import { cookies } from "next/headers";
import {
  createSessionClient,
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Account,
  Query,
  Permission,
  Role,
} from "./appwrite";
import {
  isValidCustomRole,
  isValidTier,
  isValidUserRole,
  normalizeRole,
  ROLE_XO_THRESHOLDS,
} from "./roles";
import { DEFAULT_CREDITS } from "./economy";
import type {
  Achievement,
  CustomRole,
  ExtendedUserProfile,
  UserProfile,
  UserRole,
  UserTier,
} from "@/types";

/** Name of the cookie that stores the Appwrite session secret. */
export const SESSION_COOKIE = "ea_session";

/**
 * Update the user's daily streak and last_activity timestamp.
 * Called silently on each authenticated page load. Only writes to the DB
 * when the date has actually changed since the last recorded activity.
 *
 * Streak rules:
 *  - same day as last_activity → no-op (avoid duplicate writes)
 *  - last_activity was yesterday → streak++
 *  - last_activity was 2+ days ago → streak resets to 1
 *  - no previous last_activity → streak = 1
 */
async function updateDailyStreak(
  db: ReturnType<typeof adminDatabases>,
  profileId: string,
  currentStreak: number,
  lastActivity: string,
): Promise<void> {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const lastDate = lastActivity ? lastActivity.slice(0, 10) : "";

    // No-op when already recorded an activity today
    if (lastDate === todayStr) return;

    let newStreak = 1;
    if (lastDate) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      newStreak = lastDate === yesterdayStr ? currentStreak + 1 : 1;
    }

    await db.updateDocument(DATABASE_ID, COLLECTION.users, profileId, {
      streak_days: newStreak,
      last_activity: now.toISOString(),
    });
  } catch {
    // Silently ignore – streak update is non-critical
  }
}

/**
 * Evaluate XO/role auto-assignment on each login/page load.
 * Runs silently — any failure is ignored so it never blocks page rendering.
 *
 * Role thresholds (ROLE_XO_RULEBOOK.md):
 *  - student → contributor: xo>=30, approved uploads>=2, account age>=3 days
 *  - contributor → specialist: xo>=150, approved uploads>=10, no active abuse flag
 */
async function evaluateXpAndPromotion(
  db: ReturnType<typeof adminDatabases>,
  profile: Record<string, unknown>,
): Promise<void> {
  try {
    const uploadCount = (profile.upload_count as number) ?? 0;
    const currentRole = normalizeRole((profile.role as string) ?? "student");
    const currentTier = (profile.tier as string) ?? "bronze";
    const currentXp = (profile.xp as number) ?? 0;
    const createdAt = typeof profile.$createdAt === "string" ? profile.$createdAt : "";
    const accountAgeDays = createdAt
      ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
      : 0;
    const hasActiveAbuseFlag = Boolean(profile.abuse_flag);
    const update: Record<string, unknown> = {};

    if (
      currentRole === "student" &&
      currentXp >= ROLE_XO_THRESHOLDS.contributor &&
      uploadCount >= 2 &&
      accountAgeDays >= 3
    ) {
      update.role = "contributor";
    }

    if (
      currentRole === "contributor" &&
      currentXp >= ROLE_XO_THRESHOLDS.specialist &&
      uploadCount >= 10 &&
      !hasActiveAbuseFlag
    ) {
      update.role = "specialist";
    }

    // Keep existing tier progression.
    if (uploadCount >= 20 && currentTier === "bronze") {
      update.tier = "silver";
    }

    if (Object.keys(update).length > 0) {
      await db.updateDocument(DATABASE_ID, COLLECTION.users, profile.$id as string, update);
    }
  } catch {
    // Silently ignore – promotion evaluation is non-critical
  }
}
/**
 * Map a raw Appwrite profile document to a `UserProfile` object.
 * Centralised to avoid duplicating the mapping logic across
 * getServerUser's multiple code-paths.
 */
function profileToUserProfile(
  profile: Record<string, unknown>,
  fallbackEmail: string,
): UserProfile {
  const rawSecondary = (profile.secondary_role as string) ?? null;
  const rawTier = (profile.tier as string) ?? "bronze";
  return {
    id: profile.$id as string,
    email: (profile.email as string) ?? fallbackEmail,
    name: (profile.display_name as string) ?? "",
    username: (profile.username as string) ?? "",
    avatar_url: (profile.avatar_url as string) ?? "",
    avatar_file_id: (profile.avatar_file_id as string) ?? undefined,
    role: normalizeRole((profile.role as string) ?? "student"),
    secondary_role: isValidCustomRole(rawSecondary) ? rawSecondary : null,
    tier: isValidTier(rawTier) ? rawTier : "bronze",
    xp: (profile.xp as number) ?? 0,
    specialist_subject: (profile.specialist_subject as string) ?? null,
    subject_admin_subject: (profile.subject_admin_subject as string) ?? null,
    ai_credits: (profile.ai_credits as number) ?? 0,
    streak_days: (profile.streak_days as number) ?? 0,
    last_activity: (profile.last_activity as string) ?? "",
    created_at: profile.$createdAt as string,
  };
}


/**
 * Read the Appwrite session secret from the request cookies.
 * Returns `null` when no session cookie is present.
 */
export async function getSessionSecret(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Lightweight helper that returns the authenticated Appwrite `User` object or
 * `null` when unauthenticated.
 */
export async function getUser() {
  try {
    const session = await getSessionSecret();
    if (!session) return null;

    const client = createSessionClient(session);
    const account = new Account(client);
    return await account.get();
  } catch {
    return null;
  }
}

/**
 * Return the currently authenticated user's profile (including role) or `null`
 * if the request is unauthenticated.
 */
export async function getServerUser(): Promise<UserProfile | null> {
  try {
    const session = await getSessionSecret();
    if (!session) {
      console.error("[auth] getServerUser: No session cookie found");
      return null;
    }

    const client = createSessionClient(session);
    const account = new Account(client);
    let user;
    try {
      user = await account.get();
    } catch (err) {
      console.error("[auth] getServerUser: account.get() failed", err);
      return null;
    }

    const db = adminDatabases();

    // First try to get the document by Auth user ID (the preferred approach)
    try {
      const profile = await db.getDocument(DATABASE_ID, COLLECTION.users, user.$id);
      const profileRec = profile as unknown as Record<string, unknown>;
      // Fire-and-forget: update streak & evaluate promotion
      void updateDailyStreak(db, profile.$id, (profile.streak_days as number) ?? 0, (profile.last_activity as string) ?? "");
      void evaluateXpAndPromotion(db, profileRec);
      return profileToUserProfile(profileRec, user.email);
    } catch {
      // Document with Auth user ID doesn't exist, try fallback lookup by email
    }

    // Fallback: Try to find existing profile document by email (legacy documents)
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.users,
      [Query.equal("email", user.email), Query.limit(1)],
    );

    if (documents.length > 0) {
      const profile = documents[0];
      const profileRec = profile as unknown as Record<string, unknown>;
      void updateDailyStreak(db, profile.$id, (profile.streak_days as number) ?? 0, (profile.last_activity as string) ?? "");
      void evaluateXpAndPromotion(db, profileRec);
      return profileToUserProfile(profileRec, user.email);
    }

    // Auto-create profile document on first login.
    // Only write fields that exist in the current DB schema.
    try {
      const newProfile = await db.createDocument(
        DATABASE_ID,
        COLLECTION.users,
        user.$id,
        {
          email: user.email,
          role: "student",
          display_name: "",
          username: "",
          xp: 0,
          streak_days: 0,
          upload_count: 0,
          secondary_role: null,
          tertiary_role: null,
          tier: "bronze",
          avatar_url: "",
          last_activity: "",
          ai_credits: DEFAULT_CREDITS,
        },
        [
          Permission.read(Role.user(user.$id)),
          Permission.update(Role.user(user.$id)),
        ],
      );

      return {
        id: newProfile.$id,
        email: (newProfile.email as string) ?? user.email,
        name: "",
        username: "",
        avatar_url: "",
        avatar_file_id: undefined,
        role: "student" as UserRole,
        secondary_role: null,
        tier: "bronze" as UserTier,
        xp: 0,
        specialist_subject: null,
        subject_admin_subject: null,
        ai_credits: DEFAULT_CREDITS,
        streak_days: 0,
        last_activity: "",
        created_at: newProfile.$createdAt,
      };
    } catch (insertError) {
      // A concurrent request may have already created the document (primary-key
      // conflict). Attempt to read it back before giving up.
      try {
        const existing = await db.getDocument(DATABASE_ID, COLLECTION.users, user.$id);
        return profileToUserProfile(existing as unknown as Record<string, unknown>, user.email);
      } catch (fetchError) {
        console.error("[auth] Failed to create profile for user", user.$id, insertError);
        console.error("[auth] Retry fetch after conflict also failed:", fetchError);
        return null;
      }
    }
  } catch (outerErr) {
    console.error("[auth] getServerUser: Unhandled error", outerErr);
    return null;
  }
}

/**
 * Return the extended user profile including v2-style role columns,
 * tier, and achievements.
 */
export async function getExtendedServerUser(): Promise<ExtendedUserProfile | null> {
  try {
    const session = await getSessionSecret();
    if (!session) return null;

    const client = createSessionClient(session);
    const account = new Account(client);
    const user = await account.get();

    const db = adminDatabases();

    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.users,
      [Query.equal("email", user.email), Query.limit(1)],
    );

    if (documents.length === 0) return null;
    const profile = documents[0];

    const rawPrimary = profile.role;
    const primaryRole: UserRole = isValidUserRole(rawPrimary)
      ? normalizeRole(rawPrimary)
      : "student";

    const rawSecondary = profile.secondary_role ?? null;
    const secondaryRole: CustomRole = isValidCustomRole(rawSecondary)
      ? rawSecondary
      : null;

    const rawTertiary = profile.tertiary_role ?? null;
    const tertiaryRole: CustomRole = isValidCustomRole(rawTertiary)
      ? rawTertiary
      : null;

    const rawTier = profile.tier ?? "bronze";
    const tier: UserTier = isValidTier(rawTier) ? rawTier : "bronze";

    // Fetch achievements (collection may not exist yet)
    let achievements: Achievement[] = [];
    try {
      const { documents: achDocs } = await db.listDocuments(
        DATABASE_ID,
        COLLECTION.achievements,
        [Query.equal("user_id", user.$id)],
      );
      achievements = achDocs as unknown as Achievement[];
    } catch {
      // collection may not exist yet
    }

    return {
      id: profile.$id,
      email: (profile.email as string) ?? user.email,
      name: (profile.display_name as string) ?? "",
      username: (profile.username as string) ?? "",
      avatar_url: (profile.avatar_url as string) ?? "",
      role: primaryRole,
      secondary_role: secondaryRole,
      tertiary_role: tertiaryRole,
      tier,
      xp: (profile.xp as number) ?? 0,
      streak_days: (profile.streak_days as number) ?? 0,
      last_activity: (profile.last_activity as string) ?? "",
      achievements,
      created_at: profile.$createdAt,
    };
  } catch {
    return null;
  }
}
