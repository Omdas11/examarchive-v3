/**
 * Top Navigation Header Component
 * Glass morphism design with search, user profile, and quick actions
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  userInitials?: string;
  userName?: string;
  notifications?: number;
  breadcrumbs?: { label: string; href?: string }[];
  onSearch?: (query: string) => void;
  onProfileClick?: () => void;
  /** Called when the mobile hamburger button is tapped */
  onMobileMenuToggle?: () => void;
}

export default function Header({
  title,
  showSearch = true,
  userInitials = 'JD',
  userName = 'John Doe',
  notifications = 0,
  breadcrumbs,
  onSearch,
  onProfileClick,
  onMobileMenuToggle,
  className,
  ...rest
}: HeaderProps & React.HTMLAttributes<HTMLElement>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  useEffect(() => {
    if (!showProfileMenu) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showProfileMenu]);

  return (
    <header
      {...rest}
      className={cn(
        'sticky top-0 z-40',
        'h-16 flex items-center justify-between px-6',
        'glass border-b border-outline-variant/10',
        className
      )}
    >
      {/* Left: Hamburger (mobile only) + Title / Breadcrumbs */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Hamburger toggle — only visible on mobile */}
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 rounded-lg hover:bg-surface-container-low transition-colors flex-shrink-0"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-on-surface-variant">menu</span>
          </button>
        )}
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-2 text-sm truncate">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <span className="text-on-surface-variant/40">
                    <span className="material-symbols-outlined text-base">
                      chevron_right
                    </span>
                  </span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-on-surface font-medium">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : (
          title && (
            <h2 className="text-lg font-bold text-on-surface truncate">{title}</h2>
          )
        )}
      </div>

      {/* Right: Search, Notifications, Profile */}
      <div className="flex items-center gap-3 ml-4">
        {/* Search Bar */}
        {showSearch && (
          <div className="hidden md:flex items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="Search papers, courses..."
                value={searchQuery}
                onChange={handleSearch}
                className={cn(
                  'w-72 px-4 py-2 pr-10',
                  'bg-surface-container-low rounded-lg',
                  'text-on-surface placeholder-on-surface-variant',
                  'ghost-border focus:ghost-border-focus',
                  'transition-all duration-200',
                  'outline-none'
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                <span className="material-symbols-outlined text-lg">search</span>
              </span>
            </div>
          </div>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn(
              'p-2 rounded-lg transition-all duration-200',
              'hover:bg-surface-container-low',
              'relative group'
            )}
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-on-surface-variant">
              notifications
            </span>
            {notifications > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div
              className={cn(
                'absolute right-0 mt-2 w-80 bg-surface rounded-xl',
                'shadow-ambient border border-outline-variant/20',
                'overflow-hidden z-50'
              )}
            >
              <div className="p-4 border-b border-outline-variant/10">
                <h3 className="font-bold text-on-surface">Notifications</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications > 0 ? (
                  <div className="p-4 space-y-3">
                    {[...Array(Math.min(notifications, 5))].map((_, i) => (
                      <div
                        key={i}
                        className="p-3 bg-surface-container-low rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                      >
                        <p className="text-sm font-medium text-on-surface">Notification {i + 1}</p>
                        <p className="text-xs text-on-surface-variant mt-1">Just now</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-sm text-on-surface-variant">No notifications</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile – navigates to /profile; shows Sign In for guests */}
        {userInitials ? (
          <div className="relative" ref={profileMenuRef}>
            <div className="flex items-center rounded-lg hover:bg-surface-container-low transition-all duration-200">
              <Link
                href="/profile"
                className={cn(
                  'flex items-center gap-3 px-3 py-2',
                  'group'
                )}
                aria-label={`Profile: ${userName}`}
                onClick={onProfileClick}
              >
                <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-on-primary text-sm font-bold flex-shrink-0">
                  {userInitials}
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-sm font-semibold text-on-surface truncate max-w-[120px]">{userName}</span>
                  <span className="text-xs text-on-surface-variant">Scholar</span>
                </div>
              </Link>
              <button
                type="button"
                className="pr-2 py-2 text-on-surface-variant"
                aria-label="Open profile menu"
                onClick={() => setShowProfileMenu((v) => !v)}
              >
                <span className="material-symbols-outlined text-sm">expand_more</span>
              </button>
            </div>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-outline-variant/20 bg-surface shadow-ambient z-50 p-3">
                <p className="text-sm font-semibold text-on-surface truncate">{userName}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Scholar profile</p>
                <div className="mt-3 space-y-1">
                  <Link href="/profile" className="block rounded-lg px-2 py-1.5 text-sm hover:bg-surface-container-low">
                    View profile
                  </Link>
                  <Link href="/settings" className="block rounded-lg px-2 py-1.5 text-sm hover:bg-surface-container-low">
                    Settings
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg',
              'gradient-primary text-on-primary',
              'font-semibold text-sm transition-opacity hover:opacity-90'
            )}
          >
            <span className="material-symbols-outlined text-sm">login</span>
            <span className="hidden sm:inline">Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}
