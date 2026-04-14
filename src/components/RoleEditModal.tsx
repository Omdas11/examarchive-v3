"use client";

import { useState } from "react";
import type { AdminUser, UserRole, CustomRole, UserTier } from "@/types";

/**
 * Roles available for assignment, in descending privilege order.
 * Founders can assign any role; admins can assign up to "admin".
 */
const ROLES: UserRole[] = [
  "founder",
  "moderator",
  "subject_admin",
  "specialist",
  "contributor",
  "student",
  // legacy values for compatibility while records are migrated
  "admin",
  "maintainer",
  "curator",
  "verified_contributor",
  "explorer",
  "visitor",
];

/** Human-readable labels for the role dropdown. */
const ROLE_LABELS: Record<UserRole, string> = {
  founder: "Founder",
  moderator: "Moderator",
  subject_admin: "Subject Administrator",
  specialist: "Specialist",
  contributor: "Contributor",
  student: "Student",
  admin: "Moderator (legacy admin)",
  maintainer: "Moderator (legacy maintainer)",
  curator: "Specialist (legacy curator)",
  verified_contributor: "Specialist (legacy verified contributor)",
  viewer: "Student (legacy viewer)",
  explorer: "Student (legacy explorer)",
  visitor: "Student (legacy visitor)",
  guest: "Student (legacy guest)",
};

const CUSTOM_ROLES: string[] = [
  "none",
  "supporter",
  "mentor",
  "archivist",
  "ambassador",
];
const TIERS: UserTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];
const SUBJECT_OPTIONS = [
  "Assamese",
  "Bengali",
  "English",
  "Hindi",
  "Economics",
  "Education",
  "History",
  "Political Science",
  "Philosophy",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Zoology",
];

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
  const initialRole: UserRole = ROLES.includes(user.role) ? user.role : "student";
  const [role, setRole] = useState<UserRole>(initialRole);
  const [secondaryRole, setSecondaryRole] = useState<CustomRole | "none">(
    user.secondary_role ?? "none",
  );
  const [tertiaryRole, setTertiaryRole] = useState<CustomRole | "none">(
    user.tertiary_role ?? "none",
  );
  const [tier, setTier] = useState<UserTier>(user.tier);
  const [specialistSubject, setSpecialistSubject] = useState<string>(user.specialist_subject ?? "");
  const [subjectAdminSubject, setSubjectAdminSubject] = useState<string>(user.subject_admin_subject ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user.id === currentAdminId;

  async function handleSave() {
    if (isSelf && role !== user.role) {
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
          // Keep primary_role in sync for backward compatibility
          primary_role: role,
          secondary_role: secondaryRole === "none" ? null : secondaryRole,
          tertiary_role: tertiaryRole === "none" ? null : tertiaryRole,
          specialist_subject: specialistSubject || null,
          subject_admin_subject: subjectAdminSubject || null,
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
        primary_role: role,
        secondary_role: secondaryRole === "none" ? null : secondaryRole,
        tertiary_role: tertiaryRole === "none" ? null : tertiaryRole,
        specialist_subject: specialistSubject || null,
        subject_admin_subject: subjectAdminSubject || null,
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
                  {ROLE_LABELS[r] ?? r}
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
              Community Badge (Secondary)
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
                  {r === "none" ? "None" : r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Community Badge (Tertiary)
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
                  {r === "none" ? "None" : r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Specialist Subject</label>
            <select
              className="input-field"
              value={specialistSubject}
              onChange={(e) => setSpecialistSubject(e.target.value)}
            >
              <option value="">None</option>
              {SUBJECT_OPTIONS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Subject Admin Subject</label>
            <select
              className="input-field"
              value={subjectAdminSubject}
              onChange={(e) => setSubjectAdminSubject(e.target.value)}
            >
              <option value="">None</option>
              {SUBJECT_OPTIONS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
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
                  {t.charAt(0).toUpperCase() + t.slice(1)}
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
