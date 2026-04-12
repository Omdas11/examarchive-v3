/**
 * Updated Dashboard Page Component
 * Demonstrates the integration of all new dashboard components
 * Based on Digital Curator Stitch design system
 *
 * Usage in app/dashboard/page.tsx:
 * import DigitalCuratorDashboard from '@/components/dashboard/DigitalCuratorDashboard';
 * export default DigitalCuratorDashboard;
 */

'use client';

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import DashboardCard from '@/components/dashboard/DashboardCard';
import ActivityLog, { type ActivityItem } from '@/components/dashboard/ActivityLog';
import RecommendationGrid from '@/components/dashboard/RecommendationGrid';
import { cn } from '@/lib/utils';
import { APP_SIDEBAR_ITEMS } from '@/components/layout/appSidebarItems';

interface DashboardStats {
  upload_count: number;
  pending_count: number;
  xp: number;
  streak_days: number;
  tier: string;
  recent_papers: Array<{
    id: string;
    title: string;
    course_code: string;
    year: number;
    semester: string;
    department: string;
    created_at: string;
  }>;
}

interface GenerationJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progressPercent: number;
  paperCode: string;
  unitNumber: number;
  resultPdfUrl: string | null;
  createdAt: string;
}

interface DigitalCuratorDashboardProps {
  /** Real user name passed from the server */
  userName?: string;
  /** Real user initials passed from the server */
  userInitials?: string;
  /** User role for sidebar filtering */
  userRole?: string;
}

const RECOMMENDATIONS = [
  {
    id: '1',
    title: 'Natural Language Processing',
    subtitle: 'Previous Year Question Paper (University of Oxford Archive)',
    tags: ['FE COMP', '2024 PREP'],
    views: 1200,
    priority: 'featured' as const,
  },
  {
    id: '2',
    title: 'Compiler Design Cheat Sheet',
    subtitle: 'Concise summary of Syntax Analysis & Code Optimization',
    tags: ['FE COMP', 'HANDWRITTEN'],
    views: 890,
  },
  {
    id: '3',
    title: 'Distributed Systems Guide',
    subtitle: 'Complete roadmap for system design interviews',
    tags: ['SYSTEM DESIGN', 'INTERVIEW'],
    views: 2100,
    isPremium: true,
  },
  {
    id: '4',
    title: 'Database Normalization Forms',
    subtitle: 'Detailed explanation of 1NF to BCNF',
    tags: ['DATABASE', '2024'],
    views: 567,
  },
];

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

function formatJobStatusLabel(job: GenerationJob): string {
  if (job.status === 'completed') return 'Completed';
  if (job.status === 'running') return `Running (${job.progressPercent}%)`;
  return job.status;
}

