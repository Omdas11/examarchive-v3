"use client";

import { useState } from "react";
import type { AdminUser } from "@/types";
import { RoleBadge } from "@/components/RoleBadge";
import AvatarRing from "@/components/AvatarRing";
import RoleEditModal from "@/components/RoleEditModal";

interface UsersTableProps {
  users: AdminUser[];
  currentAdminId: string;
  currentAdminRole: string;
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
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>User</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Primary Role</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Secondary Role</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Tertiary Role</th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Uploads</th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Approved</th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Approval %</th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>XP</th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Streak</th>
              <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u, idx) => {
              // upload_count = approved papers (incremented on approval in v3 gamification).
              // Without a separate total_uploads counter we can't compute an accurate
              // approval %, so we show the approved count and "—" for the percentage.
              const approved = u.upload_count;

              return (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: idx < list.length - 1 ? "1px solid var(--color-border)" : undefined,
                    background: "var(--color-bg)",
                  }}
                >
                  {/* User: avatar + name + @username stacked */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <AvatarRing
                        displayName={u.name || u.username || u.email}
                        avatarUrl={u.avatar_url || undefined}
                        streakDays={u.streak_days}
                        role={u.primary_role}
                        size={36}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate max-w-[140px]">
                          {u.name || <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                        </p>
                        <p className="text-xs truncate max-w-[140px]" style={{ color: "var(--color-text-muted)" }}>
                          {u.username ? `@${u.username}` : u.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Primary Role */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <RoleBadge role={u.primary_role} />
                  </td>

                  {/* Secondary Role */}
                  <td className="whitespace-nowrap px-4 py-3">
                    {u.secondary_role ? <RoleBadge role={u.secondary_role} /> : <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                  </td>

                  {/* Tertiary Role */}
                  <td className="whitespace-nowrap px-4 py-3">
                    {u.tertiary_role ? <RoleBadge role={u.tertiary_role} /> : <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                  </td>

                  {/* Uploads (= approved papers; v3 tracks upload_count on approval) */}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-sm">
                    {approved}
                  </td>

                  {/* Approved */}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-sm">
                    {approved}
                  </td>

                  {/* Approval % – requires total_uploads which is not stored per-user */}
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm" style={{ color: "var(--color-text-muted)" }}>
                    —
                  </td>

                  {/* XP */}
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-sm">
                    {u.xp.toLocaleString()}
                  </td>

                  {/* Streak */}
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    {u.streak_days > 0 ? `${u.streak_days}d` : <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                  </td>

                  {/* Actions */}
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    {(currentAdminRole === "admin" || currentAdminRole === "founder") && u.id !== currentAdminId && (
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
              );
            })}
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
