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
import { isValidCustomRole, isValidTier, isValidUserRole } from "./roles";
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
    if (!session) return null;

    const client = createSessionClient(session);
    const account = new Account(client);
    const user = await account.get();

    const db = adminDatabases();

    // First try to get the document by Auth user ID (the preferred approach)
    try {
      const profile = await db.getDocument(DATABASE_ID, COLLECTION.users, user.$id);
      const rawSecondary = profile.secondary_role ?? null;
      const rawTier = profile.tier ?? "bronze";
      return {
        id: profile.$id,
        email: (profile.email as string) ?? user.email,
        // DB field is `display_name`; TypeScript property is `name`
        name: (profile.display_name as string) ?? "",
        username: (profile.username as string) ?? "",
        avatar_url: (profile.avatar_url as string) ?? "",
        avatar_file_id: (profile.avatar_file_id as string) ?? undefined,
        role: (profile.role as UserRole) ?? "student",
        secondary_role: isValidCustomRole(rawSecondary) ? rawSecondary : null,
        tier: isValidTier(rawTier) ? rawTier : "bronze",
        xp: (profile.xp as number) ?? 0,
        // DB field is `streak`; TypeScript property is `streak_days`
        streak_days: (profile.streak as number) ?? 0,
        last_activity: (profile.last_activity as string) ?? "",
        created_at: profile.$createdAt,
      };
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
      const rawSecondary = profile.secondary_role ?? null;
      const rawTier = profile.tier ?? "bronze";
      // Return the actual document ID (which may differ from Auth user ID)
      return {
        id: profile.$id,
        email: (profile.email as string) ?? user.email,
        name: (profile.display_name as string) ?? "",
        username: (profile.username as string) ?? "",
        avatar_url: (profile.avatar_url as string) ?? "",
        avatar_file_id: (profile.avatar_file_id as string) ?? undefined,
        role: (profile.role as UserRole) ?? "student",
        secondary_role: isValidCustomRole(rawSecondary) ? rawSecondary : null,
        tier: isValidTier(rawTier) ? rawTier : "bronze",
        xp: (profile.xp as number) ?? 0,
        streak_days: (profile.streak as number) ?? 0,
        last_activity: (profile.last_activity as string) ?? "",
        created_at: profile.$createdAt,
      };
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
          streak: 0,
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
        xp: 0,
        streak_days: 0,
        last_activity: "",
        created_at: newProfile.$createdAt,
      };
    } catch (insertError) {
      console.error(
        "[auth] Failed to create profile for user",
        user.$id,
        insertError,
      );
      return null;
    }
  } catch {
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

    const rawPrimary = profile.primary_role ?? profile.role;
    const primaryRole: UserRole = isValidUserRole(rawPrimary)
      ? rawPrimary
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
        "achievements",
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
      primary_role: primaryRole,
      secondary_role: secondaryRole,
      tertiary_role: tertiaryRole,
      tier,
      xp: (profile.xp as number) ?? 0,
      streak_days: (profile.streak as number) ?? 0,
      last_activity: (profile.last_activity as string) ?? "",
      achievements,
      created_at: profile.$createdAt,
    };
  } catch {
    return null;
  }
}
