import { adminDatabases, COLLECTION, DATABASE_ID, Query } from "@/lib/appwrite";
import { generateReferralCode } from "./referral";

const MAX_COLLISION_RETRIES = 8;

export async function generateUniqueReferralCode(
  db: ReturnType<typeof adminDatabases>,
): Promise<string> {
  for (let i = 0; i < MAX_COLLISION_RETRIES; i += 1) {
    const candidate = generateReferralCode();
    try {
      const existing = await db.listDocuments(DATABASE_ID, COLLECTION.users, [
        Query.equal("referral_code", candidate),
        Query.limit(1),
      ]);
      if (existing.total === 0) return candidate;
    } catch {
      // If the referral_code attribute/index is not provisioned yet, fallback to
      // generated code to avoid blocking profile creation.
      return candidate;
    }
  }
  throw new Error("Unable to generate a unique referral code");
}
