"use client";

import { useState } from "react";
import type { AdminUser } from "@/types";
import { semesterShort } from "@/data/course-selection-data";
import { RoleBadge } from "@/components/RoleBadge";
import AvatarRing from "@/components/AvatarRing";
import RoleEditModal from "@/components/RoleEditModal";
import { IconStar } from "@/components/Icons";

interface UsersTableProps {
  users: AdminUser[];
  currentAdminId: string;
  currentAdminRole: string;
}

/** Return the XP milestone label(s) earned for a given score total. */
function xpMilestones(xp: number): string[] {
  const milestones: string[] = [];
  if (xp >= 1000) milestones.push("1,000 XP");
  else if (xp >= 500) milestones.push("500 XP");
  else if (xp >= 300) milestones.push("300 XP");
  else if (xp >= 150) milestones.push("150 XP");
  else if (xp >= 50) milestones.push("50 XP");
  return milestones;
}

function resolveXpTotal(user: AdminUser): number {
  if (Number.isFinite(user.xp)) return user.xp;
  return 0;
}

/**
 * Course prefs for the admin table, one value per paper slot, in
 * column order: DSC, DSM-1, DSM-2, SEC, IDC, AEC, VAC. Each column
 * shows the picked course or "—" when the user picked nothing for
 * that slot. `full` is the set courses only (used for hover titles).
 */
const COURSE_SLOT_LABELS = ["DSC", "DSM-1", "DSM-2", "SEC", "IDC", "AEC", "VAC"] as const;

function formatCoursePrefs(
  prefs: NonNullable<AdminUser["course_prefs"]>,
): { slots: string[]; full: string } {
  const values = [
    prefs.dsc,
    prefs.dsm1,
    prefs.dsm2,
    prefs.sec,
    prefs.idc,
    prefs.aec,
    prefs.vac,
  ];
  const slots = values.map((value) => (value ? value : "—"));
  const setSlots = COURSE_SLOT_LABELS.map((label, i) =>
    values[i] ? `${label} ${values[i]}` : "",
  ).filter(Boolean);
  return { slots, full: setSlots.join(" · ") || "No courses selected yet" };
}

/** Relative "last seen" label from an ISO timestamp ("5m ago", "3d ago"). */
function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const seen = new Date(iso).getTime();
  if (Number.isNaN(seen)) return "—";
  const diffMs = Date.now() - seen;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(seen).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Exact join date ("18 Nov 2026") from users.created_at, which is epoch
 * milliseconds in D1 but an ISO string on legacy Appwrite rows. */
