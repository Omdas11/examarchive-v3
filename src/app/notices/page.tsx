import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth-cf";
import { getNotices } from "@/lib/notices-cache";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "Official Notices — Assam University & HGC — ExamArchive",
  description:
    "Official notices from Assam University (examination portal) and Haflong Government College — exam programmes, results, admissions and college notices, with links to the official PDFs.",
  alternates: { canonical: "/notices" },
};

const CATEGORY_LABELS: Record<string, string> = {
  exam: "Exam",
  results: "Results",
  admission: "Admission",
  college: "College",
};

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  exam: { color: "#047857", bg: "#059669" },
  results: { color: "#0369a1", bg: "#0284c7" },
  admission: { color: "#6d28d9", bg: "#7c3aed" },
  college: { color: "#b45309", bg: "#d97706" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export default async function NoticesPage() {
  const user = await getServerUser();
  const userName = user ? user.name || user.username || "Scholar" : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  let notices: Awaited<ReturnType<typeof getNotices>> = [];
  try {
    notices = await getNotices();
  } catch {
    notices = [];
  }

  const ausCount = notices.filter((n) => n.source === "AUS").length;
  const hgcCount = notices.filter((n) => n.source === "HGC").length;

  return (
    <MainLayout
      title="Notices"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Notices" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <h1 style={{ margin: "0 0 0.5rem" }}>Official Notices</h1>
        <p className="mt-0 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          The latest official notices from Assam University and Haflong
          Government College — exam programmes, results, admissions and
          college notices. Every notice links to the official PDF on the
          university or college website.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ color: "#047857", background: "color-mix(in srgb, #059669 12%, var(--color-surface))" }}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">campaign</span>
            {notices.length} notices
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ color: "#047857", background: "color-mix(in srgb, #059669 12%, var(--color-surface))" }}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">school</span>
            {ausCount} Assam University
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ color: "#0369a1", background: "color-mix(in srgb, #0284c7 12%, var(--color-surface))" }}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">domain</span>
            {hgcCount} Haflong Govt College
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {notices.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              No notices yet. Check back soon — new notices appear here as
              soon as the university or college publishes them.
            </p>
          )}
          {notices.map((notice) => {
            const cat = notice.category ?? "college";
            const catStyle = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.college;
            const isAus = notice.source === "AUS";
            return (
              <a
                key={notice.id}
                href={notice.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border p-4 no-underline"
                style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
              >
                <span className="flex items-start gap-3">
                  <span
                    className="material-symbols-outlined mt-0.5 shrink-0"
                    style={{ color: isAus ? "#047857" : "#0369a1" }}
                    aria-hidden="true"
                  >
                    {isAus ? "school" : "domain"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-sm font-semibold leading-snug"
                      style={{ color: "var(--color-text)" }}
                    >
                      {notice.title}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          color: isAus ? "#047857" : "#0369a1",
                          background: isAus
                            ? "color-mix(in srgb, #059669 12%, var(--color-surface))"
                            : "color-mix(in srgb, #0284c7 12%, var(--color-surface))",
                        }}
                      >
                        {isAus ? "Assam University" : "Haflong Govt College"}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          color: catStyle.color,
                          background: `color-mix(in srgb, ${catStyle.bg} 12%, var(--color-surface))`,
                        }}
                      >
                        {CATEGORY_LABELS[cat] ?? "College"}
                      </span>
                      {notice.notice_date && (
                        <span
                          className="inline-flex items-center gap-1 text-xs"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">
                            calendar_month
                          </span>
                          {formatDate(notice.notice_date)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span
                    className="material-symbols-outlined mt-0.5 shrink-0"
                    style={{ color: "var(--color-text-muted)" }}
                    aria-hidden="true"
                  >
                    open_in_new
                  </span>
                </span>
              </a>
            );
          })}
        </div>

        <p className="mt-6 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Notices are copied from the official Assam University examination
          portal (ausexamination.ac.in) and the Haflong Government College
          website. Always read the official PDF — this page only links to it.
        </p>
      </section>
    </MainLayout>
  );
}
