'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDollars, formatNumber } from '@filapen/shared/src/utils/money';

interface KPICardProps {
  label: string;
  value: number;
  previousValue: number | null;
  changePercent?: number;
  format: 'currency' | 'percentage' | 'number' | 'multiplier';
  icon?: React.ReactNode;
  accentColor?: string;
  invertTrend?: boolean;
  loading?: boolean;
}

/**
 * Format the main KPI display value.
 * API returns dollars directly (not cents).
 */
function formatDisplayValue(value: number, format: KPICardProps['format']): string {
  switch (format) {
    case 'currency':
      return formatDollars(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'multiplier':
      return `${value.toFixed(2)}x`;
    case 'number':
      return formatNumber(value);
    default:
      return String(value);
  }
}

function KPICardSkeleton() {
  return (
    <div className="relative rounded-xl bg-white dark:bg-[var(--card-bg)] p-5 shadow-card dark:shadow-[var(--card-shadow)] overflow-hidden">
      <div className="absolute inset-0 shimmer-bg animate-shimmer" />
      <div className="relative">
        <div className="h-3 w-20 rounded-full bg-gray-200/60 dark:bg-white/10 mb-4" />
        <div className="h-8 w-32 rounded-lg bg-gray-200/60 dark:bg-white/10 mb-3" />
        <div className="h-5 w-16 rounded-full bg-gray-200/60 dark:bg-white/10" />
      </div>
    </div>
  );
}

export function KPICard({
  label,
  value,
  previousValue,
  changePercent,
  format,
  icon,
  accentColor,
  invertTrend = false,
  loading = false,
}: KPICardProps) {
  if (loading) {
    return <KPICardSkeleton />;
  }

  // Determine trend from changePercent or calculate from values
  let trendPercent: number | null = null;
  if (typeof changePercent === 'number') {
    trendPercent = changePercent;
  } else if (previousValue !== null && previousValue !== 0) {
    trendPercent = ((value - previousValue) / Math.abs(previousValue)) * 100;
  }

  const isPositive = trendPercent !== null && trendPercent > 0;
  const isNegative = trendPercent !== null && trendPercent < 0;
  const isNeutral = trendPercent === null || trendPercent === 0;

  // For invertTrend (e.g. ad spend), going up is bad
  const colorPositive = invertTrend ? 'text-red-600' : 'text-emerald-600';
  const colorNegative = invertTrend ? 'text-emerald-600' : 'text-red-600';
  const bgPositive = invertTrend ? 'bg-red-50' : 'bg-emerald-50';
  const bgNegative = invertTrend ? 'bg-emerald-50' : 'bg-red-50';

  return (
    <div
      className={cn(
        'group relative rounded-xl bg-white dark:bg-[var(--card-bg)] p-5 shadow-card dark:shadow-[var(--card-shadow)] transition-all duration-300 ease-out',
        'hover:shadow-card-hover hover:-translate-y-[2px]',
        accentColor && 'border-t-2',
      )}
      style={accentColor ? { borderTopColor: accentColor } : undefined}
    >
      {/* Subtle gradient overlay on hover. color-mix() erlaubt Opacity
          sowohl für hex-Werte als auch für rgb(var(--...)) — dadurch
          funktioniert das für theme-basierte Farben. */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={
          accentColor
            ? {
                background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 8%, transparent) 0%, transparent 60%)`,
              }
            : undefined
        }
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {label}
          </span>
          {icon && (
            <span
              className="flex items-center justify-center h-8 w-8 rounded-lg opacity-80 transition-transform duration-200 group-hover:scale-110"
              style={
                accentColor
                  ? {
                      backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                      color: accentColor,
                    }
                  : undefined
              }
            >
              {icon}
            </span>
          )}
        </div>

        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight animate-fade-in">
          {formatDisplayValue(value, format)}
        </div>

        {/* Trend badge as pill */}
        {isNeutral ? (
          <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs text-gray-400 bg-gray-50">
            <Minus className="h-3 w-3" />
            <span>N/A</span>
          </span>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors duration-200',
              isPositive ? `${colorPositive} ${bgPositive}` : `${colorNegative} ${bgNegative}`,
            )}
          >
            {isPositive ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            <span>
              {Math.abs(trendPercent!).toFixed(1)}%
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
