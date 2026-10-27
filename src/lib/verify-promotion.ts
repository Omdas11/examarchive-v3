import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import { normalizeRole, ROLE_XO_THRESHOLDS } from "@/lib/roles";

/**
 * Verification-based role promotion (replaces upload-based promotion).
 *
 * student → contributor: 10+ verifications, 100+ XP, account 3+ days old.
 * contributor → specialist: 50+ verifications, 800+ XP, no abuse flag.
 * Moderator/founder are manual-only. Best-effort: never throws.
 */
export async function evaluateVerificationPromotion(
  userId: string,
): Promise<string | null> {
  try {
    const db = adminDatabases();
    const profile = (await db.getDocument(
      DATABASE_ID,
      COLLECTION.users,
      userId,
    )) as Record<string, unknown>;
    const currentRole = normalizeRole((profile.role as string) ?? "student");
    const currentXp = Number(profile.xp ?? 0);
    const createdAt = typeof profile.$createdAt === "string" ? profile.$createdAt : "";
    const accountAgeDays = createdAt
      ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
      : 0;
    const hasActiveAbuseFlag = Boolean(profile.abuse_flag);

    const { total } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.content_verifications,
      [Query.equal("user_id", userId), Query.limit(1)],
    );
    const verificationCount = Number(total ?? 0);

    let nextRole: string | null = null;
    if (
      currentRole === "student" &&
      verificationCount >= 10 &&
      currentXp >= ROLE_XO_THRESHOLDS.contributor &&
      accountAgeDays >= 3
    ) {
      nextRole = "contributor";
    } else if (
      currentRole === "contributor" &&
      verificationCount >= 50 &&
      currentXp >= ROLE_XO_THRESHOLDS.specialist &&
      !hasActiveAbuseFlag
    ) {
      nextRole = "specialist";
    }

    if (nextRole) {
      await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, {
        role: nextRole,
      });
      return nextRole;
    }
    return null;
  } catch {
    return null;
  }
}
