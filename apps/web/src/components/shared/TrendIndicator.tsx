'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendIndicatorProps {
  currentValue: number;
  previousValue: number | null;
  format?: 'percentage' | 'absolute';
  /** Invert color logic (e.g., for refund rate where down is good) */
  invertColor?: boolean;
}

export function TrendIndicator({
  currentValue,
  previousValue,
  format = 'percentage',
  invertColor = false,
}: TrendIndicatorProps) {
  if (previousValue === null || previousValue === undefined) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
        <Minus className="h-3 w-3" />
        <span>N/A</span>
      </span>
    );
  }

  const diff = currentValue - previousValue;
  const percentChange = previousValue !== 0 ? (diff / Math.abs(previousValue)) * 100 : 0;
  const isPositive = diff > 0;
  const isNeutral = diff === 0;

  const colorPositive = invertColor ? 'text-semantic-error' : 'text-semantic-success';
  const colorNegative = invertColor ? 'text-semantic-success' : 'text-semantic-error';

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
        <Minus className="h-3 w-3" />
        <span>0%</span>
      </span>
    );
  }

  const displayValue =
    format === 'percentage'
      ? `${Math.abs(percentChange).toFixed(1)}%`
      : Math.abs(diff).toLocaleString();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isPositive ? colorPositive : colorNegative,
      )}
    >
      {isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      <span>{displayValue}</span>
    </span>
  );
}
