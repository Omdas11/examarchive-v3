"use client";

import { useState, useEffect } from "react";
import { signOut } from "@/app/auth/actions";
import type { UserProfile } from "@/types";

interface SettingsFormProps {
  user: UserProfile;
}

const THEME_ICONS: Record<"light" | "dark" | "system", React.ReactNode> = {
  light: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 15a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm9-9a1 1 0 0 1 0 2h-1a1 1 0 1 1 0-2h1ZM5 11a1 1 0 0 1 0 2H4a1 1 0 1 1 0-2h1Zm14.07-5.66a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.7-.71a1 1 0 0 1 1.42 0ZM7.05 17.66a1 1 0 0 1 0 1.41l-.7.71a1 1 0 0 1-1.42-1.41l.71-.71a1 1 0 0 1 1.41 0Zm12.02 2.12a1 1 0 0 1-1.41 0l-.71-.71a1 1 0 0 1 1.41-1.41l.71.7a1 1 0 0 1 0 1.42ZM7.05 6.34a1 1 0 0 1-1.41 0l-.71-.7a1 1 0 0 1 1.41-1.42l.71.71a1 1 0 0 1 0 1.41ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
    </svg>
  ),
  dark: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.1 22c5.52 0 10-4.48 10-10 0-4.75-3.31-8.72-7.75-9.74a.78.78 0 0 0-.9 1.01 8.27 8.27 0 0 1-8.17 10.36.78.78 0 0 0-.56 1.3A9.98 9.98 0 0 0 12.1 22Z" />
    </svg>
  ),
  system: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
    </svg>
  ),
};

export default function SettingsForm({ user }: SettingsFormProps) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") setTheme("dark");
    else if (stored === "light") setTheme("light");
    else setTheme("system");
    setReduceMotion(localStorage.getItem("reduceMotion") === "true");
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

  function handleReduceMotionChange(value: boolean) {
    setReduceMotion(value);
    if (value) {
      localStorage.setItem("reduceMotion", "true");
      document.documentElement.setAttribute("data-reduce-motion", "true");
    } else {
      localStorage.removeItem("reduceMotion");
      document.documentElement.removeAttribute("data-reduce-motion");
    }
  }

  const joinedDate = new Date(user.created_at).toLocaleDateString(undefined, {
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
              <span className="flex justify-center mb-1" style={{ color: theme === opt ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                {THEME_ICONS[opt]}
              </span>
              <span className="capitalize">{opt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Animations */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold">Animations</h2>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Reduce motion for accessibility or performance.
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Reduce animations</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Disables transitions, shimmer, and motion effects.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reduceMotion}
            onClick={() => handleReduceMotionChange(!reduceMotion)}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            style={{
              background: reduceMotion ? "var(--color-primary)" : "var(--color-border)",
            }}
          >
            <span
              className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              style={{ transform: reduceMotion ? "translateX(22px)" : "translateX(4px)" }}
            />
          </button>
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

