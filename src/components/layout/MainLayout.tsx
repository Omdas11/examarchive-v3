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
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const deltaX = endX - touchStartX;
    const viewportWidth = window.innerWidth;
    const startedAtRightEdge = touchStartX > viewportWidth - 40;
    const startedInPanel = touchStartX > viewportWidth - 320;

    if (startedAtRightEdge && deltaX < -50) {
      setIsRightSidebarOpen(true);
    } else if (isRightSidebarOpen && startedInPanel && deltaX > 50) {
      setIsRightSidebarOpen(false);
    }
    setTouchStartX(null);
  };

  return (
    <div
      className="flex h-screen bg-surface"
      style={{ ['--right-sidebar-width' as string]: RIGHT_SIDEBAR_WIDTH }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
          userName={headerProps.userName}
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
            onProfileClick={() => setIsRightSidebarOpen(true)}
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
        <aside className="hidden lg:block fixed right-0 bottom-0 w-[var(--right-sidebar-width)] z-20 border-l border-outline-variant/20 bg-surface overflow-y-auto" style={{ top: "var(--layout-header-height)" }}>
          <div className="p-4">
            <RightSidebar
              userName={headerProps.userName || "Guest"}
              userInitials={headerProps.userInitials || "GU"}
            />
          </div>
        </aside>
      )}
      {showRightColumn && isRightSidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setIsRightSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed right-0 bottom-0 w-[85vw] max-w-[320px] z-50 border-l border-outline-variant/20 bg-surface overflow-y-auto lg:hidden" style={{ top: "var(--layout-header-height)" }}>
            <div className="p-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsRightSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-surface-container-low"
                  aria-label="Close profile sidebar"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <RightSidebar
                userName={headerProps.userName || "Guest"}
                userInitials={headerProps.userInitials || "GU"}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
