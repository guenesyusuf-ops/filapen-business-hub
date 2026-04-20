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
  const accentMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    indigo: 'from-indigo-500 to-indigo-600',
    gray: 'from-gray-400 to-gray-500',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/8 px-5 py-4 text-left transition-all duration-200',
        onClick && 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer',
      )}
    >
      <div className={cn('absolute top-0 left-0 h-1 w-full bg-gradient-to-r', accentMap[accent || 'gray'])} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
          <div className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</div>
          {sublabel && <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sublabel}</div>}
        </div>
        {icon && <div className="text-gray-300 dark:text-gray-600 flex-shrink-0">{icon}</div>}
      </div>
    </button>
  );
}

export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
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
  const base = 'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-sm',
    secondary: 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10',
    ghost: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return cn(base, variants[variant], extra);
}

export function input(extra?: string) {
  return cn(
    'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm',
    'text-gray-900 dark:text-white placeholder-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500',
    extra,
  );
}

export function label(extra?: string) {
  return cn('block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1', extra);
}