export default function DigitalCuratorDashboard({
  userName = 'Scholar',
  userInitials,
  userRole = 'user',
}: DigitalCuratorDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);

  // Derive initials from name if not provided
  const displayInitials = userInitials || userName.slice(0, 2).toUpperCase();
  // First name for greeting
  const firstName = userName.split(' ')[0] || userName;

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then((data: DashboardStats) => setStats(data))
      .catch((err) => { console.error('[Dashboard] Failed to load stats:', err); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/ai/jobs?limit=6')
      .then((r) => r.json())
      .then((data: { jobs?: GenerationJob[] }) => {
        if (Array.isArray(data.jobs)) {
          setGenerationJobs(data.jobs);
        }
      })
      .catch((err) => { console.error('[Dashboard] Failed to load generation jobs:', err); });
  }, []);

  // Build activity items from real recent papers
  const activityItems: ActivityItem[] = stats?.recent_papers?.length
    ? stats.recent_papers.map((paper) => ({
        id: paper.id,
        icon: 'upload_file',
        title: paper.title,
        description: `Approved and published to the archive.${paper.department ? ` Department: ${paper.department}` : ''}`,
        status: 'success',
        timestamp: `${relativeTime(paper.created_at)}${paper.semester ? ` • Semester ${paper.semester}` : ''}`,
        tags: [paper.course_code, paper.year ? String(paper.year) : ''].filter(Boolean),
      }))
    : [
        {
          id: 'placeholder',
          icon: 'upload_file',
          title: 'No uploads yet',
          description: 'Start contributing by uploading your first question paper.',
          status: 'info',
          timestamp: '',
          tags: [],
        },
      ];

  const uploadCount = stats?.upload_count ?? 0;
  const xp = stats?.xp ?? 0;
  const streakDays = stats?.streak_days ?? 0;
  const tier = stats?.tier ?? 'bronze';

  const STATS = [
    {
      label: 'Papers Uploaded',
      value: loading ? '–' : String(uploadCount),
      icon: 'upload_file',
      trend: stats?.pending_count ? `+${stats.pending_count} pending review` : 'Contribute more!',
    },
    {
      label: 'Scholar Points',
      value: loading ? '–' : xp.toLocaleString(),
      icon: 'star',
      trend: streakDays > 0 ? `${streakDays}-day streak` : 'Start your streak!',
    },
    {
      label: 'Activity Tier',
      value: loading ? '–' : tier.charAt(0).toUpperCase() + tier.slice(1),
      icon: 'verified',
      trend: 'Keep uploading to level up',
    },
    {
      label: 'Community Rank',
      value: xp >= 5000 ? 'Legend' : xp >= 3000 ? 'Elite' : xp >= 1500 ? 'Senior' : xp >= 800 ? 'Veteran' : xp >= 300 ? 'Contributor' : xp >= 100 ? 'Explorer' : 'Visitor',
      icon: 'emoji_events',
      trend: `${xp.toLocaleString()} total XP`,
    },
  ];

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <MainLayout
      title="Dashboard"
      breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Dashboard' }]}
      showSearch
      userInitials={displayInitials}
      userName={userName}
      notifications={stats?.pending_count ?? 0}
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
            Welcome back, {firstName}! 👋
          </h1>
          <p className="text-on-surface-variant">
            {uploadCount > 0
              ? `You have contributed ${uploadCount} paper${uploadCount === 1 ? '' : 's'} to the archive.`
              : 'Start contributing by uploading your first question paper.'}
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
          {/* Left Column: Activity Log */}
          <div className="lg:col-span-2 space-y-8">
            {/* Upload Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-br from-primary/5 to-primary-container/5 rounded-xl border border-primary/20">
                <p className="text-xs text-on-surface-variant font-bold uppercase mb-2">
                  Approved Papers
                </p>
                <p className="text-2xl font-bold text-primary">
                  {loading ? '–' : `${uploadCount} Paper${uploadCount === 1 ? '' : 's'}`}
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Verified by moderators
                </p>
              </div>

              <div className="p-4 bg-gradient-to-br from-secondary/5 to-secondary-container/5 rounded-xl border border-secondary/20">
                <p className="text-xs text-on-surface-variant font-bold uppercase mb-2">
                  Daily Streak
                </p>
                <p className="text-2xl font-bold text-secondary">
                  {loading ? '–' : `${streakDays} Day${streakDays === 1 ? '' : 's'}`}
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {streakDays > 0 ? 'Keep it going!' : 'Log in daily to build a streak'}
                </p>
              </div>

              <div className="p-4 bg-gradient-to-br from-tertiary/5 to-tertiary-container/5 rounded-xl border border-tertiary/20">
                <p className="text-xs text-on-surface-variant font-bold uppercase mb-2">
                  Scholar XP
                </p>
                <p className="text-2xl font-bold text-tertiary">
                  {loading ? '–' : xp.toLocaleString()}
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Upload more to earn XP
                </p>
              </div>
            </div>

            {/* Activity Log */}
            <ActivityLog
              items={activityItems}
              title="Recent Activity"
              maxItems={5}
            />
          </div>

          {/* Right Column: Quick Actions & Recommendations */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div>
              <h3 className="text-lg font-bold text-on-surface mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <a
                  href="/upload"
                  className={cn(
                    'w-full flex items-center gap-4 p-4',
                    'bg-surface-container-highest rounded-xl',
                    'hover:bg-primary hover:text-on-primary',
                    'transition-all duration-200 group'
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 group-hover:bg-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary group-hover:text-white">
                      upload_file
                    </span>
                  </div>
                  <span className="font-bold text-sm">Upload New Paper</span>
                </a>

                <a
                  href="/browse"
                  className={cn(
                    'w-full flex items-center gap-4 p-4',
                    'bg-surface-container-highest rounded-xl',
                    'hover:bg-surface-container transition-all duration-200'
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-secondary">
                      library_books
                    </span>
                  </div>
                  <span className="font-bold text-sm">Browse Library</span>
                </a>
              </div>
            </div>

            {/* Recommendations */}
            <RecommendationGrid
              items={RECOMMENDATIONS
                .filter(
                  (item) =>
                    !searchQuery ||
                    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()),
                )
                .slice(0, 2)}
              title="Suggested for You"
              isPro={true}
              columns={1}
            />

            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-4">
              <h4 className="text-sm font-bold text-on-surface">Job History</h4>
              {generationJobs.length === 0 ? (
                <p className="mt-2 text-xs text-on-surface-variant">No generation jobs yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {generationJobs.map((job) => (
                    <li key={job.id} className="rounded-lg border border-outline-variant/30 bg-surface p-2">
                      <p className="text-xs font-semibold text-on-surface">
                        {job.paperCode} · Unit {job.unitNumber}
                      </p>
                      <p className="text-[11px] text-on-surface-variant">
                        {formatJobStatusLabel(job)}
                      </p>
                      {job.resultPdfUrl ? (
                        <a className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline" href={job.resultPdfUrl}>
                          Download PDF
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* CTA Card */}
            <div
              className={cn(
                'p-6 rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-950',
                'text-white relative overflow-hidden group'
              )}
            >
              <div className="relative z-10">
                <h4 className="font-bold text-lg mb-2">Collaborate with Curators</h4>
                <p className="text-sm text-indigo-200 mb-4 leading-relaxed">
                  Join our elite moderation team and verify papers to earn exclusive badges.
                </p>
                <a
                  href="/profile"
                  className="inline-block px-4 py-2 bg-white text-indigo-900 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors"
                >
                  VIEW YOUR PROFILE
                </a>
              </div>

              {/* Decorative Icon */}
              <div className="absolute -right-8 -bottom-8 opacity-20 group-hover:opacity-40 transition-opacity transform group-hover:rotate-12 duration-300">
                <span
                  className="material-symbols-outlined text-[120px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_stories
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
