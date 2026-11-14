/**
 * Discord OAuth2 account linking (server-side only).
 *
 * This is Discord's user-authorization flow, NOT the bot API: a logged-in
 * ExamArchive user clicks "Connect Discord", approves on discord.com, and
 * Discord redirects back with a one-time code. We exchange that code for
 * the user's Discord identity (id, username, avatar) and store it on their
 * ExamArchive profile. The bot token is never involved here.
 *
 * Setup (user steps, once):
 *   1. Discord Developer Portal -> examarchive app -> OAuth2 -> Redirects:
 *      add https://examarchive.dev/api/auth/discord/callback
 *   2. Same page -> copy the Client Secret -> Vercel env DISCORD_CLIENT_SECRET
 *   3. Vercel env DISCORD_CLIENT_ID = 1571172607707848774 (public app id)
 *
 * The redirect URI must match exactly what is registered in the Discord app,
 * or Discord refuses the authorize request.
 */

const DISCORD_API = "https://discord.com/api/v10";

/** Public Discord application id (same as the bot user id). */
export const DISCORD_CLIENT_ID =
  process.env.DISCORD_CLIENT_ID ?? "1571172607707848774";

/** ExamArchive Discord server id, used to check membership at link time. */
export const DISCORD_GUILD_ID = "1568295164173357086";

export const DISCORD_REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI ??
  "https://examarchive.dev/api/auth/discord/callback";

/** Scopes: identify the user, and list their servers (to confirm membership). */
const DISCORD_SCOPES = ["identify", "guilds"];

export function discordAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: DISCORD_SCOPES.join(" "),
    state,
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/** Exchange the one-time authorization code for an access token. */
export async function exchangeDiscordCode(
  code: string,
): Promise<DiscordTokenResponse> {
  const secret = process.env.DISCORD_CLIENT_SECRET;
  if (!secret) {
    throw new Error("DISCORD_CLIENT_SECRET is not configured");
  }
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: secret,
    grant_type: "authorization_code",
    code,
    redirect_uri: DISCORD_REDIRECT_URI,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as DiscordTokenResponse;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
}

/** Fetch the Discord user behind an OAuth2 access token. */
export async function fetchDiscordUser(
  accessToken: string,
): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Discord user fetch failed (${res.status})`);
  }
  return (await res.json()) as DiscordUser;
}

/** True when the Discord user is a member of the ExamArchive server. */
export async function fetchDiscordInServer(
  accessToken: string,
): Promise<boolean> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return false;
  const guilds = (await res.json()) as { id: string }[];
  return Array.isArray(guilds) && guilds.some((g) => g.id === DISCORD_GUILD_ID);
}

/** Public CDN URL for a Discord user's avatar (null when they have none). */
export function discordAvatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) return null;
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}`;
}

/** Display name: global display name when set, else username. */
export function discordDisplayName(user: DiscordUser): string {
  return user.global_name || user.username;
}
