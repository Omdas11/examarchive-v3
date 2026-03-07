"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAdminClient,
  createSessionClient,
  Account,
  ID,
} from "@/lib/appwrite";
import { OAuthProvider } from "node-appwrite";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * Server Action – initiate Google OAuth sign-in via Appwrite.
 * Redirects the user to the Google consent screen; on success Appwrite
 * calls /auth/callback with the session credentials.
 *
 * NOTE: redirect() must be called **outside** any try/catch block because
 * Next.js implements redirect() by throwing a special NEXT_REDIRECT error
 * internally. Catching that error and re-throwing it as a login error
 * caused the "/login?error=NEXT_REDIRECT" regression.
 */
export async function signInWithGoogle() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const successUrl = siteUrl ? `${siteUrl}/auth/callback` : "/auth/callback";
  const failureUrl = siteUrl ? `${siteUrl}/login?error=oauth_failed` : "/login?error=oauth_failed";

  let oauthUrl: string;
  try {
    const client = createAdminClient();
    const account = new Account(client);
    oauthUrl = await account.createOAuth2Token(
      OAuthProvider.Google,
      successUrl,
      failureUrl,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  // redirect() is intentionally outside the try/catch so the NEXT_REDIRECT
  // internal error is not swallowed and re-emitted as a login error.
  redirect(oauthUrl);
}

/**
 * Server Action – send a magic-link to the provided email address.
 * Uses Appwrite's `createMagicURLToken` which emails a link; the callback
 * route exchanges `userId` + `secret` for a session.
 */
export async function signInWithOtp(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim();

  if (!email) {
    redirect("/login?error=email_required");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  try {
    const client = createAdminClient();
    const account = new Account(client);
    await account.createMagicURLToken(
      ID.unique(),
      email,
      siteUrl ? `${siteUrl}/auth/callback` : undefined,
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    if (message.includes("Rate limit")) {
      redirect("/login?error=rate_limit");
    }
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  redirect("/login?message=check_email");
}

/**
 * Server Action – sign in with email and password.
 * Creates an Appwrite session and persists it as an httpOnly cookie.
 */
export async function signInWithPassword(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim();
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    redirect("/login?mode=signin&error=fields_required");
  }

  try {
    const client = createAdminClient();
    const account = new Account(client);
    const session = await account.createEmailPasswordSession(email, password);

    // Persist the session secret as an httpOnly cookie.
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, session.secret, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year – Appwrite manages actual expiry
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    if (message.includes("Rate limit")) {
      redirect("/login?mode=signin&error=rate_limit");
    }
    if (
      message.toLowerCase().includes("invalid credentials") ||
      message.toLowerCase().includes("invalid password") ||
      message.toLowerCase().includes("user not found")
    ) {
      redirect("/login?mode=signin&error=invalid_credentials");
    }
    redirect(`/login?mode=signin&error=${encodeURIComponent(message)}`);
  }

  redirect("/");
}

/**
 * Server Action – create a new account with email and password.
 * After creation, automatically signs the user in.
 */
export async function signUp(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim();
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    redirect("/login?mode=signup&error=fields_required");
  }

  try {
    const client = createAdminClient();
    const account = new Account(client);

    // Create the account
    await account.create(ID.unique(), email, password);

    // Immediately sign in
    const session = await account.createEmailPasswordSession(email, password);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, session.secret, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    // Prevent account enumeration – treat "already registered" the same as
    // a success message.
    if (
      message.toLowerCase().includes("already exists") ||
      message.toLowerCase().includes("already registered")
    ) {
      redirect("/login?message=check_email");
    }
    if (message.includes("Rate limit")) {
      redirect("/login?mode=signup&error=rate_limit");
    }
    redirect(`/login?mode=signup&error=${encodeURIComponent(message)}`);
  }

  redirect("/");
}

/**
 * Server Action – sign the current user out and redirect to the home page.
 */
export async function signOut() {
  const cookieStore = await cookies();
  try {
    const session = cookieStore.get(SESSION_COOKIE)?.value;

    if (session) {
      const client = createSessionClient(session);
      const account = new Account(client);
      await account.deleteSession("current");
    }
  } catch {
    // Session deletion may fail if already expired – continue to clear cookie
  } finally {
    cookieStore.delete(SESSION_COOKIE);
  }

  redirect("/");
}
