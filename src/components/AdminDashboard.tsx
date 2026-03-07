"use client";

import { useState } from "react";
import Link from "next/link";
import type { Paper, AdminUser, ActivityLogEntry, Syllabus } from "@/types";
import AdminActions from "./AdminActions";
import UserManagement from "./UserManagement";
import ActivityLog from "./ActivityLog";
import SyllabusModeration from "./SyllabusModeration";

interface AdminDashboardProps {
  pending: Paper[];
  pendingSyllabi: Syllabus[];
  users: AdminUser[];
  activityLogs: ActivityLogEntry[];
  currentAdminId: string;
  currentAdminRole: string;
  stats: { label: string; value: number }[];
}

const TABS = ["Pending", "Syllabus", "Users", "Activity Log"] as const;

export default function AdminDashboard({
  pending,
  pendingSyllabi,
  users,
  activityLogs,
  currentAdminId,
  currentAdminRole,
  stats,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Pending");

  // Only admins + moderators should see the Users tab
  const visibleTabs =
    currentAdminRole === "admin" || currentAdminRole === "moderator"
      ? TABS
      : TABS.filter((t) => t !== "Users");

  return (
    <>
      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p
              className="text-2xl font-bold"
              style={{ color: "var(--color-primary)" }}
            >
              {s.value}
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      {(currentAdminRole === "admin" || currentAdminRole === "moderator") && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/admin/users" className="btn text-xs">
            <svg width="14" height="14" className="mr-1.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            User Management
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
          <button
            key={t}
            type="button"
            className={`toggle-btn ${activeTab === t ? "active" : ""}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === "Pending" && (
          <>
            <h2 className="text-lg font-semibold">Pending Approvals</h2>
            <AdminActions papers={pending} />
          </>
        )}

        {activeTab === "Syllabus" && (
          <>
            <h2 className="text-lg font-semibold">Syllabus Moderation</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
              Review and approve or reject pending syllabus uploads.
            </p>
            <SyllabusModeration syllabi={pendingSyllabi} />
          </>
        )}

        {activeTab === "Users" && (currentAdminRole === "admin" || currentAdminRole === "moderator") && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">User Management</h2>
              <Link href="/admin/users" className="btn text-xs">
                Open full page →
              </Link>
            </div>
            <UserManagement
              users={users}
              activityLogs={activityLogs}
              currentAdminId={currentAdminId}
            />
          </>
        )}

        {activeTab === "Activity Log" && (
          <>
            <h2 className="text-lg font-semibold">Activity Log</h2>
            <ActivityLog logs={activityLogs} />
          </>
        )}
      </div>
    </>
  );
}
