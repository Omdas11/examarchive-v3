import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION } from "@/lib/appwrite";
import { FREE_WEEKLY_CLAIM_ELECTRONS } from "@/lib/payments";
import { withElectronBalanceLock } from "@/lib/electron-lock";

/** Weekly claim resets after 7 days (in milliseconds). */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return await withElectronBalanceLock(user.id, async () => {
      const db = adminDatabases();
      const userDoc = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);

      const now = new Date();
      const lastClaimRaw =
        typeof userDoc.last_weekly_claim_at === "string" ? userDoc.last_weekly_claim_at : null;

      if (lastClaimRaw) {
        const lastClaimMs = new Date(lastClaimRaw).getTime();
        const nextResetMs = lastClaimMs + SEVEN_DAYS_MS;
        if (now.getTime() < nextResetMs) {
          const nextReset = new Date(nextResetMs);
          return NextResponse.json(
            {
              error: `You've already claimed this week. Next claim available on ${nextReset.toDateString()}.`,
            },
            { status: 429 },
          );
        }
      }

      const currentCredits = Number(userDoc.ai_credits ?? 0);
      if (!Number.isFinite(currentCredits)) {
        throw new Error("Invalid user credits balance.");
      }
      const newCredits = currentCredits + FREE_WEEKLY_CLAIM_ELECTRONS;

      await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
        ai_credits: newCredits,
        last_weekly_claim_at: now.toISOString(),
      });

      return NextResponse.json({
        ok: true,
        message: `Claimed ${FREE_WEEKLY_CLAIM_ELECTRONS}e successfully! New balance: ${newCredits}e.`,
        ai_credits: newCredits,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
