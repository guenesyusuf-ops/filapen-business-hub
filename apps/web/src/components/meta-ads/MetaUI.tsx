'use client';

import { ReactNode, ElementType } from 'react';
import { cn } from '@/lib/utils';

/**
 * Gemeinsame UI-Schicht für den Meta-Ads-Bereich. Baut vollständig auf dem
 * bestehenden Filapen-Design-System auf (CSS-Tokens, Dark-Mode, Card-Konvention),
 * setzt aber eine ruhigere, hochwertigere Hierarchie darüber. Keine Business-Logik.
 */

/** Einheitliche Card-Klasse für den gesamten Meta-Ads-Bereich. */
export const META_CARD =
  'rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card';

// ---------------------------------------------------------------------------
// MetaPageHeader
// ---------------------------------------------------------------------------

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode; // Controls-Zeile (Product Switcher / Zeitraum) unter dem Header
}

export function MetaPageHeader({ eyebrow, title, description, actions, children }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-meta">{eyebrow}</div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-white/50">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

// ---------------------------------------------------------------------------
// MetaSectionHeader
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  count?: number;
  className?: string;
}

export function MetaSectionHeader({ title, description, action, count, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          {title}
          {count != null && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-500 dark:bg-white/10 dark:text-white/50">
              {count}
            </span>
          )}
        </h2>
        {description && <p className="mt-0.5 text-xs text-gray-400 dark:text-white/40">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetaKpiCard — Varianten "hero" und "compact"
// ---------------------------------------------------------------------------

interface KpiCardProps {
  variant?: 'hero' | 'compact';
  label: string;
  value: string;
  sub?: string;
  icon?: ElementType;
  accent?: boolean;
  /** Delta-Text (z. B. "+12 %"); Richtung steuert die Farbe. */
  delta?: string;
  deltaDir?: 'up' | 'down' | 'neutral';
  title?: string; // natives Tooltip
}

export function MetaKpiCard({ variant = 'compact', label, value, sub, icon: Icon, accent, delta, deltaDir = 'neutral', title }: KpiCardProps) {
  const hero = variant === 'hero';
  const deltaCls =
    deltaDir === 'up' ? 'text-green-600 dark:text-green-400'
      : deltaDir === 'down' ? 'text-red-600 dark:text-red-400'
        : 'text-gray-400 dark:text-white/40';
  return (
    <div className={cn(META_CARD, hero ? 'p-5' : 'p-3.5')} title={title}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('font-medium uppercase tracking-wide text-gray-400 dark:text-white/40', hero ? 'text-xs' : 'text-[11px]')}>
          {label}
        </span>
        {Icon && <Icon className={cn('shrink-0 text-gray-300 dark:text-white/25', hero ? 'h-4 w-4' : 'h-3.5 w-3.5')} />}
      </div>
      <div className={cn('mt-1.5 font-semibold tabular-nums', hero ? 'text-[1.75rem] leading-tight' : 'text-lg', accent ? 'text-accent-meta' : 'text-gray-900 dark:text-white')}>
        {value}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        {delta && <span className={cn('text-xs font-medium tabular-nums', deltaCls)}>{delta}</span>}
        {sub && <span className={cn('text-gray-400 dark:text-white/40', hero ? 'text-xs' : 'text-[11px]')}>{sub}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetaEmptyState
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  icon?: ElementType;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function MetaEmptyState({ icon: Icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-16 text-center dark:border-white/10 dark:bg-white/[0.02]', className)}>
      {Icon && (
        <div className="rounded-full bg-accent-meta/10 p-3 text-accent-meta">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div>
        <div className="text-sm font-medium text-gray-900 dark:text-white">{title}</div>
        {description && <div className="mt-1 text-xs text-gray-400 dark:text-white/40">{description}</div>}
      </div>
      {actions && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
