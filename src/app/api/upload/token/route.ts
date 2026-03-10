import { NextResponse } from "next/server";
import { getSessionSecret } from "@/lib/auth";
import { createSessionClient, Account } from "@/lib/appwrite";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/upload/token
 *
 * Returns a short-lived Appwrite JWT for the authenticated user.
 * The client uses this token with `client.setJWT()` so it can upload a file
 * directly to Appwrite Storage without routing the binary payload through the
 * Next.js server (which would hit Vercel's body-size limit).
 *
 * The JWT is scoped to the requesting user's session and expires in 15 minutes.
 */
export async function GET() {
  try {
    const session = await getSessionSecret();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = createSessionClient(session);
    const account = new Account(client);
    const { jwt } = await account.createJWT();

    return NextResponse.json({ jwt });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create upload token";
    console.error("[api/upload/token] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
