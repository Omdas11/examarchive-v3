"use client";

import { useState } from "react";

interface ProfileRightSidebarProps {
  email: string;
  roleLabel: string;
  rankLabel: string;
  tierLabel: string;
  xoScore: number;
  approvedCount: number;
  totalUploads: number;
  streakDays: number;
  joinedDate: string;
}

export default function ProfileRightSidebar({
  email,
  roleLabel,
  rankLabel,
  tierLabel,
  xoScore,
  approvedCount,
  totalUploads,
  streakDays,
  joinedDate,
}: ProfileRightSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <button type="button" className="btn text-xs px-3 py-1.5" onClick={() => setOpen(true)}>
          Profile sidebar
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Close profile sidebar backdrop"
            onClick={() => setOpen(false)}
          />
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-sm p-5"
            style={{
              background: "var(--color-surface)",
              borderLeft: "1px solid var(--color-border)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Profile sidebar"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Profile sidebar</h2>
              <button type="button" className="btn text-xs px-2 py-1" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt style={{ color: "var(--color-text-muted)" }}>Email</dt>
                <dd className="truncate max-w-[200px]" title={email}>{email}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--color-text-muted)" }}>Role</dt>
                <dd className="font-medium">{roleLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--color-text-muted)" }}>Rank</dt>
                <dd>{rankLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--color-text-muted)" }}>Tier</dt>
                <dd className="capitalize">{tierLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--color-text-muted)" }}>XO</dt>
                <dd className="font-semibold">{xoScore}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--color-text-muted)" }}>Approved</dt>
                <dd>{approvedCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--color-text-muted)" }}>Uploads</dt>
                <dd>{totalUploads}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--color-text-muted)" }}>Streak</dt>
                <dd>{streakDays} days</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--color-text-muted)" }}>Member since</dt>
                <dd>{joinedDate}</dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </>
  );
}
