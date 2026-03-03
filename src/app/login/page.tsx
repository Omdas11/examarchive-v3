import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to ExamArchive to upload papers and access your profile.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ error?: string; message?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  email_required: "Please enter your email address.",
  auth_callback_error: "The sign-in link has expired or is invalid. Please try again.",
  auth_callback_expired: "Your sign-in link has expired. Please request a new one.",
  rate_limit: "Too many sign-in attempts. Please wait before trying again.",
};

export default async function LoginPage({ searchParams }: Props) {
  const { error, message } = await searchParams;

  const errorText = error
    ? (ERROR_MESSAGES[error] ?? decodeURIComponent(error))
    : null;
  const isRateLimit = error === "rate_limit";

  return (
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
            <h1 className="mt-3 text-xl font-bold">Welcome back</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
              Enter your email to receive a sign-in link.
            </p>
          </div>

          {/* Success state */}
          {message === "check_email" ? (
            <div
              className="rounded-lg p-4 text-center text-sm"
              style={{
                background: "var(--color-accent-soft)",
                color: "var(--color-primary)",
                border: "1px solid var(--color-primary)",
              }}
            >
              <p className="font-semibold">Check your inbox!</p>
              <p className="mt-1" style={{ color: "var(--color-text-muted)" }}>
                We&apos;ve sent a magic link to your email. Click it to sign in.
              </p>
            </div>
          ) : (
            <LoginForm errorText={errorText} isRateLimit={isRateLimit} />
          )}
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
          No password needed — we&apos;ll email you a one-time sign-in link.
        </p>
      </div>
    </div>
  );
}
