'use client';

import { ReactNode, ElementType } from 'react';
import { cn } from '@/lib/utils';

/**
 * Meta-Ads Design-Sprache (Redesign). Baut auf den Filapen-Tokens auf, setzt
 * aber eine ruhigere, dichtere SaaS-Hierarchie: Hairline-Divider statt Boxen,
 * offene Metric-Strips, Property-Zeilen (Record-View), reduzierte Borders/Shadows.
 * Keine Business-Logik.
 */

export const META_FRAME =
  'rounded-[11px] border border-gray-200/80 dark:border-white/[0.08] bg-white dark:bg-[var(--card-bg)] overflow-hidden';
/** Alias (Altbestand Import-Seite). */
export const META_CARD = META_FRAME;

/** Kompatibilitäts-Shim: Section-Header mit Titel/Beschreibung/Action. */
export function MetaSectionHeader({ title, description, action, className }: {
  title: string; description?: string; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-gray-400 dark:text-white/40">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------
export function MetaPageHeader({ eyebrow, title, description, actions, children }: {
  eyebrow?: string; title: string; description?: string; actions?: ReactNode; children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.11em] text-accent-meta">{eyebrow}</div>}
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-900 dark:text-white">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-gray-500 dark:text-white/50">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Section label + divider
// ---------------------------------------------------------------------------
export function MetaDivider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-gray-200/70 dark:bg-white/[0.07]', className)} />;
}

export function MetaSectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-white/40">{children}</span>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric strip — offene, Divider-getrennte Kennzahlen (keine Einzel-Cards)
// ---------------------------------------------------------------------------
export interface Metric { label: string; value: string; sub?: string; accent?: boolean; title?: string; }

export function MetaMetricStrip({ items, size = 'md' }: { items: Metric[]; size?: 'lg' | 'md' }) {
  return (
    <div className={cn(META_FRAME, 'grid')} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
      {items.map((m, i) => (
        <div key={i} title={m.title}
          className={cn('px-4 py-4 sm:px-[18px]', i < items.length - 1 && 'border-r border-gray-200/70 dark:border-white/[0.07]')}>
          <div className={cn('font-semibold tabular-nums tracking-[-0.02em]', size === 'lg' ? 'text-[23px]' : 'text-lg',
            m.accent ? 'text-accent-meta' : 'text-gray-900 dark:text-white')}>{m.value}</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-white/50">{m.label}</div>
          {m.sub && <div className="mt-0.5 text-[11px] text-gray-400 dark:text-white/40">{m.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Freie, kleine Kennzahlen-Reihe ohne Rahmen (sekundär). */
export function MetaSubMetrics({ items }: { items: Metric[] }) {
  return (
    <div className="flex flex-wrap gap-x-7 gap-y-3 px-0.5">
      {items.map((m, i) => (
        <div key={i} className="flex flex-col" title={m.title}>
          <span className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">{m.value}</span>
          <span className="mt-0.5 text-[11.5px] text-gray-400 dark:text-white/40">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Property grid (record view)
// ---------------------------------------------------------------------------
export function MetaPropertyGrid({ items, cols = 3 }: { items: { k: string; v: ReactNode }[]; cols?: 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-7', cols === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
      {items.map((p, i) => (
        <div key={i} className="flex min-w-0 gap-3 border-b border-gray-200/60 py-2 dark:border-white/[0.06]">
          <dt className="w-[86px] shrink-0 text-[12.5px] text-gray-400 dark:text-white/40">{p.k}</dt>
          <dd className="min-w-0 truncate text-[13px] font-medium text-gray-900 dark:text-white">{p.v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Status badge (dot + label, dezent)
// ---------------------------------------------------------------------------
const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: 'Aktiv', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400' },
  paused: { label: 'Pausiert', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  ended: { label: 'Beendet', dot: 'bg-gray-400', text: 'text-gray-500 dark:text-white/50' },
  draft: { label: 'Entwurf', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
  archived: { label: 'Archiviert', dot: 'bg-gray-300 dark:bg-white/30', text: 'text-gray-400 dark:text-white/40' },
};
export function MetaStatus({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] font-medium', s.text)}>
      <span className={cn('h-[7px] w-[7px] rounded-full', s.dot)} />{s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export function MetaEmptyState({ icon: Icon, title, description, actions, className }: {
  icon?: ElementType; title: string; description?: string; actions?: ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
      {Icon && <div className="rounded-full bg-accent-meta/10 p-3 text-accent-meta"><Icon className="h-6 w-6" /></div>}
      <div>
        <div className="text-sm font-medium text-gray-900 dark:text-white">{title}</div>
        {description && <div className="mt-1 text-xs text-gray-400 dark:text-white/40">{description}</div>}
      </div>
      {actions && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons (einheitliche Hierarchie)
// ---------------------------------------------------------------------------
export const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-3.5 py-2 text-[13px] font-medium text-white transition hover:brightness-[1.07] disabled:opacity-40';
export const btnGhost =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-transparent px-3.5 py-2 text-[13px] font-medium text-gray-600 dark:text-white/70 transition hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] dark:hover:text-white';
