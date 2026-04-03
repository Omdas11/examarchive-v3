import { Account, ID } from "node-appwrite";
import { createAdminClient } from "@/lib/appwrite";

export async function sendGenerationMagicLinkEmail(email: string, nextPath: string): Promise<void> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.OPENROUTER_APP_URL ||
    "https://www.examarchive.dev";

  const trimmedNextPath = nextPath.trim();
  const normalizedNextPath = trimmedNextPath.startsWith("/")
    ? trimmedNextPath
    : `/${trimmedNextPath.replace(/^\/+/, "")}`;

  const client = createAdminClient();
  const account = new Account(client);
  await account.createMagicURLToken(
    ID.unique(),
    email,
    `${siteUrl}/auth/callback?next=${encodeURIComponent(normalizedNextPath)}`,
  );
}
