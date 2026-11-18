import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import { getServerUser } from "@/lib/auth-cf";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to ExamArchive to upload papers and access your profile.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ error?: string; message?: string; mode?: string; ref?: string; redirect?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Google sign-in failed. Please try again.",
  oauth_state: "The sign-in request expired. Please try again.",
  oauth_config: "Google sign-in is not set up yet. Please try again later.",
  oauth_unverified:
    "Your Google email is not verified. Please verify it with Google and try again.",
  rate_limit: "Too many attempts. Please wait before trying again.",
};

export default async function LoginPage({ searchParams }: Props) {
  // Already signed in? Go home — there is nothing to do here.
  const user = await getServerUser();
  if (user) redirect("/");

  const { error, redirect: redirectParam } = await searchParams;

  const errorText = error
    ? (ERROR_MESSAGES[error] ?? decodeURIComponent(error))
    : null;

  return (
    <MainLayout
      title="Sign In"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Sign In" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole="student"
      isLoggedIn={false}
      userName=""
      userInitials=""
    >
    <div className="mx-auto flex min-h-[calc(100vh-14rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="card p-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-base font-black text-white"
              style={{ background: "var(--color-primary)" }}
            >
              EA
            </span>
            <h1 className="mt-3 text-xl font-bold">Welcome to ExamArchive</h1>
          </div>

          <LoginForm
            errorText={errorText}
            redirectUrl={redirectParam ?? null}
          />
        </div>

        {/* Legal links */}
        <p className="mt-4 text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
          By signing in, you agree to our{" "}
          <Link href="/terms" className="underline hover:opacity-80 transition-opacity" style={{ color: "var(--color-primary)" }}>
            Terms &amp; Conditions
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:opacity-80 transition-opacity" style={{ color: "var(--color-primary)" }}>
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
    </MainLayout>
  );
}
