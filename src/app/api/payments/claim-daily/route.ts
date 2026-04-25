import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import { withElectronBalanceLock } from "@/lib/electron-lock";

/** Monthly reset interval for Supporter tier (30 days in ms). */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Electrons credited per monthly Supporter claim. */
const SUPPORTER_MONTHLY_ELECTRONS = 100;

export async function POST() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return await withElectronBalanceLock(user.id, async () => {
      const db = adminDatabases();

      // Find the user's active pass
      const { documents: passes } = await db.listDocuments(
        DATABASE_ID,
        COLLECTION.user_passes,
        [
          Query.equal("user_id", user.id),
          Query.equal("status", "active"),
          Query.limit(1),
        ],
      );

      if (passes.length === 0) {
        return NextResponse.json(
          { error: "No active pass found. Purchase a pass to claim daily electrons." },
          { status: 404 },
        );
      }

      const passDoc = passes[0];
      const passId = typeof passDoc.pass_id === "string" ? passDoc.pass_id : "";
      const isSupporter = passId === "supporter";
      const now = new Date();

      // Check pass expiry
      const expiresAt =
        typeof passDoc.expires_at === "string" ? new Date(passDoc.expires_at) : null;
      if (expiresAt && now >= expiresAt) {
        // Mark as expired and reject
        await db.updateDocument(DATABASE_ID, COLLECTION.user_passes, passDoc.$id as string, {
          status: "expired",
        });
        return NextResponse.json(
          { error: "Your pass has expired. Purchase a new pass to continue claiming." },
          { status: 403 },
        );
      }

      const lastClaimRaw =
        typeof passDoc.last_daily_claim_at === "string" ? passDoc.last_daily_claim_at : null;
      const lastClaimAt = lastClaimRaw ? new Date(lastClaimRaw) : null;

      if (isSupporter) {
        // Supporter: monthly claim of 100e (once per 30 days)
        if (lastClaimAt && now.getTime() - lastClaimAt.getTime() < THIRTY_DAYS_MS) {
          const nextClaim = new Date(lastClaimAt.getTime() + THIRTY_DAYS_MS);
          return NextResponse.json(
            {
              error: `Monthly claim already used. Next claim available on ${nextClaim.toDateString()}.`,
            },
            { status: 429 },
          );
        }

        const userDoc = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
        const currentCredits = Number(userDoc.ai_credits ?? 0);
        if (!Number.isFinite(currentCredits)) {
          throw new Error("Invalid user credits balance.");
        }
        const newCredits = currentCredits + SUPPORTER_MONTHLY_ELECTRONS;

        await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
          ai_credits: newCredits,
        });
        await db.updateDocument(DATABASE_ID, COLLECTION.user_passes, passDoc.$id as string, {
          last_daily_claim_at: now.toISOString(),
        });

        return NextResponse.json({
          ok: true,
          message: `Claimed ${SUPPORTER_MONTHLY_ELECTRONS}e! New balance: ${newCredits}e.`,
          ai_credits: newCredits,
        });
      }

      // Daily pass: check if already claimed today (UTC midnight boundary)
      const todayMidnightUtc = new Date(now);
      todayMidnightUtc.setUTCHours(0, 0, 0, 0);

      if (lastClaimAt && lastClaimAt >= todayMidnightUtc) {
        return NextResponse.json(
          { error: "Already claimed today. Come back tomorrow!" },
          { status: 429 },
        );
      }

      const daysRemaining = typeof passDoc.days_remaining === "number" ? passDoc.days_remaining : 0;
      if (daysRemaining <= 0) {
        await db.updateDocument(DATABASE_ID, COLLECTION.user_passes, passDoc.$id as string, {
          status: "expired",
        });
        return NextResponse.json(
          { error: "Your pass has no remaining days. Purchase a new pass." },
          { status: 403 },
        );
      }

      const dailyElectrons =
        typeof passDoc.daily_electrons === "number" ? passDoc.daily_electrons : 0;
      if (dailyElectrons <= 0) {
        return NextResponse.json(
          { error: "This pass does not grant daily electrons." },
          { status: 400 },
        );
      }

      const userDoc = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
      const currentCredits = Number(userDoc.ai_credits ?? 0);
      if (!Number.isFinite(currentCredits)) {
        throw new Error("Invalid user credits balance.");
      }
      const newCredits = currentCredits + dailyElectrons;
      const newDaysRemaining = daysRemaining - 1;

      await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
        ai_credits: newCredits,
      });
      await db.updateDocument(DATABASE_ID, COLLECTION.user_passes, passDoc.$id as string, {
        last_daily_claim_at: now.toISOString(),
        days_remaining: newDaysRemaining,
        ...(newDaysRemaining <= 0 ? { status: "expired" } : {}),
      });

      const doneMsg =
        newDaysRemaining <= 0
          ? ` Your pass is now fully used.`
          : ` ${newDaysRemaining} day${newDaysRemaining === 1 ? "" : "s"} remaining on your pass.`;

      return NextResponse.json({
        ok: true,
        message: `Claimed ${dailyElectrons}e! New balance: ${newCredits}e.${doneMsg}`,
        ai_credits: newCredits,
        days_remaining: newDaysRemaining,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
