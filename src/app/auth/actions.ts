"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";

/**
 * Server Action – send a magic-link (OTP) to the provided email address.
 * On success the user is asked to check their inbox.
 * On failure the login page is reloaded with an error message.
 */
export async function signInWithOtp(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim();

  if (!email) {
    redirect("/login?error=email_required");
  }

  // NEXT_PUBLIC_SITE_URL must be set to the production / preview origin so that
  // Supabase can redirect back to the correct host after the user clicks the
  // magic-link email.  When absent we omit emailRedirectTo and Supabase falls
  // back to the redirect URL(s) configured in the Auth settings of the project
  // dashboard.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: siteUrl
      ? { emailRedirectTo: `${siteUrl}/auth/callback` }
      : undefined,
  });

  if (error) {
    // Map HTTP 429 (rate-limited) to a stable error code so the login page
    // can show a countdown timer rather than raw API text.
    const code =
      (error as { status?: number }).status === 429
        ? "rate_limit"
        : encodeURIComponent(error.message);
    redirect(`/login?error=${code}`);
  }

  redirect("/login?message=check_email");
}

/**
 * Server Action – sign in with email and password.
 * On success, redirects to the home page (session cookie set by Supabase SSR).
 * On failure, redirects back to the login page with an error code.
 */
export async function signInWithPassword(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim();
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    redirect("/login?mode=signin&error=fields_required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const status = (error as { status?: number }).status;
    const code =
      status === 429
        ? "rate_limit"
        : error.message.toLowerCase().includes("invalid login")
          ? "invalid_credentials"
          : encodeURIComponent(error.message);
    redirect(`/login?mode=signin&error=${code}`);
  }

  redirect("/");
}

/**
 * Server Action – create a new account with email and password.
 * If Supabase email confirmation is enabled the user receives a confirmation
 * email; the app redirects them to the "check email" success screen.
 * If the project has email confirmation disabled the session is set immediately
 * and the user is redirected to the home page.
 */
export async function signUp(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim();
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    redirect("/login?mode=signup&error=fields_required");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: siteUrl
      ? { emailRedirectTo: `${siteUrl}/auth/callback` }
      : undefined,
  });

  if (error) {
    const status = (error as { status?: number }).status;
    const code =
      status === 429
        ? "rate_limit"
        : error.message.toLowerCase().includes("already registered")
          ? "already_registered"
          : encodeURIComponent(error.message);
    redirect(`/login?mode=signup&error=${code}`);
  }

  // If the session is present, email confirmation is disabled and the user is
  // already signed in – send them straight to the home page.
  if (data.session) {
    redirect("/");
  }

  // Otherwise confirmation email was sent – show the "check email" screen.
  redirect("/login?message=check_email");
}

/**
 * Server Action – sign the current user out and redirect to the home page.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
