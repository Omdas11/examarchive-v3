"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastContext";
import AvatarRing from "@/components/AvatarRing";

interface ProfileEditorProps {
  initialName: string;
  initialUsername: string;
  initialAvatarUrl: string;
  /** ISO string of when the username was last changed (for cooldown display). */
  initialUsernameLastChanged?: string | null;
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
    <div className="space-y-4">
      {/* Avatar with pencil overlay */}
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <AvatarRing
            displayName={displayName}
            avatarUrl={shownAvatar || undefined}
            streakDays={0}
            size={72}
          />
          {/* Pencil overlay button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute bottom-0 right-0 flex items-center justify-center rounded-full w-6 h-6 shadow-md transition-opacity hover:opacity-90"
            style={{ background: "var(--color-primary)", color: "#fff" }}
            aria-label="Change profile photo"
          >
            {uploadingAvatar ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
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

        <div className="flex-1 min-w-0">
          {/* Display name inline */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Display name"
            className="input-field text-base font-semibold py-1.5 mb-1"
            style={{ fontWeight: 600 }}
            aria-label="Display name"
          />

          {/* Username inline – locked unless cooldown passed */}
          {editingUsername ? (
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
                style={{ color: "var(--color-text-muted)" }}
              >@</span>
              <input
                ref={usernameInputRef}
                type="text"
                value={username}
                maxLength={30}
                pattern="[a-zA-Z0-9_]*"
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                onBlur={() => { if (!username) setEditingUsername(false); }}
                className="input-field pl-7 text-sm py-1.5"
                aria-label="Username"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-sm truncate" style={{ color: "var(--color-text-muted)" }}>
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
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
              className="mt-1 text-[11px] block"
              style={{ color: "var(--color-text-muted)" }}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary text-sm px-5 py-2"
          disabled={saving || uploadingAvatar}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          JPEG, PNG, WebP or GIF · max 2 MB
        </p>
      </div>
    </div>
  );
}
