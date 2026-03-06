"use client";

import { useState } from "react";
import type { Paper, AdminUser, ActivityLogEntry } from "@/types";
import AdminActions from "./AdminActions";
import UserManagement from "./UserManagement";
import ActivityLog from "./ActivityLog";

interface AdminDashboardProps {
  pending: Paper[];
  users: AdminUser[];
  activityLogs: ActivityLogEntry[];
  currentAdminId: string;
  currentAdminRole: string;
  stats: { label: string; value: number }[];
}

const TABS = ["Pending", "Users", "Activity Log"] as const;

export default function AdminDashboard({
  pending,
  users,
  activityLogs,
  currentAdminId,
  currentAdminRole,
  stats,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Pending");

  // Only admins should see the Users tab
  const visibleTabs =
    currentAdminRole === "admin"
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

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-2">
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

        {activeTab === "Users" && currentAdminRole === "admin" && (
          <>
            <h2 className="text-lg font-semibold">User Management</h2>
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
