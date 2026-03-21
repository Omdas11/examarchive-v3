/**
 * Main Layout Wrapper
 * Combines Sidebar, Header, and main content area with proper spacing/structure
 * Responsive: mobile sidebar drawer + desktop collapsible sidebar
 */

'use client';

import React, { useState } from 'react';
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      {!hideSidebar && (
        <Sidebar
          items={sidebarItems}
          userRole={userRole}
          onNavigate={() => {
            // Close mobile sidebar when a nav item is tapped
            setIsMobileOpen(false);
          }}
          isCollapsed={isCollapsed}
          onCollapseToggle={setIsCollapsed}
          isMobileOpen={isMobileOpen}
          onMobileClose={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-hidden',
          // On mobile: no left margin (sidebar is an overlay drawer)
          // On desktop: margin matches sidebar width
          !hideSidebar && (
            isCollapsed
              ? 'md:ml-20'
              : 'md:ml-64'
          )
        )}
      >
        {/* Header */}
        {!hideHeader && (
          <Header
            {...headerProps}
            onMobileMenuToggle={!hideSidebar ? () => setIsMobileOpen((v) => !v) : undefined}
          />
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="h-full">{children}</div>
        </div>
      </main>
    </div>
  );
}
