"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserProfile } from "@/types";
import ProfileCoursePrefs from "@/components/ProfileCoursePrefs";

/* SVG icons for sidebar nav items */
const icons = {
  home: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  browse: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  upload: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  syllabus: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  papers: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  admin: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  devtool: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.42 15.17l-5.66-5.66m0 0l5.66-5.66m-5.66 5.66h14.14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  profile: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  about: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  support: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

interface SidebarProps {
  user: UserProfile | null;
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const isAdminOrAbove = user && (user.role === "admin" || user.role === "moderator" || user.role === "founder");

  return (
    <aside className="sidebar-nav" aria-label="Main navigation">
      <div className="sidebar-section-label">Main</div>
      <Link href="/" className={isActive("/") ? "active" : ""}>
        {icons.home} Home
      </Link>
      <Link href="/browse" className={isActive("/browse") ? "active" : ""}>
        {icons.browse} Browse
      </Link>
      <Link href="/papers" className={isActive("/papers") ? "active" : ""}>
        {icons.papers} Papers
      </Link>
      <Link href="/upload" className={isActive("/upload") ? "active" : ""}>
        {icons.upload} Upload
      </Link>
      <Link href="/syllabus" className={isActive("/syllabus") ? "active" : ""}>
        {icons.syllabus} Syllabus
      </Link>

      <div className="sidebar-section-label" style={{ marginTop: "0.5rem" }}>Info</div>
      <Link href="/about" className={isActive("/about") ? "active" : ""}>
        {icons.about} About
      </Link>
      <Link href="/support" className={isActive("/support") ? "active" : ""}>
        {icons.support} Support
      </Link>

      {user && (
        <>
          <div className="sidebar-section-label" style={{ marginTop: "0.5rem" }}>Account</div>
          <Link href="/profile" className={isActive("/profile") ? "active" : ""}>
            {icons.profile} Profile
          </Link>
          {/* My Courses compact widget */}
          <div className="mt-2 px-1">
            <ProfileCoursePrefs compact />
          </div>
        </>
      )}

      {isAdminOrAbove && (
        <>
          <div className="sidebar-section-label" style={{ marginTop: "0.5rem" }}>Admin</div>
          <Link href="/admin" className={isActive("/admin") && !pathname.includes("/admin/users") ? "active" : ""}>
            {icons.admin} Dashboard
          </Link>
          <Link href="/admin/users" className={isActive("/admin/users") ? "active" : ""}>
            {icons.users} Users
          </Link>
        </>
      )}

      {user?.role === "founder" && (
        <Link href="/devtool" className={isActive("/devtool") ? "active" : ""} style={{ color: "rgba(168,130,255,0.85)" }}>
          {icons.devtool} DevTool
        </Link>
      )}
    </aside>
  );
}
