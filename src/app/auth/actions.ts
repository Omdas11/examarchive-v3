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
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

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
