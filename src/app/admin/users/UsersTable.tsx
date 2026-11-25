"use client";

import { useState, useEffect, useRef } from "react";
import type { AdminUser } from "@/types";
import { semesterShort } from "@/data/course-selection-data";
import { RoleBadge } from "@/components/RoleBadge";
import AvatarRing from "@/components/AvatarRing";
import RoleEditModal from "@/components/RoleEditModal";
import { IconStar, IconGear } from "@/components/Icons";

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

/** Columns the admin can show/hide from the gear menu, in table order. */
const ALL_COLUMNS = [
  { id: "user", label: "User" },
  { id: "role", label: "Role" },
  { id: "badges", label: "Community Badges" },
  { id: "uploads", label: "Uploads" },
  { id: "verified", label: "Verified" },
  { id: "xp", label: "XP" },
  { id: "achievements", label: "Achievements" },
  { id: "streak", label: "Streak" },
  { id: "seen", label: "Seen" },
  { id: "joined", label: "Joined" },
  { id: "semester", label: "Semester" },
  { id: "dsc", label: "DSC" },
  { id: "dsm1", label: "DSM-1" },
  { id: "dsm2", label: "DSM-2" },
  { id: "sec", label: "SEC" },
  { id: "idc", label: "IDC" },
  { id: "aec", label: "AEC" },
  { id: "vac", label: "VAC" },
  { id: "actions", label: "Actions" },
] as const;
type ColumnId = (typeof ALL_COLUMNS)[number]["id"];
const COURSE_COLUMN_IDS: ColumnId[] = ["dsc", "dsm1", "dsm2", "sec", "idc", "aec", "vac"];
/** localStorage key for the admin's saved column + email view. */
const TABLE_PREFS_KEY = "ea_admin_users_table_v1";

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

  // Column visibility + email toggle, saved in localStorage so the admin's
  // view survives reloads. Defaults: every column shown, email shown.
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnId>>(new Set());
  const [showEmail, setShowEmail] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TABLE_PREFS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { hidden?: string[]; showEmail?: boolean };
        if (Array.isArray(saved.hidden)) {
          setHiddenColumns(
            new Set(
              saved.hidden.filter((id): id is ColumnId =>
                ALL_COLUMNS.some((c) => c.id === id),
              ),
            ),
          );
        }
        if (typeof saved.showEmail === "boolean") setShowEmail(saved.showEmail);
      }
    } catch {
      // Corrupt prefs are ignored; defaults apply.
    }
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem(
        TABLE_PREFS_KEY,
        JSON.stringify({ hidden: [...hiddenColumns], showEmail }),
      );
    } catch {
      // Storage full/blocked — the view still works for this session.
    }
  }, [hiddenColumns, showEmail, prefsLoaded]);

  const isVisible = (id: ColumnId) => !hiddenColumns.has(id);
  const toggleColumn = (id: ColumnId) =>
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const visibleCount = ALL_COLUMNS.length - hiddenColumns.size;

  // Top scrollbar: a thin overflow-x strip above the table whose scroll
  // position mirrors the table wrapper's, so the table can be scrolled
  // from the top as well as the bottom.
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topSpacerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const syncWidth = () => {
      const table = tableScrollRef.current?.querySelector("table");
      if (topSpacerRef.current && table) {
        topSpacerRef.current.style.width = `${table.scrollWidth}px`;
      }
    };
    syncWidth();
    window.addEventListener("resize", syncWidth);
    return () => window.removeEventListener("resize", syncWidth);
  }, [list, hiddenColumns, showEmail]);

  const handleTopScroll = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (tableScrollRef.current && topScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };
  const handleTableScroll = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (tableScrollRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

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
      {/* View settings: gear menu on the right to show/hide columns
          and the email line, plus a "Show all" reset. */}
      <div className="mb-3 flex items-center justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Table settings"
            title="Table settings — show or hide columns"
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            <IconGear size={16} />
            <span>Columns</span>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {visibleCount}/{ALL_COLUMNS.length}
            </span>
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close table settings"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
                style={{ background: "transparent" }}
              />
              <div
                className="absolute right-0 z-20 mt-2 w-64 rounded-lg border p-3 shadow-lg"
                style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
              >
                <p className="mb-2 text-xs font-semibold">Show email addresses</p>
                <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showEmail}
                    onChange={(e) => setShowEmail(e.target.checked)}
                  />
                  Email in User column
                </label>
                <hr className="my-2" style={{ borderColor: "var(--color-border)" }} />
                <p className="mb-2 text-xs font-semibold">Visible columns</p>
                <div className="max-h-64 overflow-y-auto pr-1">
                  {ALL_COLUMNS.map((col) => (
                    <label key={col.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={isVisible(col.id)}
                        onChange={() => toggleColumn(col.id)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
                <hr className="my-2" style={{ borderColor: "var(--color-border)" }} />
                <button
                  type="button"
                  onClick={() => setHiddenColumns(new Set())}
                  className="btn w-full text-xs"
                >
                  Show all columns
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top scrollbar — mirrors the table's horizontal scroll */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto"
        style={{ height: "16px" }}
      >
        <div ref={topSpacerRef} style={{ height: "1px" }} />
      </div>

      {/* Horizontal-scroll wrapper for mobile */}
      <div
        ref={tableScrollRef}
        onScroll={handleTableScroll}
        className="overflow-x-auto rounded-lg"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <table className="zebra-table sticky-col-table users-table-compact min-w-full text-sm">
          <thead>
            <tr>
              {isVisible("user") && <th className="whitespace-nowrap text-left text-xs font-semibold">User</th>}
              {isVisible("role") && <th className="whitespace-nowrap text-left text-xs font-semibold">Role</th>}
              {isVisible("badges") && <th className="whitespace-nowrap text-left text-xs font-semibold">Community Badges</th>}
              {isVisible("uploads") && <th className="whitespace-nowrap text-right text-xs font-semibold">Uploads</th>}
              {isVisible("verified") && <th className="whitespace-nowrap text-right text-xs font-semibold">Verified</th>}
              {isVisible("xp") && <th className="whitespace-nowrap text-right text-xs font-semibold">XP</th>}
              {isVisible("achievements") && <th className="whitespace-nowrap text-left text-xs font-semibold">Achievements</th>}
              {isVisible("streak") && <th className="whitespace-nowrap text-right text-xs font-semibold">Streak</th>}
              {isVisible("seen") && <th className="whitespace-nowrap text-left text-xs font-semibold">Seen</th>}
              {isVisible("joined") && <th className="whitespace-nowrap text-left text-xs font-semibold">Joined</th>}
              {isVisible("semester") && <th className="whitespace-nowrap text-left text-xs font-semibold">Semester</th>}
              {COURSE_SLOT_LABELS.map((label, i) =>
                isVisible(COURSE_COLUMN_IDS[i]) && (
                <th
                  key={label}
                  className="whitespace-nowrap text-left text-xs font-semibold"
                >
                  {label}
                </th>
                ),
              )}
              {isVisible("actions") && <th className="whitespace-nowrap text-center text-xs font-semibold">Actions</th>}
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
                  {isVisible("user") && (
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
                          {u.username ? `@${u.username}` : showEmail ? u.email : "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  )}

                  {/* Single authoritative role */}
                  {isVisible("role") && (
                  <td className="whitespace-nowrap">
                    <RoleBadge role={u.role} />
                  </td>
                  )}

                  {/* Community badges (secondary + tertiary). Hidden
                      from the gear menu like any other column. */}
                  {isVisible("badges") && (
                  <td className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {u.secondary_role ? <RoleBadge role={u.secondary_role} /> : null}
                      {u.tertiary_role ? <RoleBadge role={u.tertiary_role} /> : null}
                      {!u.secondary_role && !u.tertiary_role && (
                        <span style={{ color: "var(--color-text-muted)" }}>—</span>
                      )}
                    </div>
                  </td>
                  )}

                  {/* Uploads (= approved papers) */}
                  {isVisible("uploads") && (
                  <td className="whitespace-nowrap text-right font-medium text-sm">
                    {u.upload_count}
                  </td>
                  )}

                  {/* Verified (verify-to-earn) */}
                  {isVisible("verified") && (
                  <td className="whitespace-nowrap text-right font-medium text-sm">
                    {u.verified_count ?? 0}
                  </td>
                  )}

                  {/* XP */}
                  {isVisible("xp") && (
                  <td className="whitespace-nowrap text-right font-medium text-sm">
                    {xpTotal.toLocaleString()}
                  </td>
                  )}

                  {/* Achievements / XP milestones */}
                  {isVisible("achievements") && (
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
                  )}

                  {/* Streak */}
                  {isVisible("streak") && (
                  <td className="whitespace-nowrap text-right text-sm">
                    {u.streak_days > 0 ? `${u.streak_days}d` : <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                  </td>
                  )}

                  {/* Last seen: latest page visit / paper activity / login */}
                  {isVisible("seen") && (
                  <td
                    className="whitespace-nowrap text-sm"
                    title={u.last_seen_at ? new Date(u.last_seen_at).toLocaleString("en-IN") : "No recorded activity"}
                  >
                    {formatLastSeen(u.last_seen_at)}
                  </td>
                  )}

                  {/* Joined: exact account creation date from users.created_at */}
                  {isVisible("joined") && (
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
                  )}

                  {/* Current semester (users.semester, 1-8); "—" until the
                      user picks one in the course-setup modal. */}
                  {isVisible("semester") && (
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
                  )}

                  {/* Courses: one column per paper slot (DSC, DSM-1,
                      DSM-2, SEC, IDC, AEC, VAC); "—" when never set.
                      The old Department column duplicated DSC, so it
                      is gone. Every column shows on all screen sizes;
                      the table scrolls sideways on narrower screens. */}
                  {COURSE_SLOT_LABELS.map((label, i) =>
                    isVisible(COURSE_COLUMN_IDS[i]) && (
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
                    ),
                  )}

                  {/* Actions */}
                  {isVisible("actions") && (
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
                  )}
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
