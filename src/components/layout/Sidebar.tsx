/**
 * Sidebar Navigation Component
 * Part of the Digital Curator design system
 * Provides persistent navigation with role-based menu items
 * Mobile: hidden by default, slide-in via isMobileOpen prop
 * Desktop: always visible, collapsible
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { signOut } from '@/app/auth/actions';

interface SidebarItem {
  label: string;
  icon: string; // Material Symbol name
  href: string;
  badge?: number;
  roles?: string[]; // roles that can see this item
}

interface SidebarProps {
  items: SidebarItem[];
  userRole?: string;
  userName?: string;
  onNavigate?: (href: string) => void;
  /** Controlled collapsed state (for syncing with MainLayout margin) */
  isCollapsed?: boolean;
  /** Callback when the collapse toggle is clicked */
  onCollapseToggle?: (collapsed: boolean) => void;
  /** Whether the mobile drawer is open */
  isMobileOpen?: boolean;
  /** Called when the mobile overlay is tapped */
  onMobileClose?: () => void;
  /** Show logout button only when user is authenticated */
  isLoggedIn?: boolean;
}

export default function Sidebar({
  items,
  userRole = 'user',
  userName = 'Scholar',
  onNavigate,
  isCollapsed: controlledCollapsed,
  onCollapseToggle,
  isMobileOpen = false,
  onMobileClose,
  isLoggedIn = false,
}: SidebarProps) {
  const pathname = usePathname();
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  // Use controlled collapsed state if provided, otherwise use local state
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : localCollapsed;

  const handleCollapseToggle = () => {
    const next = !isCollapsed;
    setLocalCollapsed(next);
    onCollapseToggle?.(next);
  };

  // Filter items based on user role
  const visibleItems = items.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      setIsDarkTheme(saved === 'dark');
      document.documentElement.setAttribute('data-theme', saved);
      return;
    }

    const current = document.documentElement.getAttribute('data-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkTheme(current === 'dark' || (!current && prefersDark));
  }, []);

  const handleThemeToggle = () => {
    const nextDark = !isDarkTheme;
    setIsDarkTheme(nextDark);
    const nextTheme = nextDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

    <aside
      className={cn(
        'fixed left-0 top-0 h-full flex flex-col bg-surface',
        'z-50',
        'border-r border-outline-variant/20',
        'transition-all duration-300 ease-in-out',
        // Desktop width
        isCollapsed ? 'md:w-20' : 'md:w-64',
        // Mobile: always full-width drawer (w-72), slide in/out
        'w-72',
        // Mobile transform: off-screen when closed, on-screen when open
        isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
      style={{ minHeight: '100vh' }}
    >
      {/* Logo Section */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center text-white flex-shrink-0">
            <Image
              src="/branding/logo.png"
              alt="ExamArchive logo"
              width={24}
              height={24}
              className="rounded"
            />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-on-surface truncate max-w-[150px]">{userName}</h1>
              <p className="text-xs text-on-surface-variant">ExamArchive</p>
            </div>
          )}
        </div>

        {/* Toggle Button – only visible on desktop */}
        <button
          onClick={handleCollapseToggle}
          className={cn(
            'hidden md:flex w-full p-2 rounded-lg',
            'hover:bg-surface-container-low',
            'transition-colors duration-200',
            'items-center justify-center'
          )}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="material-symbols-outlined text-on-surface-variant">
            {isCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 min-h-0 space-y-1 px-3 pb-4 overflow-y-auto" aria-label="Primary">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.(item.href)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg',
              'transition-all duration-200 ease-in-out',
              'relative group',
              isActive(item.href)
                ? 'bg-primary-fixed text-primary font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
            )}
            title={isCollapsed ? item.label : undefined}
            aria-label={isCollapsed ? item.label : undefined}
          >
            <span className="material-symbols-outlined flex-shrink-0 text-lg">
              {item.icon}
            </span>

            {!isCollapsed && (
              <>
                <span className="flex-1 text-sm truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-primary text-on-primary text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </>
            )}

            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div
                className={cn(
                  'absolute left-full ml-2 px-2 py-1 bg-on-surface text-surface text-xs rounded',
                  'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200',
                  'pointer-events-none whitespace-nowrap z-50'
                )}
              >
                {item.label}
                {item.badge !== undefined && item.badge > 0 && ` (${item.badge})`}
              </div>
            )}
          </Link>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 space-y-2 border-t border-outline-variant/20 bg-surface">
        <Link
          href="/upload"
          onClick={() => onNavigate?.('/upload')}
          className={cn(
            'w-full gradient-primary text-on-primary py-2 px-3 rounded-lg',
            'font-semibold text-sm transition-opacity duration-200',
            'hover:opacity-90 active:scale-95',
            'flex items-center justify-center',
            isCollapsed && 'p-2'
          )}
          title={isCollapsed ? 'Upload' : undefined}
        >
          {isCollapsed ? (
            <span className="material-symbols-outlined">upload</span>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm mr-2 inline-block">upload</span>
              Upload Paper
            </>
          )}
        </Link>

        <button
          type="button"
          onClick={handleThemeToggle}
          className={cn(
            'w-full py-2 px-3 rounded-lg text-sm transition-colors duration-200',
            'hover:bg-surface-container-low text-on-surface-variant hover:text-primary',
            'flex items-center justify-center',
            isCollapsed && 'p-2'
          )}
          aria-label={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isCollapsed ? 'Toggle theme' : undefined}
        >
          {isCollapsed ? (
            <span className="material-symbols-outlined">{isDarkTheme ? 'light_mode' : 'dark_mode'}</span>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg mr-2 inline-block">
                {isDarkTheme ? 'light_mode' : 'dark_mode'}
              </span>
              {isDarkTheme ? 'Light Theme' : 'Dark Theme'}
            </>
          )}
        </button>

        {!isCollapsed && isLoggedIn && (
          <form action={signOut}>
            <button
              type="submit"
              className="w-full p-2 text-on-surface-variant hover:text-primary text-sm transition-colors flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              <span className="ml-2">Logout</span>
            </button>
          </form>
        )}
      </div>
    </aside>
    </>
  );
}
