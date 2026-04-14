"use client";

import React from "react";
import { usePathname } from "next/navigation";
import type { UserProfile } from "@/types";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import RightColumn from "@/components/RightColumn";

/**
 * Routes that use the new MainLayout (Indigo Scholar sidebar + header).
 * For these routes the root-level Navbar / old Sidebar / RightColumn are
 * intentionally suppressed to avoid a double-layout.
 */
const NEW_LAYOUT_PREFIXES = [
  "/dashboard",
  "/browse",
  "/settings",
  "/profile",
  "/upload",
  "/papers",
  "/syllabus",
  "/ai-content",
  "/study",
  "/about",
  "/support",
  "/store",
  "/stats",
  "/paper",
  "/admin",
  "/devtool",
  "/login",
  "/",
];

interface AppShellProps {
  user: UserProfile | null;
  children: React.ReactNode;
}

export default function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const usesNewLayout = NEW_LAYOUT_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (usesNewLayout) {
    // Pages that wrap themselves in MainLayout — just pass through children.
    return <>{children}</>;
  }

  return (
    <>
      <Navbar user={user} />
      <div className="dashboard-grid flex-1">
        <Sidebar user={user} />
        <main className="main-content flex-1 has-bottom-nav animate-page-in">
          {children}
          <Footer />
        </main>
        <RightColumn user={user} />
      </div>
      <BottomNav />
    </>
  );
}
