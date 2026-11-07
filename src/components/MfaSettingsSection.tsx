"use client";

import { useEffect, useState } from "react";
import {
  disableMfaAction,
  enableMfaAction,
  generateMfaRecoveryCodesAction,
  getMfaStatusAction,
  startMfaEnrollmentAction,
  verifyMfaEnrollmentAction,
} from "@/app/auth/mfa-actions";
import { IconLock, IconShield } from "@/components/Icons";

type Stage =
  | "loading"
  | "disabled"
  | "enrolling"
  | "codes"
  | "enabled"
  | "disabling";

export default function MfaSettingsSection() {
  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [codesSaved, setCodesSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getMfaStatusAction();
      if (cancelled) return;
      if (!res.ok) {
        setError(
          res.error === "not_signed_in"
            ? "Please sign in again to manage two-factor authentication."
            : res.error,
        );
        return;
      }
      setStage(res.enabled ? "enabled" : "disabled");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function fail(message: string) {
    setError(message);
    setBusy(false);
  }

  async function handleStartEnrollment() {
    setError(null);
    setBusy(true);
    const res = await startMfaEnrollmentAction();
    if (!res.ok) return fail(res.error);
    setSecret(res.secret);
    setQrDataUrl(res.qrDataUrl);
    setStage("enrolling");
    setBusy(false);
  }

  async function handleVerifyEnrollment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const formData = new FormData(e.currentTarget);
    const res = await verifyMfaEnrollmentAction(formData);
    if (!res.ok) return fail(res.error);
    // The code was correct — now generate the recovery codes and show
    // them once, before MFA is switched on.
    const codesRes = await generateMfaRecoveryCodesAction();
    if (!codesRes.ok) return fail(codesRes.error);
    setCodes(codesRes.codes);
    setCodesSaved(false);
    setStage("codes");
    setBusy(false);
  }

  async function handleEnable() {
    setError(null);
    setBusy(true);
    const res = await enableMfaAction();
    if (!res.ok) return fail(res.error);
    setStage("enabled");
    setBusy(false);
  }

  async function handleDisable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const formData = new FormData(e.currentTarget);
    const res = await disableMfaAction(formData);
    if (!res.ok) return fail(res.error);
    setStage("disabled");
    setBusy(false);
  }

  function handleCancelSetup() {
    setSecret("");
    setQrDataUrl(null);
    setCodes([]);
    setError(null);
    setStage("disabled");
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard unavailable — the text is still visible to copy manually.
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-start gap-3">
        <span style={{ color: "var(--color-primary)", marginTop: 2 }}>
          <IconShield size={20} />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Add a second step to signing in using an authenticator app. Optional — your sign-in stays the same until you turn this on.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg px-4 py-3 text-sm"
          style={{
            background: "var(--color-accent-soft)",
            color: "var(--color-primary)",
            border: "1px solid var(--color-primary)",
          }}
        >
          {error}
        </div>
      )}

      {stage === "loading" && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Loading two-factor status…
        </p>
      )}

      {stage === "disabled" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Two-factor authentication is off. When you turn it on, you will enter a 6-digit code from your authenticator app after your password.
          </p>
          <button
            type="button"
            onClick={handleStartEnrollment}
            disabled={busy}
            className="btn-primary text-sm px-4 py-2"
          >
            {busy ? "Setting up…" : "Set up two-factor authentication"}
          </button>
        </div>
      )}

      {stage === "enrolling" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Scan this code with your authenticator app (Google Authenticator, Authy, or any app that supports TOTP), then enter the 6-digit code it shows.
          </p>
          {qrDataUrl ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR code to add ExamArchive to your authenticator app"
                width={180}
                height={180}
                className="rounded-lg bg-white p-2"
              />
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              The QR code could not be generated — enter the setup key below manually instead.
            </p>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Setup key (enter manually if you cannot scan)
            </label>
            <div className="flex items-center gap-2">
              <code className="input-field flex-1 break-all font-mono text-sm">{secret}</code>
              <button
                type="button"
                onClick={() => copyText(secret, "secret")}
                className="btn text-sm px-3 py-2"
              >
                {copied === "secret" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <form onSubmit={handleVerifyEnrollment} className="space-y-3">
            <div>
              <label htmlFor="mfa-enroll-otp" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                6-digit code from your authenticator app
              </label>
              <input
                id="mfa-enroll-otp"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                placeholder="123456"
                className="input-field text-center text-lg tracking-[0.3em]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className="btn-primary text-sm px-4 py-2">
                {busy ? "Verifying…" : "Verify and continue"}
              </button>
              <button type="button" onClick={handleCancelSetup} className="btn text-sm px-4 py-2">
                Cancel setup
              </button>
            </div>
          </form>
        </div>
      )}

      {stage === "codes" && (
        <div className="mt-4 space-y-4">
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              background: "var(--color-accent-soft)",
              color: "var(--color-primary)",
              border: "1px solid var(--color-primary)",
            }}
          >
            <strong>Save these recovery codes now.</strong> Each code works once and lets you sign in if you lose your authenticator app. They are shown only this once — ExamArchive cannot show them again.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {codes.map((code) => (
              <code key={code} className="rounded-md px-3 py-2 font-mono text-sm text-center" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                {code}
              </code>
            ))}
          </div>
          <button
            type="button"
            onClick={() => copyText(codes.join("\n"), "codes")}
            className="btn text-sm px-4 py-2"
          >
            {copied === "codes" ? "Copied" : "Copy all codes"}
          </button>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={codesSaved}
              onChange={(e) => setCodesSaved(e.target.checked)}
              className="mt-0.5"
            />
            I have saved these recovery codes somewhere safe.
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEnable}
              disabled={!codesSaved || busy}
              className="btn-primary text-sm px-4 py-2"
            >
              {busy ? "Turning on…" : "Turn on two-factor authentication"}
            </button>
            <button type="button" onClick={handleCancelSetup} className="btn text-sm px-4 py-2">
              Cancel setup
            </button>
          </div>
        </div>
      )}

      {stage === "enabled" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Two-factor authentication is on. You will be asked for a code from your authenticator app (or a recovery code) every time you sign in.
          </p>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Lost your authenticator app? Use one of your saved recovery codes to sign in, then turn this off and set it up again. If you have lost both, contact support — an administrator can turn it off for you after verifying your identity.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStage("disabling");
            }}
            className="btn text-sm px-4 py-2"
          >
            Turn off two-factor authentication
          </button>
        </div>
      )}

      {stage === "disabling" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            To turn off two-factor authentication, enter the current 6-digit code from your authenticator app — or one of your recovery codes if you no longer have the app.
          </p>
          <form onSubmit={handleDisable} className="space-y-3">
            <div>
              <label htmlFor="mfa-disable-code" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                <IconLock size={14} />
                6-digit code or recovery code
              </label>
              <input
                id="mfa-disable-code"
                name="code"
                type="text"
                autoComplete="one-time-code"
                required
                placeholder="123456 or XXXX-XXXXX"
                className="input-field text-center text-lg tracking-[0.2em]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className="btn-primary text-sm px-4 py-2">
                {busy ? "Turning off…" : "Turn off two-factor authentication"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStage("enabled");
                }}
                className="btn text-sm px-4 py-2"
              >
                Keep it on
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
