import type { Metadata } from "next";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to ExamArchive to upload papers and access your profile.",
  robots: { index: false, follow: false },
};

type Mode = "magic" | "signin" | "signup";

interface Props {
  searchParams: Promise<{ error?: string; message?: string; mode?: string; ref?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  email_required: "Please enter your email address.",
  fields_required: "Please enter your email and password.",
  auth_callback_error: "The sign-in link has expired or is invalid. Please try again.",
  auth_callback_expired: "Your sign-in link has expired. Please request a new one.",
  rate_limit: "Too many attempts. Please wait before trying again.",
  invalid_credentials: "Invalid email or password. Please try again.",
  oauth_failed: "Google sign-in failed. Please try again.",
  invalid_referral_code: "Referral code is invalid. Please check and try again.",
};

const VALID_MODES: Mode[] = ["magic", "signin", "signup"];

export default async function LoginPage({ searchParams }: Props) {
  const { error, message, mode, ref } = await searchParams;

  const errorText = error
    ? (ERROR_MESSAGES[error] ?? decodeURIComponent(error))
    : null;
  const isRateLimit = error === "rate_limit";
  const initialMode: Mode = VALID_MODES.includes(mode as Mode)
    ? (mode as Mode)
    : (ref ? "signup" : "magic");

  return (
    <MainLayout
      title="Sign In"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Sign In" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole="visitor"
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
            isRateLimit={isRateLimit}
            message={message ?? null}
            initialMode={initialMode}
            initialReferralCode={ref ?? null}
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
