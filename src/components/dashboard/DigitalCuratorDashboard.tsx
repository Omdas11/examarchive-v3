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

import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import DashboardCard from '@/components/dashboard/DashboardCard';
import ActivityLog, { type ActivityItem } from '@/components/dashboard/ActivityLog';
import RecommendationGrid from '@/components/dashboard/RecommendationGrid';
import { cn } from '@/lib/utils';
import { APP_SIDEBAR_ITEMS } from '@/components/layout/appSidebarItems';

const ACTIVITY_ITEMS: ActivityItem[] = [
  {
    id: '1',
    icon: 'upload_file',
    title: 'Advanced Machine Learning Solutions',
    description: 'Successfully added to the Public Archive. You earned 50 Scholar Points.',
    status: 'success',
    timestamp: '2 hours ago • Third Year Engineering',
    tags: ['CS 3050', 'Verified'],
  },
  {
    id: '2',
    icon: 'bookmark',
    title: 'Web Development Midterm Notes',
    description: 'Added to your Database Systems library.',
    status: 'info',
    timestamp: '1 day ago',
    tags: ['CS 2010'],
  },
  {
    id: '3',
    icon: 'download',
    title: 'System Design Interview Guide',
    description: 'Saved to your "Placement Prep" library collection.',
    status: 'pending',
    timestamp: '3 days ago',
    tags: ['Interview Prep'],
  },
];

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

const STATS = [
  {
    label: 'Papers Uploaded',
    value: '24',
    icon: 'upload_file',
    trend: '+3 this month',
  },
  {
    label: 'Scholar Points',
    value: '1,240',
    icon: 'star',
    trend: '+120 this week',
  },
  {
    label: 'Collections',
    value: '8',
    icon: 'bookmark',
    trend: '2 shared',
  },
  {
    label: 'Community Curator',
    value: 'Level 3',
    icon: 'verified',
    trend: '95% verified papers',
  },
];

export default function DigitalCuratorDashboard() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <MainLayout
      title="Dashboard"
      breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Dashboard' }]}
      showSearch
      userInitials="JD"
      userName="John Doe"
      notifications={2}
      onSearch={handleSearch}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole="curator"
    >
      {/* Main Content */}
      <div className="p-6 space-y-8 max-w-7xl">
        {/* Welcome Section */}
        <section>
          <h1 className="text-3xl font-bold text-on-surface mb-2">
            Welcome back, John! 👋
          </h1>
          <p className="text-on-surface-variant">
            You are 5 papers away from achieving Scholar Tier status.
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
            {/* Recent Upload Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-br from-primary/5 to-primary-container/5 rounded-xl border border-primary/20">
                <p className="text-xs text-on-surface-variant font-bold uppercase mb-2">
                  This Month
                </p>
                <p className="text-2xl font-bold text-primary">12 Papers</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  ↑ 40% from last month
                </p>
              </div>

              <div className="p-4 bg-gradient-to-br from-secondary/5 to-secondary-container/5 rounded-xl border border-secondary/20">
                <p className="text-xs text-on-surface-variant font-bold uppercase mb-2">
                  Verification Rate
                </p>
                <p className="text-2xl font-bold text-secondary">98.5%</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Highest on campus
                </p>
              </div>

              <div className="p-4 bg-gradient-to-br from-tertiary/5 to-tertiary-container/5 rounded-xl border border-tertiary/20">
                <p className="text-xs text-on-surface-variant font-bold uppercase mb-2">
                  Impact Score
                </p>
                <p className="text-2xl font-bold text-tertiary">8.2/10</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  ↑ Community helpful
                </p>
              </div>
            </div>

            {/* Activity Log */}
            <ActivityLog
              items={ACTIVITY_ITEMS}
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
                <button
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
                </button>

                <button
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
                </button>
              </div>
            </div>

            {/* Recommendation */}
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
                <button className="px-4 py-2 bg-white text-indigo-900 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors">
                  BECOME A CURATOR
                </button>
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
