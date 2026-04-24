'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Badge({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        color || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      )}
    >
      {children}
    </span>
  );
}

export function KpiCard({
  label, value, sublabel, accent, icon, onClick,
}: {
  label: string;
  value: string | ReactNode;
  sublabel?: string;
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'indigo' | 'gray';
  icon?: ReactNode;
  onClick?: () => void;
}) {
  // Farb-Map für Ring-Container um das Icon + Gradient-Tint-Background.
  // Gibt jeder KPI-Card ihre eigene Modul-Signatur.
  const tintMap: Record<string, { tint: string; ring: string; text: string }> = {
    blue: { tint: 'from-blue-500/10 to-blue-500/[0.02]', ring: 'ring-blue-500/20', text: 'text-blue-500' },
    green: { tint: 'from-emerald-500/10 to-emerald-500/[0.02]', ring: 'ring-emerald-500/20', text: 'text-emerald-500' },
    amber: { tint: 'from-amber-500/10 to-amber-500/[0.02]', ring: 'ring-amber-500/20', text: 'text-amber-500' },
    red: { tint: 'from-rose-500/10 to-rose-500/[0.02]', ring: 'ring-rose-500/20', text: 'text-rose-500' },
    purple: { tint: 'from-violet-500/10 to-violet-500/[0.02]', ring: 'ring-violet-500/20', text: 'text-violet-500' },
    indigo: { tint: 'from-indigo-500/10 to-indigo-500/[0.02]', ring: 'ring-indigo-500/20', text: 'text-indigo-500' },
    gray: { tint: 'from-gray-400/10 to-gray-400/[0.02]', ring: 'ring-gray-400/20', text: 'text-gray-500' },
  };
  const styles = tintMap[accent || 'gray'];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-white dark:bg-[var(--card-bg)]',
        'border border-gray-200/70 dark:border-white/8 shadow-card hover:shadow-card-hover',
        'text-left transition-all duration-300',
        'px-4 py-4 sm:px-5 sm:py-5',
        onClick && 'hover:-translate-y-0.5 cursor-pointer active:scale-[0.99]',
      )}
    >
      {/* Dezenter Farb-Tint im Hintergrund — Modul-Farbe sichtbar ohne zu dominieren */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-70 pointer-events-none', styles.tint)} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 truncate">
            {label}
          </div>
          {/* Fraunces-Serif für Premium-Report-Feeling */}
          <div className="mt-2 sm:mt-2.5 font-display-serif text-3xl sm:text-[2.75rem] font-medium tracking-tight leading-none text-gray-900 dark:text-white tabular-nums truncate">
            {value}
          </div>
          {sublabel && <div className="mt-1.5 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">{sublabel}</div>}
        </div>
        {icon && (
          <div className={cn(
            'h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white dark:bg-white/5',
            'flex items-center justify-center flex-shrink-0 shadow-sm ring-1',
            styles.ring, styles.text,
          )}>
            {icon}
          </div>
        )}
      </div>
    </button>
  );
}

export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string | ReactNode; actions?: ReactNode }) {
  return (
    // Stack vertically on mobile, horizontal from sm: up. Actions wrap if multiple.
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div className="min-w-0">
        <h1 className="font-display-serif text-2xl sm:text-3xl md:text-[2.25rem] font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">{title}</h1>
        {subtitle && <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Money({ amount, currency }: { amount: string | number | null | undefined; currency?: string }) {
  if (amount === null || amount === undefined || amount === '') return <span className="text-gray-400">—</span>;
  const num = Number(amount);
  if (!Number.isFinite(num)) return <span className="text-gray-400">—</span>;
  const formatted = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  return (
    <span className="tabular-nums">
      {formatted}
      <span className="ml-1 text-xs text-gray-400">{currency || 'EUR'}</span>
    </span>
  );
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-gray-300 dark:text-gray-600 mb-3">{icon}</div>}
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</div>
      {hint && <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 max-w-md">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function btn(variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary', extra?: string) {
  // Touch-friendly sizing: min 40px height on mobile (thumb target), stays compact on desktop.
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 min-h-[40px] sm:min-h-0 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const variants: Record<string, string> = {
    primary: 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-sm',
    secondary: 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10',
    ghost: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return cn(base, variants[variant], extra);
}

export function input(extra?: string) {
  // 16px font-size on mobile prevents iOS zoom-on-focus. min-height for thumb-friendliness.
  return cn(
    'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 min-h-[40px] text-base sm:text-sm',
    'text-gray-900 dark:text-white placeholder-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500',
    extra,
  );
}

export function label(extra?: string) {
  return cn('block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1', extra);
}
