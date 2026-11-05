"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastContext";
import AvatarRing from "@/components/AvatarRing";
import { IconEdit } from "@/components/Icons";
import type { UserRole } from "@/types";

interface ProfileEditorProps {
  initialName: string;
  initialUsername: string;
  initialAvatarUrl: string;
  /** ISO string of when the username was last changed (for cooldown display). */
  initialUsernameLastChanged?: string | null;
  /** User role – used to colour the avatar ring. */
  role?: UserRole;
}

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  if (typeof err === "string" && err) return err;
  return fallback;
}

const USERNAME_COOLDOWN_DAYS = 7;

/** Returns days remaining in cooldown, or 0 if none. */
function cooldownDaysLeft(lastChanged: string | null | undefined): number {
  if (!lastChanged) return 0;
  const daysSince = (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < USERNAME_COOLDOWN_DAYS ? Math.ceil(USERNAME_COOLDOWN_DAYS - daysSince) : 0;
}

export default function ProfileEditor({
  initialName,
  initialUsername,
  initialAvatarUrl,
  initialUsernameLastChanged,
  role,
}: ProfileEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [saving, setSaving] = useState(false);
  const [usernameLastChanged, setUsernameLastChanged] = useState<string | null | undefined>(initialUsernameLastChanged);
  const [editingUsername, setEditingUsername] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const displayName = name || username || "User";
  // Avatar is display-only now: the Google profile photo for Google sign-ins,
  // initials otherwise. No uploads.
  const avatarUrl = initialAvatarUrl;
  const daysLeft = cooldownDaysLeft(usernameLastChanged);
  const canChangeUsername = daysLeft === 0;

  useEffect(() => {
    if (editingUsername && usernameInputRef.current) {
      usernameInputRef.current.focus();
      usernameInputRef.current.select();
    }
  }, [editingUsername]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error ?? "Failed to save profile";
        const detail = data.details ? ` (${data.details})` : "";
        showToast(msg + detail, "error");
      } else {
        if (data.username_last_changed) setUsernameLastChanged(data.username_last_changed);
        showToast("Profile updated", "success");
        setEditingUsername(false);
        router.refresh();
      }
    } catch (err) {
      showToast(toErrorMessage(err, "Network error – please try again"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {/* ── Avatar is display-only: Google photo or initials ── */}
      <AvatarRing
        displayName={displayName}
        avatarUrl={avatarUrl || undefined}
        streakDays={0}
        role={role}
        size={96}
      />

      {/* Display name – styled as a large heading, editable inline */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        placeholder="Display name"
        className="text-2xl font-bold text-center w-full max-w-xs bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-[var(--color-primary)] focus:outline-none transition-colors"
        aria-label="Display name"
      />

      {/* Username – static display with toggle-edit */}
      {editingUsername ? (
        <div className="flex items-center gap-1">
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>@</span>
          <input
            ref={usernameInputRef}
            type="text"
            value={username}
            maxLength={30}
            pattern="[a-zA-Z0-9_]*"
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            onBlur={() => { if (!username) setEditingUsername(false); }}
            className="input-field text-sm py-1 text-center"
            aria-label="Username"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            @{username || <em>no username</em>}
          </span>
          {canChangeUsername ? (
            <button
              type="button"
              onClick={() => setEditingUsername(true)}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              title="Edit username"
              aria-label="Edit username"
            >
              <IconEdit size={11} strokeWidth={2.5} aria-hidden="true" />
            </button>
          ) : (
            <span className="text-[10px] shrink-0" style={{ color: "var(--color-text-muted)" }}>
              ({daysLeft}d cooldown)
            </span>
          )}
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        className="btn-primary text-sm px-5 py-1.5 mt-1"
        disabled={saving}
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
