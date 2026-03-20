/**
 * Dashboard Card Component
 * Reusable card for displaying dashboard stats, papers, recommendations
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: string; // Material Symbol
  iconBg?: 'primary' | 'secondary' | 'tertiary' | 'surface';
  title: string;
  value?: string | number;
  description?: string;
  tags?: Array<{ label: string; variant?: 'primary' | 'secondary' | 'success' }>;
  badge?: string;
  isHoverable?: boolean;
  onClick?: () => void;
  action?: React.ReactNode;
}

const bgVariants = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  tertiary: 'bg-tertiary/10 text-tertiary',
  surface: 'bg-surface-container text-on-surface-variant',
};

export default function DashboardCard({
  icon,
  iconBg = 'primary',
  title,
  value,
  description,
  tags = [],
  badge,
  isHoverable = true,
  onClick,
  action,
  className,
  ...props
}: DashboardCardProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-xl bg-surface-container-low',
        'border border-outline-variant/10',
        'transition-all duration-200',
        isHoverable && 'hover:bg-surface-container hover:shadow-lift cursor-pointer hover:scale-[1.01]',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      {...props}
    >
      {/* Header with Icon and Badge */}
      <div className="flex items-start justify-between mb-3">
        {icon && (
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', bgVariants[iconBg])}>
            <span className="material-symbols-outlined text-lg">{icon}</span>
          </div>
        )}
        {badge && (
          <span className="px-2 py-1 bg-tertiary-container text-on-tertiary-container text-[10px] font-black rounded uppercase">
            {badge}
          </span>
        )}
      </div>

      {/* Title and Value */}
      <h3 className="font-bold text-on-surface mb-1 line-clamp-2">{title}</h3>
      {value && <p className="text-lg font-bold text-primary mb-2">{value}</p>}

      {/* Description */}
      {description && (
        <p className="text-sm text-on-surface-variant mb-3 line-clamp-2">{description}</p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                tag.variant === 'secondary' && 'bg-secondary/10 text-secondary',
                tag.variant === 'primary' && 'bg-primary/10 text-primary',
                !tag.variant && 'bg-surface-container text-on-surface-variant'
              )}
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Action */}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
