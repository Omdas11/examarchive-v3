/**
 * Activity Log Item Component
 * Timeline-style activity display for user actions
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface ActivityItem {
  id: string;
  icon: string; // Material Symbol
  title: string;
  description?: string;
  status?: 'success' | 'pending' | 'error' | 'info';
  timestamp: string;
  tags?: string[];
  actionUrl?: string;
  avatar?: string;
}

interface ActivityLogProps {
  items: ActivityItem[];
  title?: string;
  maxItems?: number;
  className?: string;
}

const statusColors = {
  success: {
    bg: 'bg-secondary-fixed/20',
    text: 'text-secondary',
    icon: 'secondary-fixed',
  },
  pending: {
    bg: 'bg-primary-fixed/20',
    text: 'text-primary',
    icon: 'primary-fixed',
  },
  error: {
    bg: 'bg-error/10',
    text: 'text-error',
    icon: 'error',
  },
  info: {
    bg: 'bg-surface-container-highest',
    text: 'text-on-surface-variant',
    icon: 'on-surface-variant',
  },
};

export default function ActivityLog({
  items,
  title = 'Recent Activity',
  maxItems = 5,
  className,
}: ActivityLogProps) {
  const displayItems = items.slice(0, maxItems);

  return (
    <div className={cn('space-y-3', className)}>
      {title && <h2 className="text-lg font-bold text-on-surface mb-4">{title}</h2>}

      <div className="space-y-0">
        {displayItems.map((item) => {
          const statusColor = statusColors[item.status || 'info'];

          return (
            <div
              key={item.id}
              className={cn(
                'p-4 flex items-start gap-3',
                'bg-surface-container-low rounded-xl',
                'hover:bg-surface-container transition-colors',
                'border border-outline-variant/10'
              )}
            >
              {/* Icon Container */}
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  'mt-1',
                  statusColor.bg
                )}
              >
                <span className={cn('material-symbols-outlined text-lg', statusColor.text)}>
                  {item.icon}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-bold text-on-surface text-sm leading-tight">
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-sm text-on-surface-variant mt-1">{item.description}</p>
                    )}

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {item.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-surface-container px-2 py-0.5 rounded-full text-on-surface-variant font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status Badge or Action */}
                  {item.actionUrl ? (
                    <a
                      href={item.actionUrl}
                      className="text-xs font-bold text-primary hover:text-primary-container transition-colors whitespace-nowrap"
                    >
                      View →
                    </a>
                  ) : (
                    <span
                      className={cn(
                        'text-xs font-bold whitespace-nowrap',
                        statusColor.text
                      )}
                    >
                      {item.status === 'success' && 'Verified'}
                      {item.status === 'pending' && 'Pending'}
                      {item.status === 'error' && 'Failed'}
                      {item.status === 'info' && 'Info'}
                    </span>
                  )}
                </div>

                {/* Timestamp */}
                <p className="text-xs text-on-surface-variant/60 mt-2">{item.timestamp}</p>
              </div>
            </div>
          );
        })}
      </div>

      {items.length > maxItems && (
        <button className="w-full p-3 text-primary font-semibold text-sm rounded-lg hover:bg-surface-container-low transition-colors">
          View All Activity →
        </button>
      )}
    </div>
  );
}
