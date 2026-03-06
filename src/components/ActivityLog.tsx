"use client";

import type { ActivityLogEntry } from "@/types";

const ACTION_LABELS: Record<ActivityLogEntry["action"], { label: string; color: string }> = {
  approve: { label: "Approved", color: "#2e7d32" },
  reject: { label: "Rejected", color: "#d32f2f" },
  role_change: { label: "Role Change", color: "#1565c0" },
  tier_change: { label: "Tier Change", color: "#6a1b9a" },
};

interface ActivityLogProps {
  logs: ActivityLogEntry[];
}

export default function ActivityLog({ logs }: ActivityLogProps) {
  if (logs.length === 0) {
    return (
      <div className="mt-6 text-center card p-8">
        <svg
          className="mx-auto h-10 w-10 opacity-30 mb-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <p
          className="text-sm font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          No activity logged yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {logs.map((log) => {
        const meta = ACTION_LABELS[log.action] ?? ACTION_LABELS.approve;
        return (
          <div key={log.id} className="card p-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shrink-0"
                  style={{ background: meta.color }}
                >
                  {meta.label}
                </span>
                <span className="text-sm truncate">{log.details}</span>
              </div>
              <div
                className="flex items-center gap-3 text-[11px] shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              >
                <span>by {log.admin_email}</span>
                <span>
                  {new Date(log.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
