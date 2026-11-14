import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import {
  DISCORD_OAUTH_STATE_COOKIE,
  discordAvatarUrl,
  discordDisplayName,
  exchangeDiscordCode,
  fetchDiscordInServer,
  fetchDiscordUser,
} from "@/lib/discord-oauth";

const SITE = "https://examarchive.dev";

function redirectToProfile(status: string) {
  return NextResponse.redirect(new URL(`/profile?discord=${status}`, SITE));
}

/**
 * Discord OAuth2 callback. Discord redirects here with ?code=&state=.
 * Verifies the state token, exchanges the code, fetches the Discord user,
 * and stores the link on the logged-in user's profile document.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return redirectToProfile("error");
  }

  // CSRF check: state must match the cookie set when the flow started.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(DISCORD_OAUTH_STATE_COOKIE)?.value;
  const clearState = redirectToProfile("error");
  clearState.cookies.set(DISCORD_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth/discord/callback",
    maxAge: 0,
  });
  if (!expectedState || expectedState !== state) {
    return clearState;
  }

  const user = await getServerUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/profile", SITE));
  }

  let discordUser;
  let inServer = false;
  try {
    const token = await exchangeDiscordCode(code);
    discordUser = await fetchDiscordUser(token.access_token);
    inServer = await fetchDiscordInServer(token.access_token);
  } catch (err) {
    console.error("[discord-oauth] callback failed", err);
    return redirectToProfile("error");
  }

  const db = adminDatabases();

  // One Discord account may only be linked to one ExamArchive account.
  try {
    const existing = await db.listDocuments(DATABASE_ID, COLLECTION.users, [
      Query.equal("discord_id", discordUser.id),
      Query.limit(2),
    ]);
    const takenByOther = existing.documents.some((d) => d.$id !== user.id);
    if (takenByOther) {
      return redirectToProfile("already_linked");
    }
  } catch (err) {
    console.error("[discord-oauth] duplicate check failed", err);
    return redirectToProfile("error");
  }

  try {
    await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
      discord_id: discordUser.id,
      discord_username: discordDisplayName(discordUser),
      discord_avatar: discordAvatarUrl(discordUser),
      discord_in_server: inServer,
    });
  } catch (err) {
    console.error("[discord-oauth] profile update failed", err);
    return redirectToProfile("error");
  }

  return redirectToProfile(inServer ? "linked" : "linked_not_in_server");
}
