"use client";

import { useState, useEffect } from "react";
import { signOut } from "@/app/auth/actions";
import type { UserProfile } from "@/types";

interface SettingsFormProps {
  user: UserProfile;
}

export default function SettingsForm({ user }: SettingsFormProps) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") setTheme("dark");
    else if (stored === "light") setTheme("light");
    else setTheme("system");
  }, []);

  function handleThemeChange(newTheme: "light" | "dark" | "system") {
    setTheme(newTheme);
    if (newTheme === "system") {
      localStorage.removeItem("theme");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      document.documentElement.setAttribute(
        "data-theme",
        prefersDark ? "dark" : "light"
      );
    } else {
      localStorage.setItem("theme", newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
    }
  }

  const joinedDate = new Date(user.created_at).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mt-6 space-y-6">
      {/* Profile Information */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold">Profile Information</h2>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Your account details.
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <dt style={{ color: "var(--color-text-muted)" }}>Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <hr style={{ borderColor: "var(--color-border)" }} />
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <dt style={{ color: "var(--color-text-muted)" }}>Role</dt>
            <dd className="capitalize font-medium">{user.role}</dd>
          </div>
          <hr style={{ borderColor: "var(--color-border)" }} />
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <dt style={{ color: "var(--color-text-muted)" }}>Member Since</dt>
            <dd className="font-medium">{joinedDate}</dd>
          </div>
          <hr style={{ borderColor: "var(--color-border)" }} />
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <dt style={{ color: "var(--color-text-muted)" }}>User ID</dt>
            <dd className="font-mono text-xs truncate max-w-[250px]" title={user.id}>
              {user.id}
            </dd>
          </div>
        </dl>
      </div>

      {/* Theme Preference */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold">Theme Preference</h2>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Choose how ExamArchive looks to you.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(["light", "dark", "system"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleThemeChange(opt)}
              className="card p-4 text-center text-sm font-medium transition-all"
              style={{
                borderColor:
                  theme === opt ? "var(--color-primary)" : "var(--color-border)",
                borderWidth: theme === opt ? "2px" : "1px",
              }}
            >
              <span className="block text-lg mb-1">
                {opt === "light" ? "☀️" : opt === "dark" ? "🌙" : "💻"}
              </span>
              <span className="capitalize">{opt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Account Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold">Account Actions</h2>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Manage your session and account.
        </p>
        <div className="mt-4 space-y-3">
          <form action={signOut}>
            <button type="submit" className="btn text-sm px-5 py-2">
              Sign out
            </button>
          </form>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            To delete your account or change your email, please contact{" "}
            <a
              href="mailto:contact@examarchive.org"
              style={{ color: "var(--color-primary)" }}
              className="underline"
            >
              support
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
