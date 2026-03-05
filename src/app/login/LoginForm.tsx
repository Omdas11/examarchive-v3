"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { signInWithOtp, signInWithPassword, signUp } from "@/app/auth/actions";

/** Available login modes. */
type Mode = "magic" | "signin" | "signup";

/** OTP rate-limit cooldown in seconds. */
const COOLDOWN_SECONDS = 60;

/**
 * Displays a countdown from `seconds` to 0.
 */
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
  // Sync mode if the user navigates back with a different mode param
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  // Track whether we're in the post-magic-link success state client-side too
  const [sent, setSent] = useState(message === "check_email");
  // Cooldown: true while the user must wait before resending
  const [cooling, setCooling] = useState(message === "check_email");

  // Sync sent state if the server-rendered message prop changes (e.g. navigation)
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

  const tabs: { id: Mode; label: string }[] = [
    { id: "magic", label: "Magic link" },
    { id: "signin", label: "Sign in" },
    { id: "signup", label: "Create account" },
  ];

  // Green success banner for magic link / signup confirmation email
  if (sent) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="rounded-lg p-4 text-center text-sm"
          style={{
            background: "#f0fdf4",
            color: "#166534",
            border: "1px solid #86efac",
          }}
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
          <button
            type="button"
            onClick={handleResend}
            className="btn w-full text-sm"
          >
            Resend link
          </button>
        )}

        {/* Always visible so users can sign in immediately without waiting for the cooldown */}
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
      {/* Mode tabs */}
      <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className="flex-1 py-2 text-xs font-medium transition-colors"
            style={
              mode === tab.id
                ? { background: "var(--color-primary)", color: "#ffffff" }
                : { background: "transparent", color: "var(--color-text-muted)" }
            }
          >
            {tab.label}
          </button>
        ))}
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
            <label
              htmlFor="email-magic"
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
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
        </form>
      )}

      {/* Sign in with password form */}
      {mode === "signin" && (
        <form action={signInWithPassword} className="space-y-4">
          <div>
            <label
              htmlFor="email-signin"
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
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
            <label
              htmlFor="password-signin"
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
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
        </form>
      )}

      {/* Create account form */}
      {mode === "signup" && (
        <form action={signUp} className="space-y-4">
          <div>
            <label
              htmlFor="email-signup"
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
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
            <label
              htmlFor="password-signup"
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
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
        </form>
      )}
    </div>
  );
}

