'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header, { type HeaderProps } from './Header';
import Footer from '@/components/Footer';
import RightSidebar, { type SidebarProfileResponse } from './RightSidebar';
import { cn } from '@/lib/utils';
import { PROFILE_REFRESH_EVENT } from '@/lib/profile-events';

const RIGHT_SIDEBAR_WIDTH = '300px';
const RIGHT_SIDEBAR_COLLAPSED_WIDTH = '48px';

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
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [sidebarProfile, setSidebarProfile] = useState<SidebarProfileResponse | null>(null);

  // Persist right sidebar collapsed state
  useEffect(() => {
    const saved = localStorage.getItem('ea_right_sidebar_collapsed');
    if (saved === 'true') setIsRightCollapsed(true);
  }, []);

  const handleRightCollapseToggle = () => {
    const next = !isRightCollapsed;
    setIsRightCollapsed(next);
    localStorage.setItem('ea_right_sidebar_collapsed', String(next));
  };

  useEffect(() => {
    if (!isLoggedIn || !showRightColumn) {
      setSidebarProfile(null);
      return;
    }
    let cancelled = false;
    async function loadSidebarProfile() {
      try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as SidebarProfileResponse;
        if (!cancelled) setSidebarProfile(data);
      } catch {
        // Non-blocking; sidebar can render fallback values.
      }
    }
    void loadSidebarProfile();
    const onProfileRefresh = () => {
      void loadSidebarProfile();
    };
    window.addEventListener(PROFILE_REFRESH_EVENT, onProfileRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_REFRESH_EVENT, onProfileRefresh);
    };
  }, [isLoggedIn, showRightColumn]);

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

  const rightSidebarWidth = isRightCollapsed ? RIGHT_SIDEBAR_COLLAPSED_WIDTH : RIGHT_SIDEBAR_WIDTH;

  return (
    <div
      className="flex h-screen bg-surface"
      style={{ 
        '--right-sidebar-width': RIGHT_SIDEBAR_WIDTH,
        '--current-right-padding': showRightColumn ? rightSidebarWidth : '0px'
      } as React.CSSProperties}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Left Sidebar */}
      {!hideSidebar && (
        <div className="no-print">
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
        </div>
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-hidden bg-surface text-on-surface',
          showRightColumn && 'lg:pr-[var(--current-right-padding)]',
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
            className="no-print"
            {...headerProps}
            onMobileMenuToggle={!hideSidebar ? () => setIsMobileOpen((v) => !v) : undefined}
            onProfileClick={() => setIsRightSidebarOpen(true)}
          />
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-auto flex flex-col bg-surface">
          <div className="flex-1">{children}</div>
          {/* Footer on every new-layout page */}
          <div className="no-print">
            <Footer />
          </div>
        </div>
      </main>

      {/* Desktop Right Sidebar */}
      {showRightColumn && (
        <aside
          className={cn(
            'hidden lg:flex flex-col fixed right-0 bottom-0 z-20 border-l border-outline-variant/20 bg-surface overflow-hidden transition-all duration-300',
            isRightCollapsed ? 'w-12' : 'w-[300px]'
          )}
          style={{ top: 'var(--layout-header-height)' }}
        >
          {/* Collapse toggle button */}
          <button
            type="button"
            onClick={handleRightCollapseToggle}
            className="flex items-center justify-center w-full p-3 border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors shrink-0"
            aria-label={isRightCollapsed ? 'Expand profile sidebar' : 'Collapse profile sidebar'}
            title={isRightCollapsed ? 'Expand profile sidebar' : 'Collapse profile sidebar'}
          >
            <span className="material-symbols-outlined text-on-surface-variant text-lg">
              {isRightCollapsed ? 'chevron_left' : 'chevron_right'}
            </span>
          </button>

          {/* Sidebar content — hidden when collapsed */}
          {!isRightCollapsed && (
            <div className="flex-1 overflow-y-auto p-4">
              <RightSidebar
                userName={headerProps.userName || 'Guest'}
                userInitials={headerProps.userInitials || 'GU'}
                isLoggedIn={isLoggedIn}
                profileData={sidebarProfile}
              />
            </div>
          )}
        </aside>
      )}

      {/* Mobile Right Sidebar Drawer */}
      {showRightColumn && isRightSidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setIsRightSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 right-0 h-screen w-[88vw] max-w-[360px] z-50 border-l border-outline-variant/20 bg-surface overflow-y-auto lg:hidden">
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
                userName={headerProps.userName || 'Guest'}
                userInitials={headerProps.userInitials || 'GU'}
                isLoggedIn={isLoggedIn}
                profileData={sidebarProfile}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

