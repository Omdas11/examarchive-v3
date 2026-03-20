/**
 * Browse Page Example
 * Demonstrates using layout and dashboard components for a listing page
 *
 * This is a template example showing how to integrate the new
 * Digital Curator components into existing pages.
 */

'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import DashboardCard from '@/components/dashboard/DashboardCard';
import RecommendationGrid from '@/components/dashboard/RecommendationGrid';
import { cn } from '@/lib/utils';

const SIDEBAR_ITEMS = [
  {
    label: 'Dashboard',
    icon: 'dashboard',
    href: '/dashboard',
  },
  {
    label: 'Browse Papers',
    icon: 'library_books',
    href: '/browse',
  },
  {
    label: 'My Collections',
    icon: 'bookmark',
    href: '/collections',
    badge: 3,
  },
  {
    label: 'Upload Paper',
    icon: 'upload_file',
    href: '/upload',
  },
  {
    label: 'My Profile',
    icon: 'person',
    href: '/profile',
  },
];

interface PaperItem {
  id: string;
  title: string;
  author: string;
  course: string;
  year: number;
  views: number;
  downloads: number;
  verified: boolean;
  university: string;
  category: string;
}

const FEATURED_PAPERS: PaperItem[] = [
  {
    id: '1',
    title: 'Distributed Systems Design Patterns',
    author: 'Dr. Sarah Chen',
    course: 'CS 3050 - Advanced Systems',
    year: 2024,
    views: 3400,
    downloads: 850,
    verified: true,
    university: 'Stanford University',
    category: 'Lecture Notes',
  },
  {
    id: '2',
    title: 'Machine Learning for Financial Markets',
    author: 'Prof. James Wilson',
    course: 'FIN 4200 - Computational Finance',
    year: 2024,
    views: 2100,
    downloads: 520,
    verified: true,
    university: 'MIT',
    category: 'Research Paper',
  },
  {
    id: '3',
    title: 'Quantum Computing Fundamentals',
    author: 'Dr. Anita Patel',
    course: 'CS 4890 - Quantum Algorithms',
    year: 2024,
    views: 1850,
    downloads: 310,
    verified: true,
    university: 'UC Berkeley',
    category: 'Textbook Chapter',
  },
  {
    id: '4',
    title: 'Natural Language Processing Applications',
    author: 'Prof. Michael Zhang',
    course: 'NLP 3100 - Deep Learning for NLP',
    year: 2024,
    views: 5200,
    downloads: 1340,
    verified: true,
    university: 'Oxford University',
    category: 'Tutorial',
  },
];

export default function BrowsePageExample() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('trending');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', 'Lecture Notes', 'Research Papers', 'Tutorial', 'Exam Papers'];

  const filteredPapers = FEATURED_PAPERS.filter(paper => {
    const matchesCategory = !selectedCategory || paper.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paper.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedPapers = [...filteredPapers].sort((a, b) => {
    if (sortBy === 'trending') return b.views - a.views;
    if (sortBy === 'popular') return b.downloads - a.downloads;
    if (sortBy === 'recent') return b.year - a.year;
    return 0;
  });

  return (
    <MainLayout
      title="Browse Papers"
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Browse Papers' }
      ]}
      showSearch
      userInitials="JD"
      userName="John Doe"
      sidebarItems={SIDEBAR_ITEMS}
      userRole="user"
      onSearch={(query) => setSearchQuery(query)}
    >
      {/* Browse Header Section */}
      <div className="bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent border-b border-outline-variant/10">
        <div className="p-6 space-y-4 max-w-7xl">
          <div>
            <h1 className="text-3xl font-bold text-on-surface mb-2">
              Explore Academic Papers
            </h1>
            <p className="text-on-surface-variant">
              Discover verified papers, notes, and resources from curators worldwide
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-surface/50 rounded-lg">
              <span className="material-symbols-outlined text-primary text-2xl">
                library_books
              </span>
              <div>
                <p className="text-xs text-on-surface-variant">Total Papers</p>
                <p className="text-lg font-bold text-on-surface">12,847</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-surface/50 rounded-lg">
              <span className="material-symbols-outlined text-secondary text-2xl">
                verified
              </span>
              <div>
                <p className="text-xs text-on-surface-variant">Verified</p>
                <p className="text-lg font-bold text-on-surface">98.5%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-surface/50 rounded-lg">
              <span className="material-symbols-outlined text-tertiary text-2xl">
                star
              </span>
              <div>
                <p className="text-xs text-on-surface-variant">Daily Downloads</p>
                <p className="text-lg font-bold text-on-surface">2,341</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-7xl">
        {/* Filters & Sort */}
        <div className="space-y-4 mb-8">
          {/* Category Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap',
                  'transition-all duration-200',
                  (selectedCategory === cat || (cat === 'All' && !selectedCategory))
                    ? 'gradient-primary text-on-primary shadow-lift'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort Options */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-on-surface-variant">
              Showing {sortedPapers.length} results
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm',
                'bg-surface-container-low border border-outline-variant/20',
                'text-on-surface font-medium',
                'hover:bg-surface-container transition-colors',
                'outline-none cursor-pointer'
              )}
            >
              <option value="trending">Trending</option>
              <option value="popular">Most Downloaded</option>
              <option value="recent">Most Recent</option>
            </select>
          </div>
        </div>

        {/* Papers Grid */}
        {sortedPapers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedPapers.map(paper => (
              <div
                key={paper.id}
                className={cn(
                  'p-5 rounded-xl bg-surface-container-low',
                  'border border-outline-variant/10',
                  'hover:shadow-lift hover:bg-surface-container',
                  'transition-all duration-200 group cursor-pointer'
                )}
              >
                {/* Header */}
                <div className="mb-3">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold uppercase bg-primary/10 text-primary px-2 py-1 rounded-full">
                      {paper.category}
                    </span>
                    {paper.verified && (
                      <span className="material-symbols-outlined text-secondary text-lg">
                        verified
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-on-surface line-clamp-2 group-hover:text-primary transition-colors">
                    {paper.title}
                  </h3>
                </div>

                {/* Metadata */}
                <div className="space-y-2 mb-4 text-sm">
                  <p className="text-on-surface-variant">
                    <span className="font-semibold">By:</span> {paper.author}
                  </p>
                  <p className="text-on-surface-variant text-xs">
                    {paper.university} • {paper.year}
                  </p>
                  <p className="text-on-surface-variant text-xs">
                    {paper.course}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 py-3 border-t border-outline-variant/10 text-xs font-bold text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    {paper.views}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">download</span>
                    {paper.downloads}
                  </span>
                </div>

                {/* Action Button */}
                <button
                  className={cn(
                    'w-full mt-3 px-4 py-2',
                    'gradient-primary text-on-primary rounded-lg',
                    'font-bold text-sm',
                    'hover:opacity-90 transition-opacity',
                    'group-hover:scale-105 transition-transform'
                  )}
                >
                  Read Paper
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mx-auto block mb-4">
              search
            </span>
            <h3 className="text-lg font-bold text-on-surface mb-2">No papers found</h3>
            <p className="text-on-surface-variant">
              Try adjusting your filters or search query
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
