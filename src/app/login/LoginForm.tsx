"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { signInWithOtp, signInWithPassword, signUp, signInWithGoogle } from "@/app/auth/actions";

/** Available login modes. */
type Mode = "magic" | "signin" | "signup";

/** OTP rate-limit cooldown in seconds. */
const COOLDOWN_SECONDS = 60;

function Countdown({ from, onDone }: { from: number; onDone?: () => void }) {
  const [remaining, setRemaining] = useState(from);

  useEffect(() => {
    if (remaining <= 0) {
      onDone?.();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, onDone]);

  return (
    <span className="font-medium tabular-nums">
      {remaining > 0 ? ` Resend in ${remaining}s` : ""}
    </span>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full" aria-disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

interface LoginFormProps {
  errorText: string | null;
  isRateLimit: boolean;
  message: string | null;
  initialMode: Mode;
}

export default function LoginForm({ errorText, isRateLimit, message, initialMode }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  useEffect(() => { setMode(initialMode); }, [initialMode]);

  const [sent, setSent] = useState(message === "check_email");
  const [cooling, setCooling] = useState(message === "check_email");
  const [googlePending, setGooglePending] = useState(false);

  useEffect(() => {
    if (message === "check_email") {
      setSent(true);
      setCooling(true);
    }
  }, [message]);

  function handleResend() {
    setSent(false);
    setCooling(false);
  }

  // Green success banner for magic link sent
  if (sent) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="rounded-lg p-4 text-center text-sm"
          style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #86efac" }}
        >
          <p className="font-semibold">✓ Check your inbox!</p>
          <p className="mt-1 text-xs" style={{ color: "#15803d" }}>
            We&apos;ve sent a link to your email. Click it to sign in.
          </p>
          {cooling && (
            <p className="mt-2 text-xs" style={{ color: "#166534" }}>
              <Countdown from={COOLDOWN_SECONDS} onDone={() => setCooling(false)} />
            </p>
          )}
        </div>
        {!cooling && (
          <button type="button" onClick={handleResend} className="btn w-full text-sm">
            Resend link
          </button>
        )}
        <button
          type="button"
          onClick={() => { setSent(false); setCooling(false); setMode("signin"); }}
          className="btn w-full text-sm"
        >
          Sign in with password instead
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Google OAuth button */}
      <form
        action={async () => {
          setGooglePending(true);
          await signInWithGoogle();
        }}
      >
        <button
          type="submit"
          disabled={googlePending}
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
          {googlePending ? "Redirecting…" : "Sign in with Google"}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>or</span>
        <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
      </div>

      {/* Magic link / password mode toggle */}
      <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
        <button
          type="button"
          onClick={() => setMode("magic")}
          className="flex-1 py-2 text-xs font-medium transition-colors"
          style={
            mode === "magic"
              ? { background: "var(--color-primary)", color: "#ffffff" }
              : { background: "transparent", color: "var(--color-text-muted)" }
          }
        >
          Magic link
        </button>
        <button
          type="button"
          onClick={() => setMode("signin")}
          className="flex-1 py-2 text-xs font-medium transition-colors"
          style={
            mode === "signin"
              ? { background: "var(--color-primary)", color: "#ffffff" }
              : { background: "transparent", color: "var(--color-text-muted)" }
          }
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className="flex-1 py-2 text-xs font-medium transition-colors"
          style={
            mode === "signup"
              ? { background: "var(--color-primary)", color: "#ffffff" }
              : { background: "transparent", color: "var(--color-text-muted)" }
          }
        >
          Sign up
        </button>
      </div>

      {/* Error / rate-limit banner */}
      {errorText && (
        <div
          role="alert"
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: "var(--color-accent-soft)",
            color: "var(--color-primary)",
            border: "1px solid var(--color-primary)",
          }}
        >
          {errorText}
          {isRateLimit && (
            <span className="font-medium">
              <Countdown from={COOLDOWN_SECONDS} />
            </span>
          )}
        </div>
      )}

      {/* Magic link form */}
      {mode === "magic" && (
        <form action={signInWithOtp} className="space-y-4">
          <div>
            <label htmlFor="email-magic" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Email address
            </label>
            <input
              id="email-magic"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="input-field"
            />
          </div>
          <SubmitButton label="Send magic link" pendingLabel="Sending…" />
          <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
            We&apos;ll email you a one-time sign-in link — no password needed.
          </p>
          {/* Toggle hint */}
          <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
            Already have a password?{" "}
            <button type="button" onClick={() => setMode("signin")} className="font-medium underline" style={{ color: "var(--color-primary)" }}>
              Sign in
            </button>
          </p>
        </form>
      )}

      {/* Sign in with password form */}
      {mode === "signin" && (
        <form action={signInWithPassword} className="space-y-4">
          <div>
            <label htmlFor="email-signin" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Email address
            </label>
            <input
              id="email-signin"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="password-signin" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Password
            </label>
            <input
              id="password-signin"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="input-field"
            />
          </div>
          <SubmitButton label="Sign in" pendingLabel="Signing in…" />
          {/* Toggle hint */}
          <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
            New user?{" "}
            <button type="button" onClick={() => setMode("signup")} className="font-medium underline" style={{ color: "var(--color-primary)" }}>
              Create account
            </button>
          </p>
        </form>
      )}

      {/* Create account form */}
      {mode === "signup" && (
        <form action={signUp} className="space-y-4">
          <div>
            <label htmlFor="email-signup" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Email address
            </label>
            <input
              id="email-signup"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="password-signup" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Password
            </label>
            <input
              id="password-signup"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="input-field"
            />
          </div>
          <SubmitButton label="Create account" pendingLabel="Creating account…" />
          {/* Toggle hint */}
          <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
            Existing user?{" "}
            <button type="button" onClick={() => setMode("signin")} className="font-medium underline" style={{ color: "var(--color-primary)" }}>
              Log in
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
