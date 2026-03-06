"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastContext";
import AvatarRing from "@/components/AvatarRing";

interface ProfileEditorProps {
  initialName: string;
  initialUsername: string;
  initialAvatarUrl: string;
}

export default function ProfileEditor({
  initialName,
  initialUsername,
  initialAvatarUrl,
}: ProfileEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const displayName = name || username || "User";
  const shownAvatar = avatarPreview ?? avatarUrl;

  /** Handle avatar file selection: show local preview and upload immediately */
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview right away
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);

    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Avatar upload failed", "error");
        setAvatarPreview(null); // revert preview on failure
      } else {
        setAvatarUrl(data.avatar_url ?? "");
        setAvatarPreview(null); // use the real URL from server
        showToast("Avatar updated", "success");
        // Refresh server-side data so Navbar/ProfilePanel show the new avatar
        router.refresh();
      }
    } catch {
      showToast("Network error – please try again", "error");
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /** Remove current avatar */
  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Failed to remove avatar", "error");
      } else {
        setAvatarUrl("");
        setAvatarPreview(null);
        showToast("Avatar removed", "success");
        // Refresh server-side data so Navbar/ProfilePanel reflect the removal
        router.refresh();
      }
    } catch {
      showToast("Network error – please try again", "error");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Failed to save profile", "error");
      } else {
        showToast("Profile updated successfully", "success");
        // Refresh server-side data so Navbar/ProfilePanel show the updated name/username
        router.refresh();
      }
    } catch {
      showToast("Network error – please try again", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card mt-6 p-6">
      <h2 className="text-base font-semibold">Edit Display Profile</h2>
      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
        Customise how you appear to other users.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* Avatar upload */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <AvatarRing
              displayName={displayName}
              avatarUrl={shownAvatar || undefined}
              streakDays={0}
              size={56}
            />
            {uploadingAvatar && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="btn text-xs px-3 py-1.5"
            >
              {uploadingAvatar ? "Uploading…" : "Upload Photo"}
            </button>
            {shownAvatar && !uploadingAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Remove photo
              </button>
            )}
            <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              JPEG, PNG, WebP or GIF · max 2 MB
            </p>
          </div>
        </div>

        {/* Display name */}
        <div>
          <label
            htmlFor="display_name"
            className="block text-xs font-medium mb-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Display Name
          </label>
          <input
            id="display_name"
            type="text"
            placeholder="Your name"
            className="input-field"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            Max 60 characters
          </p>
        </div>

        {/* Username */}
        <div>
          <label
            htmlFor="username"
            className="block text-xs font-medium mb-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Username
          </label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
              style={{ color: "var(--color-text-muted)" }}
            >
              @
            </span>
            <input
              id="username"
              type="text"
              placeholder="yourhandle"
              className="input-field pl-7"
              value={username}
              maxLength={30}
              pattern="[a-zA-Z0-9_]*"
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              autoComplete="username"
            />
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            Letters, numbers, underscores only. Max 30 characters.
          </p>
        </div>

        <button
          type="submit"
          className="btn-primary text-sm px-5 py-2"
          disabled={saving || uploadingAvatar}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
