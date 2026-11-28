/**
 * Dashboard — shows only real data from /api/dashboard/stats (D1).
 * No mock recommendations, no streak (nothing updates it), and no upload
 * prompts (uploads are team-only now). Header search goes to real search
 * on /browse instead of filtering a fake list.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import DashboardCard from '@/components/dashboard/DashboardCard';
import ActivityLog, { type ActivityItem } from '@/components/dashboard/ActivityLog';
import RecommendationGrid from '@/components/dashboard/RecommendationGrid';
import { cn } from '@/lib/utils';
import { APP_SIDEBAR_ITEMS } from '@/components/layout/appSidebarItems';
import { XP_TIERS } from '@/lib/roles';

interface DashboardStats {
  xp: number;
  tier: string;
  tier_label: string;
  next_tier_xp: number | null;
  next_tier_label: string | null;
  ai_credits: number;
  verifications_count: number;
  papers_total: number;
  syllabi_total: number;
  new_papers: Array<{
    id: string;
    title: string;
    course_code: string;
    year: number;
    semester: string;
    department: string;
    views: number;
  }>;
  recent_activity: Array<{
    action: string;
    title: string;
    href: string;
    paper_ref: string;
    created_at: string;
  }>;
}

interface DigitalCuratorDashboardProps {
  /** Real user name passed from the server */
  userName?: string;
  /** Real user initials passed from the server */
  userInitials?: string;
  /** User role for sidebar filtering */
  userRole?: string;
}

/** Format a relative timestamp from an ISO date string */
function relativeTime(isoDate: string): string {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } catch {
    return '';
  }
}

const QUICK_ACTIONS = [
  { href: '/browse', icon: 'library_books', label: 'Browse Library', chip: 'bg-secondary/10', iconColor: 'text-secondary' },
  { href: '/profile', icon: 'person', label: 'Your Profile', chip: 'bg-primary/10', iconColor: 'text-primary' },
  { href: '/maintenance-cost', icon: 'volunteer_activism', label: 'Maintenance Costs', chip: 'bg-tertiary/10', iconColor: 'text-tertiary' },
  { href: '/submit-paper', icon: 'upload_file', label: 'Submit a Paper', chip: 'bg-secondary/10', iconColor: 'text-secondary' },
];

