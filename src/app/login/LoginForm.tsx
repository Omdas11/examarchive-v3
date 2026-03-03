"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { signInWithOtp } from "@/app/auth/actions";

/**
 * Submit button that disables itself while the server action is in-flight.
 * Must be rendered inside a <form> to use `useFormStatus`.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full" aria-disabled={pending}>
      {pending ? "Sending…" : "Send magic link"}
    </button>
  );
}

/** Supabase OTP rate-limit window in seconds (matches the default 60s policy). */
const DEFAULT_RATE_LIMIT_SECONDS = 60;

/**
 * Displays a countdown from `seconds` to 0, giving the user a visual cue
 * for how long they need to wait before the rate-limit window resets.
 */
function RateLimitCountdown({ seconds = DEFAULT_RATE_LIMIT_SECONDS }: { seconds?: number }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  return (
    <span className="font-medium">
      {remaining > 0 ? ` Try again in ${remaining}s.` : " You can try again now."}
    </span>
  );
}

interface LoginFormProps {
  errorText: string | null;
  isRateLimit: boolean;
}

/**
 * Client-rendered login form.  Lives inside the server-rendered LoginPage so
 * that the page can stay a Server Component while the form gets submit-state
 * feedback and rate-limit countdown behaviour.
 */
export default function LoginForm({ errorText, isRateLimit }: LoginFormProps) {
  return (
    <form action={signInWithOtp} className="space-y-4">
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
          {isRateLimit && <RateLimitCountdown />}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-xs font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="input-field"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
