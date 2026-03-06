"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastContext";
import AvatarRing from "@/components/AvatarRing";

interface ProfileEditorProps {
  userId: string;
  initialName: string;
  initialUsername: string;
  initialAvatarUrl: string;
}

export default function ProfileEditor({
  userId,
  initialName,
  initialUsername,
  initialAvatarUrl,
}: ProfileEditorProps) {
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const displayName = name || username || userId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, avatar_url: avatarUrl }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Failed to save profile", "error");
      } else {
        showToast("Profile updated successfully", "success");
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
        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          <AvatarRing
            displayName={displayName}
            avatarUrl={avatarUrl || undefined}
            streakDays={0}
            size={48}
          />
          <div className="flex-1">
            <label
              htmlFor="avatar_url"
              className="block text-xs font-medium mb-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Avatar URL
            </label>
            <input
              id="avatar_url"
              type="url"
              placeholder="https://example.com/avatar.jpg"
              className="input-field"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              autoComplete="off"
            />
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
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
