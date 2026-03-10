"use client";

import type { UserProfile } from "@/types";
import { Icon } from "@/components/Icons";

interface RightColumnProps {
  user: UserProfile | null;
}

/** Platform Stats widget */
function PlatformStats() {
  return (
    <div className="card p-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--nav-teal)" }}
      >
        Platform Stats
      </h3>
      <div className="space-y-2 text-sm">
        {[
          { label: "Papers", icon: "file" as const },
          { label: "Syllabi", icon: "books" as const },
          { label: "Users", icon: "user" as const },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between py-1"
          >
            <span
              className="flex items-center gap-2"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Icon name={stat.icon} size={14} aria-hidden="true" />
              {stat.label}
            </span>
            <span className="skeleton" style={{ width: 40, height: 16, display: "inline-block" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Popular Subjects tag cloud */
function PopularSubjects() {
  const subjects = [
    "Physics", "Chemistry", "Mathematics", "Biology",
    "Computer Science", "Economics", "English",
    "History", "Geography",
  ];

  return (
    <div className="card p-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--nav-teal)" }}
      >
        Popular Subjects
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((s) => (
          <span
            key={s}
            className="inline-block rounded-full px-2.5 py-1 text-[11px] font-medium cursor-default"
            style={{
              background: "color-mix(in srgb, var(--nav-teal) 8%, var(--color-surface))",
              color: "var(--nav-teal)",
              border: "1px solid color-mix(in srgb, var(--nav-teal) 15%, transparent)",
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Daily Streak mini-widget */
function StreakWidget({ user }: { user: UserProfile }) {
  const days = user.streak_days;

  return (
    <div className="card p-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
        style={{ color: "var(--brand-crimson)" }}
      >
        <Icon name="fire" size={14} aria-hidden="true" />
        Daily Streak
      </h3>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold">{days}</span>
        <span
          className="text-xs font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          day{days !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
        Keep uploading to maintain your streak!
      </p>
    </div>
  );
}

export default function RightColumn({ user }: RightColumnProps) {
  return (
    <div className="right-col">
      <PlatformStats />
      <PopularSubjects />
      {user && <StreakWidget user={user} />}
    </div>
  );
}
