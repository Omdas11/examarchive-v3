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
    if (href.startsWith('http')) return false;
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
        'border-r border-outline-variant/10',
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
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lift">
            <Image
              src="/branding/logo.png"
              alt="ExamArchive logo"
              width={28}
              height={28}
              className="rounded-lg"
            />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-extrabold text-on-surface tracking-tight truncate max-w-[140px] leading-tight">{userName}</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mt-0.5">ExamArchive</p>
            </div>
          )}
        </div>

        {/* Toggle Button – only visible on desktop */}
        <button
          onClick={handleCollapseToggle}
          className={cn(
            'hidden md:flex w-full p-2.5 rounded-full',
            'hover:bg-surface-container-low',
            'transition-colors duration-200',
            'items-center justify-center border border-outline-variant/10'
          )}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="material-symbols-outlined text-on-surface-variant font-bold">
            {isCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>

      <nav className="flex-1 min-h-0 space-y-1.5 px-4 pb-4 overflow-y-auto scrollbar-hide" aria-label="Primary">
        {visibleItems.map((item) => {
          const isExternal = item.href.startsWith('http');
          const LinkComponent = isExternal ? 'a' : Link;
          const linkProps = isExternal 
            ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' } 
            : { href: item.href, onClick: () => onNavigate?.(item.href) };

          return (
            <LinkComponent
              key={item.href}
              {...linkProps}
              className={cn(
                'flex items-center gap-3 px-4 py-3.5 rounded-full',
                'transition-all duration-200 ease-in-out',
                'relative group',
                isActive(item.href)
                  ? 'bg-primary text-on-primary font-bold shadow-floating'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary font-medium'
              )}
              title={isCollapsed ? item.label : undefined}
              aria-label={isCollapsed ? item.label : undefined}
            >
              <span className="material-symbols-outlined flex-shrink-0 text-xl font-medium">
                {item.icon}
              </span>

              {!isCollapsed && (
                <>
                  <span className="flex-1 text-sm truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-secondary text-on-secondary text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </>
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div
                  className={cn(
                    'absolute left-full ml-4 px-3 py-1.5 bg-on-surface text-surface text-xs font-bold rounded-full shadow-lg',
                    'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200',
                    'pointer-events-none whitespace-nowrap z-50 border border-outline-variant/20'
                  )}
                >
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && ` (${item.badge})`}
                </div>
              )}
            </LinkComponent>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 space-y-2.5 border-t border-outline-variant/10 bg-surface">
        <Link
          href="/upload"
          onClick={() => onNavigate?.('/upload')}
          className={cn(
            'w-full gradient-primary text-on-primary py-3 px-4 rounded-full',
            'font-bold text-sm transition-all duration-200 shadow-lift',
            'hover:shadow-floating active:scale-95',
            'flex items-center justify-center',
            isCollapsed && 'p-2.5'
          )}
          title={isCollapsed ? 'Upload' : undefined}
        >
          {isCollapsed ? (
            <span className="material-symbols-outlined font-bold">upload</span>
          ) : (
              <>
                <span className="material-symbols-outlined text-lg mr-2 inline-block font-bold">upload</span>
                Upload Paper
              </>
            )}
        </Link>

        <button
          type="button"
          onClick={handleThemeToggle}
          className={cn(
            'w-full py-2.5 px-4 rounded-full text-sm font-bold transition-all duration-200',
            'hover:bg-surface-container-low text-on-surface-variant hover:text-primary',
            'flex items-center justify-center border border-outline-variant/10',
            isCollapsed && 'p-2.5'
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
              className="w-full p-2.5 text-on-surface-variant hover:text-danger-red text-xs font-bold transition-colors flex items-center justify-center gap-2 rounded-full hover:bg-danger-red/5"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              <span>LOGOUT</span>
            </button>
          </form>
        )}
      </div>
    </aside>
    </>
  );
}
