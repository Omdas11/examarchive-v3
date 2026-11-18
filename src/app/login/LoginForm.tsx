"use client";

import Link from "next/link";

/**
 * Google-only sign-in form (Cloudflare build, Phase 5).
 * The old magic-link / password forms called Appwrite actions, which do
 * not work on Workers — they are gone until email sign-in is rebuilt
 * after exams. Google is the only sign-in path right now.
 */
interface LoginFormProps {
  errorText: string | null;
  redirectUrl?: string | null;
}

export default function LoginForm({ errorText, redirectUrl }: LoginFormProps) {
  const googleHref = redirectUrl
    ? `/api/auth/google?redirect=${encodeURIComponent(redirectUrl)}`
    : "/api/auth/google";

  return (
    <div className="space-y-5">
      {/* Google OAuth button */}
      <Link
        href={googleHref}
        className="w-full flex items-center justify-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        style={{
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-text)",
        }}
      >
        {/* Google colour logo */}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
        </svg>
        Sign in with Google
      </Link>

      {/* Error banner — red, not emerald: a failed login must never look
          like a success notice. */}
      {errorText && (
        <div
          role="alert"
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
          }}
        >
          {errorText}
        </div>
      )}

      <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
        Email sign-in is coming back after exams — for now, sign in with
        Google. You can browse, search, and download papers without
        signing in.
      </p>
    </div>
  );
}
