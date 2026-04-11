'use client';

import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Shared formatters (de-DE / EUR)
// ---------------------------------------------------------------------------

export const eurFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const eurCompactFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const intFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

export const decFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEur(value: number): string {
  return eurFormatter.format(value ?? 0);
}

export function formatInt(value: number): string {
  return intFormatter.format(value ?? 0);
}

export function formatPct(value: number): string {
  return `${decFormatter.format(value ?? 0)} %`;
}

// ---------------------------------------------------------------------------
// Card wrapper — title + optional big number + chart body
// ---------------------------------------------------------------------------

interface AnalyticsCardProps {
  title: string;
  bigNumber?: string;
  bigNumberSubLabel?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function AnalyticsCard({
  title,
  bigNumber,
  bigNumberSubLabel,
  children,
  action,
  className,
}: AnalyticsCardProps) {
  return (
    <div
      className={[
        'rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-6 flex flex-col shadow-card dark:shadow-[var(--card-shadow)] transition-all duration-300 ease-out hover:shadow-card-hover hover:-translate-y-[2px]',
        className ?? '',
      ].join(' ')}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {action}
      </div>

      {bigNumber != null && (
        <div className="mb-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {bigNumber}
          </div>
          {bigNumberSubLabel && (
            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{bigNumberSubLabel}</div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
