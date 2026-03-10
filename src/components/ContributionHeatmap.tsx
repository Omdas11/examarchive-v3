"use client";

interface ContributionHeatmapProps {
  /** Total uploads (used as a proxy for activity) */
  totalUploads: number;
  /** Total approved papers */
  approvedCount: number;
  /** Current streak days */
  streakDays: number;
  /** The user's last_activity date string */
  lastActivity: string;
}

/**
 * GitHub-style 30-day contribution heatmap.
 * Uses Forest Green shading from light to deep based on simulated activity.
 */
export default function ContributionHeatmap({
  totalUploads,
  approvedCount,
  streakDays,
  lastActivity,
}: ContributionHeatmapProps) {
  // Generate 30 cells representing the last 30 days
  const cells = generateCells(totalUploads, approvedCount, streakDays, lastActivity);

  const crimsons = [
    "var(--color-border)",                                                         // 0 = no activity
    "color-mix(in srgb, var(--brand-crimson) 15%, var(--color-surface))",          // 1 = light
    "color-mix(in srgb, var(--brand-crimson) 35%, var(--color-surface))",          // 2
    "color-mix(in srgb, var(--brand-crimson) 65%, var(--color-surface))",          // 3
    "var(--brand-crimson)",                                                        // 4 = deep
  ];

  return (
    <div>
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
        style={{ color: "var(--color-primary)" }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Contribution Activity (30 days)
      </h3>
      <div className="heatmap-grid">
        {cells.map((level, i) => (
          <div
            key={i}
            className="heatmap-cell"
            title={`Day ${30 - i}: ${level > 0 ? "Active" : "No activity"}`}
            style={{ background: crimsons[level] }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-1 mt-2 justify-end">
        <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Less</span>
        {crimsons.map((g, i) => (
          <div
            key={i}
            style={{ width: 10, height: 10, borderRadius: 2, background: g }}
          />
        ))}
        <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>More</span>
      </div>
    </div>
  );
}

/**
 * Generate 30 activity-level cells (0–4) based on available user data.
 * Since we don't have per-day upload history, we simulate based on streak
 * and total upload count as proxies.
 */
function generateCells(
  totalUploads: number,
  approvedCount: number,
  streakDays: number,
  lastActivity: string,
): number[] {
  const cells = new Array(30).fill(0);

  if (streakDays === 0 && totalUploads === 0) return cells;

  // Normalize to noon to avoid timezone and DST edge cases when computing day differences.
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const lastDate = lastActivity ? new Date(lastActivity) : new Date(now.getTime());
  lastDate.setHours(12, 0, 0, 0);
  const daysSinceLast = Math.max(0, Math.round((now.getTime() - lastDate.getTime()) / 86_400_000));

  // Mark streak days as active (most recent first).
  // When streakDays is 0 but lastActivity falls within the window, mark at
  // least that single day so a user with recent activity never sees a blank
  // heatmap just because their current streak reset.
  const activeDays =
    streakDays > 0
      ? Math.min(streakDays, 30)
      : lastActivity && daysSinceLast < 30
        ? 1
        : 0;
  for (let i = 0; i < activeDays; i++) {
    const cellIdx = daysSinceLast + i;
    if (cellIdx < 30) {
      // Intensity: more recent = higher; also scale by total uploads
      const recencyFactor = 1 - (i / 30);
      const uploadFactor = Math.min(totalUploads / 20, 1);
      const approvalFactor = approvedCount > 0 ? 0.5 : 0;
      const score = recencyFactor * 0.5 + uploadFactor * 0.3 + approvalFactor * 0.2;

      if (score > 0.7) cells[cellIdx] = 4;
      else if (score > 0.5) cells[cellIdx] = 3;
      else if (score > 0.3) cells[cellIdx] = 2;
      else cells[cellIdx] = 1;
    }
  }

  return cells;
}
