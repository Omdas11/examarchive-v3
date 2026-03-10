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

/** Return the XP milestone label(s) earned for a given XP total. */
function xpMilestones(xp: number): string[] {
  const milestones: string[] = [];
  if (xp >= 1000) milestones.push("1,000 XP");
  else if (xp >= 500) milestones.push("500 XP");
  else if (xp >= 300) milestones.push("300 XP");
  else if (xp >= 150) milestones.push("150 XP");
  else if (xp >= 50) milestones.push("50 XP");
  return milestones;
}

/**
 * Generate a deterministic neutral background colour for avatar initials
 * based on the user's display name so each user gets a consistent but varied
 * colour instead of the same red placeholder for everyone.
 */
const AVATAR_PALETTE = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#0891b2", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#7c3aed", // purple
  "#0284c7", // sky
  "#047857", // green
  "#b45309", // yellow-brown
  "#9333ea", // fuchsia
];

function avatarColor(name: string): string {
  // djb2-style hash for better distribution than a simple multiply
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) >>> 0; // keep 32-bit unsigned
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
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
        <table className="zebra-table sticky-col-table min-w-full text-sm">
          <thead>
            <tr>
              <th className="whitespace-nowrap text-left text-xs font-semibold">User</th>
              <th className="whitespace-nowrap text-left text-xs font-semibold">Role</th>
              <th className="whitespace-nowrap text-left text-xs font-semibold">Community Badges</th>
              <th className="whitespace-nowrap text-right text-xs font-semibold">Uploads</th>
              <th className="whitespace-nowrap text-right text-xs font-semibold">XP</th>
              <th className="whitespace-nowrap text-left text-xs font-semibold">Achievements</th>
              <th className="whitespace-nowrap text-right text-xs font-semibold">Streak</th>
              <th className="whitespace-nowrap text-center text-xs font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const milestones = xpMilestones(u.xp);
              const displayName = u.name || u.username || u.email;

              return (
                <tr key={u.id}>
                  {/* User: avatar + name + @username stacked */}
                  <td>
                    <div className="flex items-center gap-3">
                      <AvatarRing
                        displayName={displayName}
                        avatarUrl={u.avatar_url || undefined}
                        streakDays={u.streak_days}
                        role={u.role}
                        size={36}
                        avatarBgColor={avatarColor(displayName)}
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

                  {/* Single authoritative role */}
                  <td className="whitespace-nowrap">
                    <RoleBadge role={u.role} />
                  </td>

                  {/* Community badges (secondary + tertiary) */}
                  <td className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {u.secondary_role ? <RoleBadge role={u.secondary_role} /> : null}
                      {u.tertiary_role ? <RoleBadge role={u.tertiary_role} /> : null}
                      {!u.secondary_role && !u.tertiary_role && (
                        <span style={{ color: "var(--color-text-muted)" }}>—</span>
                      )}
                    </div>
                  </td>

                  {/* Uploads (= approved papers) */}
                  <td className="whitespace-nowrap text-right font-medium text-sm">
                    {u.upload_count}
                  </td>

                  {/* XP */}
                  <td className="whitespace-nowrap text-right font-medium text-sm">
                    {u.xp.toLocaleString()}
                  </td>

                  {/* Achievements / XP milestones */}
                  <td>
                    {milestones.length > 0 || u.streak_days >= 30 ? (
                      <div className="flex flex-wrap gap-1">
                        {milestones.map((m) => (
                          <span
                            key={m}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: "#fef9c3", color: "#854d0e" }}
                          >
                            ★ {m}
                          </span>
                        ))}
                        {u.streak_days >= 30 && (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: "#dcfce7", color: "#14532d" }}
                          >
                            🔥 30d streak
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>—</span>
                    )}
                  </td>

                  {/* Streak */}
                  <td className="whitespace-nowrap text-right text-sm">
                    {u.streak_days > 0 ? `${u.streak_days}d` : <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                  </td>

                  {/* Actions */}
                  <td className="whitespace-nowrap text-center">
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