function formatJoined(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const ms =
    typeof value === "number" || /^\d+$/.test(String(value))
      ? Number(value)
      : new Date(value).getTime();
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
        <table className="zebra-table sticky-col-table users-table-compact min-w-full text-sm">
          <thead>
            <tr>
              <th className="whitespace-nowrap text-left text-xs font-semibold">User</th>
              <th className="whitespace-nowrap text-left text-xs font-semibold">Role</th>
              <th className="whitespace-nowrap text-left text-xs font-semibold">Community Badges</th>
              <th className="whitespace-nowrap text-right text-xs font-semibold">Uploads</th>
              <th className="whitespace-nowrap text-right text-xs font-semibold">Verified</th>
              <th className="whitespace-nowrap text-right text-xs font-semibold">XP</th>
              <th className="whitespace-nowrap text-left text-xs font-semibold">Achievements</th>
              <th className="whitespace-nowrap text-right text-xs font-semibold">Streak</th>
              <th className="whitespace-nowrap text-left text-xs font-semibold">Seen</th>
              <th className="whitespace-nowrap text-left text-xs font-semibold">Joined</th>
              <th className="whitespace-nowrap text-left text-xs font-semibold">Semester</th>
              {COURSE_SLOT_LABELS.map((label) => (
                <th
                  key={label}
                  className="whitespace-nowrap text-left text-xs font-semibold"
                >
                  {label}
                </th>
              ))}
              <th className="whitespace-nowrap text-center text-xs font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const xpTotal = resolveXpTotal(u);
              const milestones = xpMilestones(xpTotal);
              const courses = u.course_prefs ? formatCoursePrefs(u.course_prefs) : null;
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

                  {/* Community badges (secondary + tertiary) — all
                      columns show on every screen size now; the table
                      scrolls sideways on narrower screens instead of
                      hiding columns. All 0/empty today. */}
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

                  {/* Verified (verify-to-earn) */}
                  <td className="whitespace-nowrap text-right font-medium text-sm">
                    {u.verified_count ?? 0}
                  </td>

                  {/* XP */}
                  <td className="whitespace-nowrap text-right font-medium text-sm">
                    {xpTotal.toLocaleString()}
                  </td>

                  {/* Achievements / XP milestones */}
                  <td className="whitespace-nowrap">
                    {milestones.length > 0 || u.streak_days >= 30 ? (
                      <div className="flex flex-wrap gap-1">
                        {milestones.map((m) => (
                          <span
                            key={m}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: "#fef9c3", color: "#854d0e" }}
                          >
                            <IconStar size={10} /> {m}
                          </span>
                        ))}
                        {u.streak_days >= 30 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: "#dcfce7", color: "#14532d" }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M12 2C9.5 6.5 9 9 11 12c-2-.5-3-2-3-2s0 5 4 7c-4-1-6-4-6-4s1 7 6 9c5.5 2 10-3 10-9a8 8 0 0 0-10-11z"/>
                            </svg>
                            30d streak
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

                  {/* Last seen: latest page visit / paper activity / login */}
                  <td
                    className="whitespace-nowrap text-sm"
                    title={u.last_seen_at ? new Date(u.last_seen_at).toLocaleString("en-IN") : "No recorded activity"}
                  >
                    {formatLastSeen(u.last_seen_at)}
                  </td>

                  {/* Joined: exact account creation date from users.created_at */}
                  <td
                    className="whitespace-nowrap text-sm"
                    title={
                      u.created_at
                        ? new Date(
                            typeof u.created_at === "number" || /^\d+$/.test(String(u.created_at))
                              ? Number(u.created_at)
                              : u.created_at,
                          ).toLocaleString("en-IN")
                        : "Join date unknown"
                    }
                  >
                    {formatJoined(u.created_at)}
                  </td>

                  {/* Current semester (users.semester, 1-8); "—" until the
                      user picks one in the course-setup modal. */}
                  <td
                    className="whitespace-nowrap text-sm font-medium"
                    title={u.semester ? `Semester ${u.semester}` : "Semester not set yet"}
                  >
                    {u.semester ? (
                      semesterShort(u.semester)
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>—</span>
                    )}
                  </td>

                  {/* Courses: one column per paper slot (DSC, DSM-1,
                      DSM-2, SEC, IDC, AEC, VAC); "—" when never set.
                      The old Department column duplicated DSC, so it
                      is gone. Every column shows on all screen sizes;
                      the table scrolls sideways on narrower screens. */}
                  {COURSE_SLOT_LABELS.map((label, i) => (
                    <td
                      key={label}
                      className="whitespace-nowrap text-sm"
                      title={
                        courses
                          ? `${label}: ${courses.slots[i] === "—" ? "not picked" : courses.slots[i]}`
                          : "No courses selected yet"
                      }
                    >
                      {courses ? (
                        courses.slots[i] === "—" ? (
                          <span style={{ color: "var(--color-text-muted)" }}>—</span>
                        ) : i === 0 ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{
                              background: "var(--color-accent-soft)",
                              color: "var(--color-primary)",
                              border: "1px solid rgba(211,39,62,0.2)",
                            }}
                          >
                            {courses.slots[i]}
                          </span>
                        ) : (
                          courses.slots[i]
                        )
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>—</span>
                      )}
                    </td>
                  ))}

                  {/* Actions */}
                  <td className="whitespace-nowrap text-center">
                    {(currentAdminRole === "moderator" || currentAdminRole === "founder") && u.id !== currentAdminId && (
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
