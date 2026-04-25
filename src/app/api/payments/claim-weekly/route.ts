import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION } from "@/lib/appwrite";
import { FREE_WEEKLY_CLAIM_ELECTRONS } from "@/lib/payments";
import { withElectronBalanceLock } from "@/lib/electron-lock";

/**
 * Returns the most recent Monday at midnight UTC.
 * This is used to determine the weekly reset boundary.
 */
function getLastMondayMidnightUTC(now = new Date()): Date {
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = (day + 6) % 7; // days since last Monday (0 on Monday)
  const lastMonday = new Date(now);
  lastMonday.setUTCDate(now.getUTCDate() - daysFromMonday);
  lastMonday.setUTCHours(0, 0, 0, 0);
  return lastMonday;
}

export async function POST() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return await withElectronBalanceLock(user.id, async () => {
      const db = adminDatabases();
      const profile = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);

      const lastWeeklyClaimRaw = profile.last_weekly_claim_at;
      const lastWeeklyClaim =
        typeof lastWeeklyClaimRaw === "string" && lastWeeklyClaimRaw
          ? lastWeeklyClaimRaw
          : null;

      const lastMondayMidnight = getLastMondayMidnightUTC();

      if (lastWeeklyClaim) {
        const lastClaimDate = new Date(lastWeeklyClaim);
        if (lastClaimDate >= lastMondayMidnight) {
          // Already claimed this week — tell the user when next reset is
          const nextMonday = new Date(lastMondayMidnight);
          nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
          return NextResponse.json(
            {
              error: `Already claimed this week. Resets on Monday ${nextMonday.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}.`,
            },
            { status: 400 },
          );
        }
      }

      const current = Number(profile.ai_credits ?? 0);
      if (!Number.isFinite(current)) {
        return NextResponse.json({ error: "Invalid electron balance." }, { status: 500 });
      }
      const newBalance = current + FREE_WEEKLY_CLAIM_ELECTRONS;

      await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
        ai_credits: newBalance,
        last_weekly_claim_at: new Date().toISOString(),
      });

      return NextResponse.json({
        message: `Claimed ${FREE_WEEKLY_CLAIM_ELECTRONS}e! New balance: ${newBalance}e.`,
        ai_credits: newBalance,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