export default function DigitalCuratorDashboard({
  userName = 'Scholar',
  userInitials,
  userRole = 'user',
}: DigitalCuratorDashboardProps) {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Derive initials from name if not provided
  const displayInitials = userInitials || userName.slice(0, 2).toUpperCase();
  // First name for greeting
  const firstName = userName.split(' ')[0] || userName;

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json() as Promise<DashboardStats>)
      .then((data: DashboardStats) => setStats(data))
      .catch((err) => { console.error('[Dashboard] Failed to load stats:', err); })
      .finally(() => setLoading(false));
  }, []);

  const xp = stats?.xp ?? 0;
  const tierLabel = stats?.tier_label ?? 'Bronze';
  const nextTierXp = stats?.next_tier_xp ?? null;
  const nextTierLabel = stats?.next_tier_label ?? null;
  const credits = stats?.ai_credits ?? 0;
  const verifications = stats?.verifications_count ?? 0;
  const papersTotal = stats?.papers_total ?? 0;
  const syllabiTotal = stats?.syllabi_total ?? 0;

  // XP progress toward the next tier (same ladder as /profile).
  const tierIdx = XP_TIERS.reduce((acc, t, i) => (xp >= t.xp ? i : acc), 0);
  const prevTierXp = XP_TIERS[tierIdx].xp;
  const xpProgress = nextTierXp
    ? Math.min(((xp - prevTierXp) / (nextTierXp - prevTierXp)) * 100, 100)
    : 100;

  // Real activity: the user's own views + downloads, newest first.
  const activityItems: ActivityItem[] = stats?.recent_activity?.length
    ? stats.recent_activity.map((a) => ({
        id: `${a.action}-${a.paper_ref}-${a.created_at}`,
        icon: a.action === 'download' ? 'download' : 'visibility',
        title: a.title,
        description: a.action === 'download' ? 'Downloaded from the archive.' : 'Viewed in the archive.',
        status: 'info',
        timestamp: relativeTime(new Date(a.created_at).toISOString()),
        tags: [a.paper_ref].filter(Boolean),
        actionUrl: a.href,
      }))
    : [
        {
          id: 'placeholder',
          icon: 'history',
          title: 'No activity yet',
          description: 'Papers you view or download will show up here.',
          status: 'info',
          timestamp: '',
          tags: [],
        },
      ];

  // Real suggestions: the newest papers in the archive.
  const suggestions = (stats?.new_papers ?? []).slice(0, 4).map((paper) => ({
    id: paper.id,
    title: paper.title,
    subtitle: `${paper.course_code}${paper.year ? ` · ${paper.year}` : ''}${paper.department ? ` · ${paper.department}` : ''}`,
    tags: [paper.course_code, paper.semester ? `Sem ${paper.semester}` : ''].filter(Boolean),
    views: paper.views,
    href: `/paper/${paper.id}`,
  }));

  const STATS = [
    {
      label: 'Scholar XP',
      value: loading ? '–' : xp.toLocaleString(),
      icon: 'star',
      trend: nextTierXp
        ? `${tierLabel} · ${nextTierXp - xp} XP to ${nextTierLabel}`
        : `${tierLabel} · top tier reached`,
    },
    {
      label: 'AI Credits',
      value: loading ? '–' : credits.toLocaleString(),
      icon: 'token',
      trend: '10 credits = 1 AI notes set',
    },
    {
      label: 'Papers in Archive',
      value: loading ? '–' : papersTotal.toLocaleString(),
      icon: 'library_books',
      trend: `${syllabiTotal} syllabi`,
    },
    {
      label: 'Papers Verified',
      value: loading ? '–' : verifications.toLocaleString(),
      icon: 'verified',
      trend: verifications > 0 ? 'Content checks you have done' : 'No verifications yet',
    },
  ];

  const handleSearch = (query: string) => {
    const q = query.trim();
    if (q) router.push(`/browse?search=${encodeURIComponent(q)}`);
  };

  return (
    <MainLayout
      title="Dashboard"
      breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Dashboard' }]}
      showSearch
      userInitials={displayInitials}
      userName={userName}
      onSearch={handleSearch}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={userRole}
      isLoggedIn={true}
    >
      {/* Main Content */}
      <div className="p-6 space-y-8 max-w-7xl">
        {/* Welcome Section */}
        <section>
          <h1 className="text-3xl font-bold text-on-surface mb-2">
            Welcome back, {firstName}!
          </h1>
          <p className="text-on-surface-variant">
            {loading
              ? 'Loading your stats…'
              : `${tierLabel} tier · ${credits} AI credits · ${papersTotal} papers in the archive.`}
          </p>
        </section>

        {/* Stats Grid */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((stat) => (
              <DashboardCard
                key={stat.label}
                icon={stat.icon}
                iconBg="primary"
                title={stat.label}
                value={stat.value}
                description={stat.trend}
              />
            ))}
          </div>
        </section>

        {/* Main Content Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: XP progress + Activity Log */}
          <div className="lg:col-span-2 space-y-8">
            {/* XP progress toward next tier */}
            <div className="p-4 bg-gradient-to-br from-primary/5 to-primary-container/5 rounded-xl border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-on-surface-variant font-bold uppercase">
                  {tierLabel} Tier
                </p>
                <p className="text-xs text-on-surface-variant font-bold">
                  {loading ? '–' : nextTierXp ? `${xp} / ${nextTierXp} XP` : `${xp} XP · top tier`}
                </p>
              </div>
              <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${loading ? 0 : xpProgress}%` }}
                />
              </div>
              <p className="text-xs text-on-surface-variant mt-2">
                {loading
                  ? ''
                  : nextTierXp
                    ? `${nextTierXp - xp} XP to ${nextTierLabel} — verify papers to earn XP.`
                    : 'You reached the top tier.'}
              </p>
            </div>

            {/* Activity Log */}
            <ActivityLog
              items={activityItems}
              title="Recent Activity"
              maxItems={5}
            />
          </div>

          {/* Right Column: Quick Actions, New Papers & Support CTA */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div>
              <h3 className="text-lg font-bold text-on-surface mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {QUICK_ACTIONS.map((action) => (
                  <a
                    key={action.href}
                    href={action.href}
                    className={cn(
                      'w-full flex items-center gap-4 p-4',
                      'bg-surface-container-highest rounded-xl',
                      'hover:bg-surface-container transition-all duration-200'
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', action.chip)}>
                      <span className={cn('material-symbols-outlined', action.iconColor)}>
                        {action.icon}
                      </span>
                    </div>
                    <span className="font-bold text-sm">{action.label}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Newest papers in the archive */}
            <RecommendationGrid
              items={suggestions}
              title="New in the archive"
              subtitle="The latest papers added to ExamArchive"
              columns={1}
            />

            {/* CTA Card — keep the site alive */}
            <div
              className={cn(
                'p-8 rounded-[2rem] gradient-primary',
                'text-white relative overflow-hidden group shadow-floating border border-white/10'
              )}
            >
              <div className="relative z-10">
                <h4 className="font-black text-xl mb-2 tracking-tight">Keep ExamArchive alive</h4>
                <p className="text-sm text-white/80 mb-6 leading-relaxed font-medium">
                  The domain costs ₹2,201.37 a year, due 27 Jan 2027. Support from ₹20 keeps the archive running for every student.
                </p>
                <a
                  href="/maintenance-cost"
                  className="inline-block px-6 py-2.5 bg-white text-primary rounded-full text-[10px] font-black uppercase tracking-widest hover:shadow-lg transition-all active:scale-95"
                >
                  SUPPORT THE SITE
                </a>
              </div>

              {/* Decorative Icon */}
              <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:rotate-12 duration-300">
                <span
                  className="material-symbols-outlined text-[140px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  volunteer_activism
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
