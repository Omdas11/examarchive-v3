"use client";

import { useState } from "react";
import type { AdminUser } from "@/types";
import { RoleBadge, TierBadge } from "@/components/RoleBadge";
import AvatarRing from "@/components/AvatarRing";
import RoleEditModal from "@/components/RoleEditModal";

interface UsersTableProps {
  users: AdminUser[];
  currentAdminId: string;
  currentAdminRole: string;
}

/** Format an ISO timestamp to IST (Asia/Kolkata). */
function toIST(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function UsersTable({ users, currentAdminId, currentAdminRole }: UsersTableProps) {
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [list, setList] = useState<AdminUser[]>(users);

  function handleUpdated(updated: AdminUser) {
    setList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setEditingUser(null);
  }

  if (list.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          No users found.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Horizontal-scroll wrapper for mobile */}
      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--color-border)" }}>
        <table className="min-w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Avatar</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Display Name</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Username</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Email</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Primary Role</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Secondary</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Tertiary</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Tier</th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>XP</th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Streak</th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Uploads</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Last Login (IST)</th>
              <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u, idx) => (
              <tr
                key={u.id}
                style={{
                  borderBottom: idx < list.length - 1 ? "1px solid var(--color-border)" : undefined,
                  background: "var(--color-bg)",
                }}
              >
                {/* Avatar */}
                <td className="px-4 py-3">
                  <AvatarRing
                    displayName={u.name || u.username || u.email}
                    avatarUrl={u.avatar_url || undefined}
                    streakDays={u.streak_days}
                    role={u.primary_role}
                    size={32}
                  />
                </td>

                {/* Display name */}
                <td className="whitespace-nowrap px-4 py-3 font-medium">
                  {u.name || <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                </td>

                {/* Username */}
                <td className="whitespace-nowrap px-4 py-3" style={{ color: "var(--color-text-muted)" }}>
                  {u.username ? `@${u.username}` : "—"}
                </td>

                {/* Email */}
                <td className="whitespace-nowrap px-4 py-3" style={{ color: "var(--color-text-muted)" }}>
                  <span title={u.email} className="max-w-[180px] block truncate">{u.email}</span>
                </td>

                {/* Primary Role */}
                <td className="whitespace-nowrap px-4 py-3">
                  <RoleBadge role={u.primary_role} />
                </td>

                {/* Secondary Role */}
                <td className="whitespace-nowrap px-4 py-3">
                  {u.secondary_role
                    ? <RoleBadge role={u.secondary_role} />
                    : <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                </td>

                {/* Tertiary Role */}
                <td className="whitespace-nowrap px-4 py-3">
                  {u.tertiary_role
                    ? <RoleBadge role={u.tertiary_role} />
                    : <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                </td>

                {/* Tier */}
                <td className="whitespace-nowrap px-4 py-3">
                  <TierBadge tier={u.tier} />
                </td>

                {/* XP */}
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs">
                  {u.xp.toLocaleString()}
                </td>

                {/* Streak */}
                <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                  {u.streak_days}d
                </td>

                {/* Upload count */}
                <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                  {u.upload_count}
                </td>

                {/* Last login (IST) */}
                <td className="whitespace-nowrap px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {toIST(u.last_login)}
                </td>

                {/* Actions */}
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  {currentAdminRole === "admin" && u.id !== currentAdminId && (
                    <button
                      onClick={() => setEditingUser(u)}
                      className="btn text-xs px-2 py-1"
                    >
                      Edit
                    </button>
                  )}
                  {(currentAdminRole === "founder") && u.id !== currentAdminId && (
                    <button
                      onClick={() => setEditingUser(u)}
                      className="btn text-xs px-2 py-1"
                    >
                      Edit
                    </button>
                  )}
                  {u.id === currentAdminId && (
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>You</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role edit modal */}
      {editingUser && (
        <RoleEditModal
          user={editingUser}
          currentAdminId={currentAdminId}
          onClose={() => setEditingUser(null)}
          onSaved={handleUpdated}
        />
      )}
    </>
  );
}
