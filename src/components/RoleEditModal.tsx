"use client";

import { useState } from "react";
import type { AdminUser, UserRole, CustomRole, UserTier } from "@/types";

const ROLES: UserRole[] = ["student", "moderator", "admin", "founder"];
const CUSTOM_ROLES: string[] = [
  "none",
  "contributor",
  "reviewer",
  "curator",
  "mentor",
  "archivist",
  "ambassador",
  "pioneer",
  "researcher",
];
const TIERS: UserTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];

interface RoleEditModalProps {
  user: AdminUser;
  currentAdminId: string;
  onClose: () => void;
  onSaved: (updated: AdminUser) => void;
}

export default function RoleEditModal({
  user,
  currentAdminId,
  onClose,
  onSaved,
}: RoleEditModalProps) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [primaryRole, setPrimaryRole] = useState<UserRole>(user.primary_role);
  const [secondaryRole, setSecondaryRole] = useState<CustomRole | "none">(
    user.secondary_role ?? "none",
  );
  const [tertiaryRole, setTertiaryRole] = useState<CustomRole | "none">(
    user.tertiary_role ?? "none",
  );
  const [tier, setTier] = useState<UserTier>(user.tier);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user.id === currentAdminId;

  async function handleSave() {
    if (isSelf && (role !== user.role || primaryRole !== user.primary_role)) {
      setError("You cannot change your own role.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          role,
          primary_role: primaryRole,
          secondary_role: secondaryRole === "none" ? null : secondaryRole,
          tertiary_role: tertiaryRole === "none" ? null : tertiaryRole,
          tier,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Update failed");
      }

      onSaved({
        ...user,
        role,
        primary_role: primaryRole,
        secondary_role: secondaryRole === "none" ? null : secondaryRole,
        tertiary_role: tertiaryRole === "none" ? null : tertiaryRole,
        tier,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-lg p-6 shadow-xl mx-4"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Edit User</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:opacity-70"
            aria-label="Close modal"
          >
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p
          className="text-sm mb-4 truncate"
          style={{ color: "var(--color-text-muted)" }}
          title={user.email}
        >
          {user.email}
        </p>

        {error && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{
              background: "var(--color-accent-soft)",
              color: "var(--color-primary)",
              border: "1px solid var(--color-primary)",
            }}
          >
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Role</label>
            <select
              className="input-field"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={isSelf}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {isSelf && (
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Cannot change your own role
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Primary Role
            </label>
            <select
              className="input-field"
              value={primaryRole}
              onChange={(e) => setPrimaryRole(e.target.value as UserRole)}
              disabled={isSelf}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Secondary Role
            </label>
            <select
              className="input-field"
              value={secondaryRole ?? "none"}
              onChange={(e) =>
                setSecondaryRole(e.target.value as CustomRole | "none")
              }
            >
              {CUSTOM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === "none" ? "None" : r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Tertiary Role
            </label>
            <select
              className="input-field"
              value={tertiaryRole ?? "none"}
              onChange={(e) =>
                setTertiaryRole(e.target.value as CustomRole | "none")
              }
            >
              {CUSTOM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === "none" ? "None" : r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Tier</label>
            <select
              className="input-field"
              value={tier}
              onChange={(e) => setTier(e.target.value as UserTier)}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button type="button" className="btn text-xs" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary text-xs"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
