"use client";

import { useState } from "react";

interface ReferralShareCardProps {
  referralCode: string;
  referralLink: string;
}

export default function ReferralShareCard({
  referralCode,
  referralLink,
}: ReferralShareCardProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
  }

  return (
    <div className="card p-6">
      <h2 className="text-base font-semibold mb-2">Referral</h2>
      <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
        Share your referral link with new users. You earn XP and AI credits when valid referrals become active.
      </p>

      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2" style={{ border: "1px solid var(--color-border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Your referral code</p>
          <div className="flex items-center justify-between gap-2">
            <code className="font-mono text-sm font-semibold">{referralCode || "Pending"}</code>
            <button type="button" className="btn text-xs px-2 py-1" onClick={() => void copyCode()} disabled={!referralCode}>
              {copiedCode ? "Copied" : "Copy code"}
            </button>
          </div>
        </div>

        <div className="rounded-lg px-3 py-2" style={{ border: "1px solid var(--color-border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Referral link</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs break-all flex-1" style={{ color: "var(--color-text-muted)" }}>{referralLink}</p>
            <button type="button" className="btn text-xs px-2 py-1 shrink-0" onClick={() => void copyLink()}>
              {copiedLink ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
