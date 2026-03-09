"use client";

import { useState, useMemo } from "react";
import type { AdminUser, ActivityLogEntry } from "@/types";
import { RoleBadge, TierBadge } from "./RoleBadge";
import RoleEditModal from "./RoleEditModal";
import ActivityLog from "./ActivityLog";
import { IconUpload, IconLightning, IconFire } from "@/components/Icons";

const PAGE_SIZE = 10;

interface UserManagementProps {
  users: AdminUser[];
  activityLogs: ActivityLogEntry[];
  currentAdminId: string;
}

export default function UserManagement({
  users: initialUsers,
  activityLogs,
  currentAdminId,
}: UserManagementProps) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sortNewest, setSortNewest] = useState(false);
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [viewingActivity, setViewingActivity] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...users];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.username && u.username.toLowerCase().includes(q)),
      );
    }

    if (roleFilter !== "all") {
      result = result.filter(
        (u) =>
          u.role === roleFilter ||
          u.primary_role === roleFilter ||
          u.secondary_role === roleFilter ||
          u.tertiary_role === roleFilter,
      );
    }

    if (tierFilter !== "all") {
      result = result.filter((u) => u.tier === tierFilter);
    }

    if (sortNewest) {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    return result;
  }, [users, search, roleFilter, tierFilter, sortNewest]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleUserSaved(updated: AdminUser) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setEditingUser(null);
  }

  const userActivityLogs = viewingActivity
    ? activityLogs.filter(
        (log) =>
          log.target_user_id === viewingActivity ||
          log.admin_id === viewingActivity,
      )
    : [];

  return (
    <>
      {/* Search and Filters */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name, username, or email…"
          className="input-field flex-1"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input-field sm:w-36"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="contributor">Contributor</option>
          <option value="student">Student</option>
        </select>
        <select
          className="input-field sm:w-36"
          value={tierFilter}
          onChange={(e) => {
            setTierFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Tiers</option>
          <option value="bronze">Bronze</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="platinum">Platinum</option>
          <option value="diamond">Diamond</option>
        </select>
        <button
          type="button"
          className={`toggle-btn ${sortNewest ? "active" : ""}`}
          onClick={() => {
            setSortNewest((n) => !n);
            setPage(1);
          }}
        >
          Newest First
        </button>
      </div>

      {/* Results count */}
      <p
        className="mt-3 text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        Showing {filtered.length} user{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Mobile: stacked cards (visible below sm) */}
      <div className="mt-3 flex flex-col gap-3 sm:hidden">
        {paginated.map((u) => (
          <div
            key={u.id}
            className="card p-4 space-y-2"
          >
            {/* Header row */}
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: "var(--color-primary)" }}
              >
                {(u.name || u.email).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                {u.name && (
                  <p className="text-sm font-semibold truncate">{u.name}</p>
                )}
                <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                  {u.email}
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1">
              <RoleBadge role={u.primary_role} />
              {u.secondary_role && <RoleBadge role={u.secondary_role} />}
              <TierBadge tier={u.tier} />
            </div>

            {/* Stats row */}
            <div className="flex gap-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <span className="inline-flex items-center gap-1">
                <IconUpload size={11} aria-hidden="true" /> {u.upload_count} uploads
              </span>
              {u.xp > 0 && (
                <span className="inline-flex items-center gap-1">
                  <IconLightning size={11} aria-hidden="true" /> {u.xp} XP
                </span>
              )}
              {u.streak_days > 0 && (
                <span className="inline-flex items-center gap-1">
                  <IconFire size={11} aria-hidden="true" /> {u.streak_days}d streak
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="btn text-[11px] px-3 py-1"
                onClick={() => setEditingUser(u)}
              >
                Edit Roles
              </button>
              <button
                type="button"
                className="btn text-[11px] px-3 py-1"
                style={{ color: "var(--color-text-muted)" }}
                onClick={() =>
                  setViewingActivity(viewingActivity === u.id ? null : u.id)
                }
              >
                Activity
              </button>
            </div>
          </div>
        ))}
        {paginated.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            No users found.
          </p>
        )}
      </div>

      {/* Desktop: table with sticky columns + zebra stripes (hidden below sm) */}
      <div className="mt-3 overflow-x-auto hidden sm:block">
        <table className="zebra-table sticky-col-table">
          <thead>
            <tr>
              <th style={{ minWidth: 180 }}>User</th>
              <th style={{ minWidth: 90 }}>Role</th>
              <th className="hidden md:table-cell">Badges</th>
              <th className="hidden lg:table-cell">Tier</th>
              <th className="hidden lg:table-cell">Uploads</th>
              <th className="hidden xl:table-cell">XP</th>
              <th className="hidden md:table-cell">Joined</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((u) => (
              <tr
                key={u.id}
                className="group"
              >
                <td>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: "var(--color-primary)" }}
                    >
                      {(u.name || u.email).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      {u.name && (
                        <p className="text-xs font-semibold truncate max-w-[140px]">{u.name}</p>
                      )}
                      <p className="text-xs truncate max-w-[180px]" style={{ color: u.name ? "var(--color-text-muted)" : undefined }}>
                        {u.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  <RoleBadge role={u.role} />
                </td>
                <td className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    <RoleBadge role={u.primary_role} />
                    {u.secondary_role && (
                      <RoleBadge role={u.secondary_role} />
                    )}
                    {u.tertiary_role && (
                      <RoleBadge role={u.tertiary_role} />
                    )}
                  </div>
                </td>
                <td className="hidden lg:table-cell">
                  <TierBadge tier={u.tier} />
                </td>
                <td className="hidden lg:table-cell">
                  {u.upload_count}
                </td>
                <td className="hidden xl:table-cell text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {u.xp}
                </td>
                <td
                  className="hidden md:table-cell text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {u.created_at
                    ? new Date(u.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </td>
                <td style={{ textAlign: "right" }}>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      className="rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
                      style={{
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                      onClick={() => setEditingUser(u)}
                      title="Edit Role & Tier"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
                      style={{
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-muted)",
                      }}
                      onClick={() =>
                        setViewingActivity(
                          viewingActivity === u.id ? null : u.id,
                        )
                      }
                      title="View Activity"
                    >
                      Activity
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="text-center text-sm"
                  style={{ color: "var(--color-text-muted)", padding: "2rem 0" }}
                >
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            className="btn text-xs"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn text-xs"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      )}

      {/* Activity viewer for selected user */}
      {viewingActivity && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Activity for{" "}
              {users.find((u) => u.id === viewingActivity)?.email ?? "User"}
            </h3>
            <button
              type="button"
              className="text-xs"
              style={{ color: "var(--color-primary)" }}
              onClick={() => setViewingActivity(null)}
            >
              Close
            </button>
          </div>
          <ActivityLog logs={userActivityLogs} />
        </div>
      )}

      {/* Role Edit Modal */}
      {editingUser && (
        <RoleEditModal
          user={editingUser}
          currentAdminId={currentAdminId}
          onClose={() => setEditingUser(null)}
          onSaved={handleUserSaved}
        />
      )}
    </>
  );
}
