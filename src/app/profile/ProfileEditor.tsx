"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastContext";
import AvatarRing from "@/components/AvatarRing";
import { IconEdit, IconRefresh } from "@/components/Icons";
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
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [usernameLastChanged, setUsernameLastChanged] = useState<string | null | undefined>(initialUsernameLastChanged);
  const [editingUsername, setEditingUsername] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const displayName = name || username || "User";
  const shownAvatar = avatarPreview ?? avatarUrl;
  const daysLeft = cooldownDaysLeft(usernameLastChanged);
  const canChangeUsername = daysLeft === 0;

  useEffect(() => {
    if (editingUsername && usernameInputRef.current) {
      usernameInputRef.current.focus();
      usernameInputRef.current.select();
    }
  }, [editingUsername]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);

    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error ?? "Avatar upload failed";
        const detail = data.details ? ` (${data.details})` : "";
        showToast(msg + detail, "error");
        setAvatarPreview(null);
      } else {
        setAvatarUrl(data.avatar_url ?? "");
        setAvatarPreview(null);
        showToast("Profile photo updated", "success");
        router.refresh();
      }
    } catch (err) {
      showToast(toErrorMessage(err, "Network error – please try again"), "error");
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Failed to remove photo", "error");
      } else {
        setAvatarUrl("");
        setAvatarPreview(null);
        showToast("Profile photo removed", "success");
        router.refresh();
      }
    } catch {
      showToast("Network error – please try again", "error");
    } finally {
      setUploadingAvatar(false);
    }
  }

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
      {/* ── Centered avatar with red camera button ── */}
      <div className="relative inline-block">
        <AvatarRing
          displayName={displayName}
          avatarUrl={shownAvatar || undefined}
          streakDays={0}
          role={role}
          size={96}
        />
        {/* Camera overlay button — z-10 ensures it floats above the AvatarRing stacking context */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingAvatar}
          className="absolute bottom-0 right-0 z-10 flex items-center justify-center rounded-full w-8 h-8 shadow-md transition-opacity hover:opacity-90"
          style={{ background: "var(--color-primary)", color: "#fff" }}
          aria-label="Change profile photo"
        >
          {uploadingAvatar ? (
            <IconRefresh size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <IconEdit size={15} aria-hidden="true" />
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={handleAvatarChange}
          disabled={uploadingAvatar}
          aria-label="Upload avatar image"
        />
      </div>

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

      {shownAvatar && !uploadingAvatar && (
        <button
          type="button"
          onClick={handleRemoveAvatar}
          className="text-[11px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          Remove photo
        </button>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        className="btn-primary text-sm px-5 py-1.5 mt-1"
        disabled={saving || uploadingAvatar}
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
      <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
        JPEG, PNG, WebP or GIF · max 2 MB
      </p>
    </div>
  );
}
