/**
 * Main Layout Wrapper
 * Combines Sidebar, Header, and main content area with proper spacing/structure
 */

'use client';

import React from 'react';
import Sidebar from './Sidebar';
import Header, { type HeaderProps } from './Header';
import { cn } from '@/lib/utils';

interface LayoutProps extends HeaderProps {
  children: React.ReactNode;
  sidebarItems?: Array<{
    label: string;
    icon: string;
    href: string;
    badge?: number;
    roles?: string[];
  }>;
  userRole?: string;
  hideSidebar?: boolean;
  hideHeader?: boolean;
}

export default function MainLayout({
  children,
  sidebarItems = [],
  userRole = 'user',
  hideSidebar = false,
  hideHeader = false,
  ...headerProps
}: LayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      {!hideSidebar && (
        <Sidebar
          items={sidebarItems}
          userRole={userRole}
          onNavigate={() => {
            // Optional: close mobile sidebar, analytics, etc.
          }}
        />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-hidden',
          !hideSidebar && 'ml-64'
        )}
      >
        {/* Header */}
        {!hideHeader && <Header {...headerProps} />}

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="h-full">{children}</div>
        </div>
      </main>
    </div>
  );
}
