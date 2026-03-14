"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import type { UserProfile } from "@/types";
import AvatarRing from "./AvatarRing";
import ProfilePanel from "./ProfilePanel";
import EALogo from "./EALogo";

/** Minimum horizontal swipe distance (px) to trigger drawer open/close. */
const SWIPE_THRESHOLD = 50;
/** Maximum x-origin (px) from the left edge that counts as an "open" swipe. */
const EDGE_THRESHOLD = 48;
/** Minimum x-origin (px) from the right edge that counts as a right-swipe open. */
const RIGHT_EDGE_THRESHOLD = 48;

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/papers", label: "Papers" },
  { href: "/upload", label: "Upload" },
  { href: "/syllabus", label: "Syllabus" },
  { href: "/ai-content", label: "✨ AI" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Support" },
];

interface NavbarProps {
  user: UserProfile | null;
}

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchCurrentX = useRef(0);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  // Prevent body scroll when any overlay panel is open.
  useEffect(() => {
    const anyOpen = drawerOpen || profilePanelOpen;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen, profilePanelOpen]);

  // Close avatar dropdown on outside click.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Swipe-to-open/close sidebar via touch events.
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchCurrentX.current = e.touches[0].clientX;
    }

    function onTouchMove(e: TouchEvent) {
      touchCurrentX.current = e.touches[0].clientX;
    }

    function onTouchEnd(e: TouchEvent) {
      const endX = e.changedTouches[0].clientX;
      const dx = endX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      // Ignore predominantly vertical swipes.
      if (Math.abs(dy) > Math.abs(dx) * 0.8) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;

      const screenW = window.innerWidth;

      // Left drawer: swipe right from left edge → open; swipe left when open → close
      if (!drawerOpen && dx > 0 && touchStartX.current < EDGE_THRESHOLD) {
        setDrawerOpen(true);
      } else if (drawerOpen && dx < 0) {
        setDrawerOpen(false);
      }

      // Profile panel (logged-in only): swipe left from right edge → open; swipe right when open → close
      if (user) {
        if (!profilePanelOpen && dx < 0 && touchStartX.current > screenW - RIGHT_EDGE_THRESHOLD) {
          setProfilePanelOpen(true);
        } else if (profilePanelOpen && dx > 0) {
          setProfilePanelOpen(false);
        }
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [drawerOpen, profilePanelOpen, user]);

  // Close drawer when route changes
  useEffect(() => {
    setDrawerOpen(false);
    setProfilePanelOpen(false);
  }, [pathname]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  const displayName = user
    ? user.name || user.username || user.email
    : "";

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const isAdminOrAbove = user && (user.role === "admin" || user.role === "moderator" || user.role === "founder");

  return (
    <>
      {/* Profile panel (logged-in users) */}
      {user && (
        <ProfilePanel
          user={user}
          open={profilePanelOpen}
          onClose={() => setProfilePanelOpen(false)}
        />
      )}

      <nav
        className="sticky top-0 z-50 backdrop-blur"
        style={{
          borderBottom: "1px solid var(--color-border)",
          background: "color-mix(in srgb, var(--color-bg) 85%, transparent)",
        }}
      >
        <div className="mx-auto flex h-14 items-center justify-between px-4" style={{ maxWidth: "var(--max-w)" }}>
          {/* Mobile hamburger */}
          <button
            className="mr-2 md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 text-lg font-bold tracking-tight">
            <EALogo size={28} />
            <span>ExamArchive</span>
            <span
              className="hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide leading-none"
              style={{ background: "var(--color-primary)", color: "#fff", letterSpacing: "0.07em" }}
              aria-label="Early Access"
            >
              Early Access
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="transition-colors hover:opacity-70"
                style={isActive(l.href) ? { color: "var(--color-primary)", fontWeight: 700 } : undefined}
                aria-current={isActive(l.href) ? "page" : undefined}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Theme toggle + Auth */}
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} className="p-1.5 rounded-md transition-colors hover:opacity-70">
              {dark ? (
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 15a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm9-9a1 1 0 0 1 0 2h-1a1 1 0 1 1 0-2h1ZM5 11a1 1 0 0 1 0 2H4a1 1 0 1 1 0-2h1Zm14.07-5.66a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.7-.71a1 1 0 0 1 1.42 0ZM7.05 17.66a1 1 0 0 1 0 1.41l-.7.71a1 1 0 0 1-1.42-1.41l.71-.71a1 1 0 0 1 1.41 0Zm12.02 2.12a1 1 0 0 1-1.41 0l-.71-.71a1 1 0 0 1 1.41-1.41l.71.7a1 1 0 0 1 0 1.42ZM7.05 6.34a1 1 0 0 1-1.41 0l-.71-.7a1 1 0 0 1 1.41-1.42l.71.71a1 1 0 0 1 0 1.41ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"/></svg>
              ) : (
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12.1 22c5.52 0 10-4.48 10-10 0-4.75-3.31-8.72-7.75-9.74a.78.78 0 0 0-.9 1.01 8.27 8.27 0 0 1-8.17 10.36.78.78 0 0 0-.56 1.3A9.98 9.98 0 0 0 12.1 22Z"/></svg>
              )}
            </button>

            {/* Mobile: show avatar when logged in */}
            {user && (
              <button
                className="md:hidden"
                onClick={() => setProfilePanelOpen(true)}
                aria-label="Open profile"
              >
                <AvatarRing
                  displayName={displayName}
                  avatarUrl={user.avatar_url || undefined}
                  streakDays={user.streak_days}
                  role={user.role}
                  size={40}
                />
              </button>
            )}

            {/* Desktop: avatar circle (opens profile panel) + dropdown */}
            {user ? (
              <div ref={dropdownRef} className="relative hidden md:block">
                <button
                  onClick={() => setDropdownOpen((d) => !d)}
                  className="transition-opacity hover:opacity-80 flex items-center"
                  aria-label={`Account menu for ${displayName}`}
                  aria-haspopup="true"
                  aria-expanded={dropdownOpen}
                >
                  <AvatarRing
                    displayName={displayName}
                    avatarUrl={user.avatar_url || undefined}
                    streakDays={user.streak_days}
                    role={user.role}
                    size={32}
                  />
                </button>

                {dropdownOpen && (
                  <div
                    className="absolute right-0 top-10 z-50 w-48 rounded-lg py-1 shadow-lg"
                    style={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                    role="menu"
                  >
                    <p
                      className="truncate px-4 py-2 text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                      title={user.email}
                    >
                      {user.name || user.email}
                    </p>
                    <hr style={{ borderColor: "var(--color-border)" }} />
                    <button
                      onClick={() => { setDropdownOpen(false); setProfilePanelOpen(true); }}
                      className="block w-full text-left px-4 py-2 text-sm transition-colors hover:opacity-70"
                      role="menuitem"
                    >
                      View Profile
                    </button>
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm transition-colors hover:opacity-70"
                      role="menuitem"
                    >
                      Edit Profile
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm transition-colors hover:opacity-70"
                      role="menuitem"
                    >
                      Settings
                    </Link>
                    <Link
                      href="/stats"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm transition-colors hover:opacity-70"
                      role="menuitem"
                    >
                      Platform Stats
                    </Link>
                    <Link
                      href="/ai-content"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm transition-colors hover:opacity-70"
                      role="menuitem"
                      style={{ color: "var(--color-primary)" }}
                    >
                      ✨ AI Content
                    </Link>
                    {isAdminOrAbove && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 text-sm transition-colors hover:opacity-70"
                        role="menuitem"
                      >
                        Admin Dashboard
                      </Link>
                    )}
                    {isAdminOrAbove && (
                      <Link
                        href="/admin/users"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 text-sm transition-colors hover:opacity-70"
                        role="menuitem"
                      >
                        User Management
                      </Link>
                    )}
                    {user && user.role === "founder" && (
                      <Link
                        href="/devtool"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 text-sm transition-colors hover:opacity-70"
                        role="menuitem"
                        style={{ color: "#7c3aed" }}
                      >
                        DevTool
                      </Link>
                    )}
                    <hr style={{ borderColor: "var(--color-border)" }} />
                    <form action={signOut}>
                      <button
                        type="submit"
                        className="block w-full px-4 py-2 text-left text-sm transition-colors hover:opacity-70"
                        role="menuitem"
                      >
                        Sign out
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="btn-primary hidden md:inline-flex text-xs px-4 py-1.5">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 md:hidden ${drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile drawer panel – slides in from the left */}
      <div
        className={`fixed inset-y-0 left-0 z-[70] flex w-64 flex-col gap-1 p-5 shadow-xl transition-transform duration-300 ease-in-out md:hidden ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}
        aria-modal="true"
        role="dialog"
        aria-label="Navigation menu"
      >
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" onClick={() => setDrawerOpen(false)} className="flex items-center gap-1.5 font-bold text-base">
            <EALogo size={24} />
            <span>ExamArchive</span>
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide leading-none"
              style={{ background: "var(--color-primary)", color: "#fff" }}
            >
              EA
            </span>
          </Link>
          <button onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <hr style={{ borderColor: "var(--color-border)" }} />
        {navLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setDrawerOpen(false)}
            className="flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
            style={
              isActive(l.href)
                ? { color: "var(--color-primary)", background: "var(--color-accent-soft)", fontWeight: 700 }
                : undefined
            }
            aria-current={isActive(l.href) ? "page" : undefined}
          >
            {l.label}
          </Link>
        ))}
        <hr style={{ borderColor: "var(--color-border)" }} className="my-1" />
        {user ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1">
              <AvatarRing
                displayName={displayName}
                avatarUrl={user.avatar_url || undefined}
                streakDays={user.streak_days}
                role={user.role}
                size={28}
              />
              <p
                className="truncate text-xs"
                style={{ color: "var(--color-text-muted)" }}
                title={user.email}
              >
                {user.name || user.email}
              </p>
            </div>
            <button
              onClick={() => { setDrawerOpen(false); setProfilePanelOpen(true); }}
              className="block w-full text-left rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
            >
              View Profile
            </button>
            <Link
              href="/profile"
              onClick={() => setDrawerOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
              style={isActive("/profile") ? { color: "var(--color-primary)", fontWeight: 700 } : undefined}
            >
              Edit Profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setDrawerOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
              style={isActive("/settings") ? { color: "var(--color-primary)", fontWeight: 700 } : undefined}
            >
              Settings
            </Link>
            <Link
              href="/stats"
              onClick={() => setDrawerOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
              style={isActive("/stats") ? { color: "var(--color-primary)", fontWeight: 700 } : undefined}
            >
              Platform Stats
            </Link>
            {isAdminOrAbove && (
              <Link
                href="/admin"
                onClick={() => setDrawerOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
                style={isActive("/admin") ? { color: "var(--color-primary)", fontWeight: 700 } : undefined}
              >
                Admin Dashboard
              </Link>
            )}
            {isAdminOrAbove && (
              <Link
                href="/admin/users"
                onClick={() => setDrawerOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
                style={isActive("/admin/users") ? { color: "var(--color-primary)", fontWeight: 700 } : undefined}
              >
                User Management
              </Link>
            )}
            {user && user.role === "founder" && (
              <Link
                href="/devtool"
                onClick={() => setDrawerOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: "#7c3aed", fontWeight: isActive("/devtool") ? 700 : undefined }}
              >
                DevTool
              </Link>
            )}
            <form action={signOut}>
              <button
                type="submit"
                onClick={() => setDrawerOpen(false)}
                className="block w-full rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:opacity-70"
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            onClick={() => setDrawerOpen(false)}
            className="block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
            style={{ color: "var(--color-primary)" }}
          >
            Sign in
          </Link>
        )}
      </div>
    </>
  );
}
