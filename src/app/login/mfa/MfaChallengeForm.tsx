"use client";

import { useFormStatus } from "react-dom";
import {
  verifyMfaLoginAction,
  switchMfaLoginFactorAction,
  cancelMfaLoginAction,
} from "@/app/auth/mfa-actions";
import { IconShield } from "@/components/Icons";
import type { MfaFactor } from "@/lib/mfa";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full" aria-disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

interface MfaChallengeFormProps {
  factor: MfaFactor;
  errorText: string | null;
}

export default function MfaChallengeForm({ factor, errorText }: MfaChallengeFormProps) {
  const isTotp = factor === "totp";

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg px-4 py-3 text-sm" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <span style={{ color: "var(--color-primary)", marginTop: 2 }}>
          <IconShield size={18} />
        </span>
        <p style={{ color: "var(--color-text-muted)" }}>
          {isTotp
            ? "Open your authenticator app and enter the 6-digit code for ExamArchive."
            : "Enter one of your recovery codes. Each recovery code works once."}
        </p>
      </div>

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
        </div>
      )}

      <form action={verifyMfaLoginAction} className="space-y-4">
        <div>
          <label
            htmlFor="mfa-code"
            className="mb-1.5 block text-xs font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            {isTotp ? "6-digit code" : "Recovery code"}
          </label>
          <input
            id="mfa-code"
            name="code"
            type="text"
            autoComplete="one-time-code"
            inputMode={isTotp ? "numeric" : "text"}
            maxLength={isTotp ? 6 : undefined}
            required
            autoFocus
            placeholder={isTotp ? "123456" : "XXXXX-XXXXX"}
            className="input-field text-center text-lg tracking-[0.3em]"
          />
        </div>
        <SubmitButton label="Verify and sign in" pendingLabel="Verifying…" />
        <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
          You have 10 minutes to enter the code.
        </p>
      </form>

      <form action={switchMfaLoginFactorAction}>
        <input type="hidden" name="factor" value={isTotp ? "recoverycode" : "totp"} />
        <button
          type="submit"
          className="w-full text-center text-xs font-medium underline"
          style={{ color: "var(--color-primary)" }}
        >
          {isTotp ? "Use a recovery code instead" : "Use your authenticator app instead"}
        </button>
      </form>

      <form action={cancelMfaLoginAction}>
        <button
          type="submit"
          className="btn w-full text-sm"
        >
          Cancel and sign in differently
        </button>
      </form>
    </div>
  );
}
