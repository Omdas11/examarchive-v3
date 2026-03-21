/**
 * Recommendation Card Component
 * For displaying suggested papers, courses, or resources
 */

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface RecommendationItem {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  tags?: string[];
  views?: number;
  priority?: 'featured' | 'standard';
  imageUrl?: string;
  href?: string;
  isPremium?: boolean;
  ctaText?: string;
  onCta?: () => void;
}

interface RecommendationGridProps {
  items: RecommendationItem[];
  title?: string;
  subtitle?: string;
  isPro?: boolean;
  className?: string;
  columns?: 1 | 2 | 3;
}

export default function RecommendationGrid({
  items,
  title,
  subtitle,
  isPro = false,
  className,
  columns = 2,
}: RecommendationGridProps) {
  return (
    <div className={className}>
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-6">
          <div className="flex items-start justify-between mb-2">
            {title && (
              <h2 className="text-lg font-bold text-on-surface">{title}</h2>
            )}
            {isPro && (
              <span className="px-2 py-1 bg-tertiary-container text-on-tertiary-container text-[10px] font-black rounded uppercase">
                Pro
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-on-surface-variant">{subtitle}</p>
          )}
        </div>
      )}

      {/* Grid */}
      <div
        className={cn(
          'grid gap-4',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 md:grid-cols-2',
          columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        )}
      >
        {items.map((item) => (
          <RecommendationCard key={item.id} {...item} />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual Recommendation Card
 */
type RecommendationCardProps = RecommendationItem;

export function RecommendationCard({
  title,
  subtitle,
  tags = [],
  views,
  imageUrl,
  href = '#',
  isPremium = false,
  ctaText = 'Read Now',
  onCta,
}: RecommendationCardProps) {
  const footerCta = (
    <span className="text-primary text-xs font-bold flex items-center gap-1 hover:text-primary-container transition-colors">
      {ctaText}
      <span className="material-symbols-outlined text-xs">
        arrow_forward
      </span>
    </span>
  );

  const cardClassName = cn(
    'p-4 rounded-xl bg-surface-container-low',
    'border border-outline-variant/10',
    'transition-all duration-200 ease-out',
    'hover:scale-[1.02] hover:shadow-lift hover:bg-surface-container',
    'cursor-pointer'
  );

  return (
    href !== '#' ? (
      <Link href={href} className={cardClassName} onClick={onCta}>
        {/* Image Container */}
        {imageUrl && (
          <div className="relative w-full h-32 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/10 mb-3 flex items-center justify-center overflow-hidden">
            <Image
              src={imageUrl}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                  idx === 0 ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h3 className="font-bold text-on-surface mb-1 line-clamp-2 leading-tight">
          {title}
          {isPremium && (
            <span className="material-symbols-outlined text-xs ml-1 align-middle text-tertiary">
              lock
            </span>
          )}
        </h3>

        {/* Subtitle/Category */}
        {subtitle && (
          <p className="text-xs text-on-surface-variant mb-3 line-clamp-2">
            {subtitle}
          </p>
        )}

        {/* Footer with Views and CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
          {views !== undefined && (
            <span className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">
                visibility
              </span>
              {views > 1000 ? `${(views / 1000).toFixed(1)}k` : views} views
            </span>
          )}
          {footerCta}
        </div>
      </Link>
    ) : (
      <button
        type="button"
        className={cn(cardClassName, 'w-full text-left')}
        onClick={onCta}
      >
      {/* Image Container */}
      {imageUrl && (
        <div className="relative w-full h-32 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/10 mb-3 flex items-center justify-center overflow-hidden">
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                idx === 0 ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h3 className="font-bold text-on-surface mb-1 line-clamp-2 leading-tight">
        {title}
        {isPremium && (
          <span className="material-symbols-outlined text-xs ml-1 align-middle text-tertiary">
            lock
          </span>
        )}
      </h3>

      {/* Subtitle/Category */}
      {subtitle && (
        <p className="text-xs text-on-surface-variant mb-3 line-clamp-2">
          {subtitle}
        </p>
      )}

      {/* Footer with Views and CTA */}
      <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
        {views !== undefined && (
          <span className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">
              visibility
            </span>
            {views > 1000 ? `${(views / 1000).toFixed(1)}k` : views} views
          </span>
        )}
        {footerCta}
      </div>
      </button>
    )
  );
}
