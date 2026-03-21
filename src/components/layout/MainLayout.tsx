'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header, { type HeaderProps } from './Header';
import Footer from '@/components/Footer';
import RightSidebar from './RightSidebar';
import { cn } from '@/lib/utils';

const RIGHT_SIDEBAR_WIDTH = '300px';

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
  /** Whether the current user is authenticated (shows logout in sidebar when true) */
  isLoggedIn?: boolean;
  /** Show right sidebar widgets on desktop */
  showRightColumn?: boolean;
}

export default function MainLayout({
  children,
  sidebarItems = [],
  userRole = 'user',
  hideSidebar = false,
  hideHeader = false,
  isLoggedIn = false,
  showRightColumn = true,
  ...headerProps
}: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div
      className="flex h-screen bg-background"
      style={{ ['--right-sidebar-width' as string]: RIGHT_SIDEBAR_WIDTH }}
    >
      {/* Sidebar */}
      {!hideSidebar && (
        <Sidebar
          items={sidebarItems}
          userRole={userRole}
          onNavigate={() => {
            setIsMobileOpen(false);
          }}
          isCollapsed={isCollapsed}
          onCollapseToggle={setIsCollapsed}
          isMobileOpen={isMobileOpen}
          onMobileClose={() => setIsMobileOpen(false)}
          isLoggedIn={isLoggedIn}
        />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-hidden',
          showRightColumn && 'lg:pr-[var(--right-sidebar-width)]',
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
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="flex-1">{children}</div>
          {/* Footer on every new-layout page */}
          <Footer />
        </div>
      </main>
      {showRightColumn && (
        <aside className="hidden lg:block fixed right-0 top-16 bottom-0 w-[var(--right-sidebar-width)] z-20 border-l border-outline-variant/20 bg-surface overflow-y-auto">
          <div className="p-4">
            <RightSidebar
              userName={headerProps.userName || "Guest"}
              userInitials={headerProps.userInitials || "GU"}
            />
          </div>
        </aside>
      )}
    </div>
  );
}
