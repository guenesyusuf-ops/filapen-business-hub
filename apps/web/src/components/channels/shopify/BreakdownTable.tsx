'use client';

import { AnalyticsCard, formatEur } from './AnalyticsCard';
import type { RevenueBreakdown } from '@/hooks/finance/useShopifyAnalytics';

type BreakdownRow = {
  key: keyof RevenueBreakdown;
  label: string;
  sign: 'positive' | 'negative' | 'neutral';
  emphasis?: 'subtotal' | 'total';
};

const BREAKDOWN_ROWS: BreakdownRow[] = [
  { key: 'grossSales', label: 'Bruttoumsatz', sign: 'positive' },
  { key: 'discounts', label: 'Rabatte', sign: 'negative' },
  { key: 'returns', label: 'Rückgaben', sign: 'negative' },
  { key: 'netSales', label: 'Nettoumsatz', sign: 'positive', emphasis: 'subtotal' },
  { key: 'shipping', label: 'Versandgebühren', sign: 'positive' },
  { key: 'returnFees', label: 'Rückgabegebühren', sign: 'positive' },
  { key: 'taxes', label: 'Steuern', sign: 'positive' },
  { key: 'totalSales', label: 'Gesamtumsatz', sign: 'positive', emphasis: 'total' },
];

function formatNegative(value: number): string {
  if (!value) return formatEur(0);
  return `-${formatEur(Math.abs(value))}`;
}

export function BreakdownTable({ data }: { data: RevenueBreakdown }) {
  return (
    <AnalyticsCard title="Aufschlüsselung des Gesamtumsatzes">
      <div className="divide-y divide-white/5">
        {BREAKDOWN_ROWS.map((row) => {
          const raw = data[row.key] ?? 0;
          const isEmph = row.emphasis === 'subtotal' || row.emphasis === 'total';
          const isTotal = row.emphasis === 'total';
          const display =
            row.sign === 'negative' ? formatNegative(raw) : formatEur(raw);

          return (
            <div
              key={row.key}
              className={[
                'flex items-center justify-between py-3',
                isTotal ? 'border-t border-white/10 pt-4 mt-1' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'text-sm',
                  isEmph ? 'font-semibold text-white' : 'text-gray-400',
                ].join(' ')}
              >
                {row.label}
              </span>
              <span
                className={[
                  'tabular-nums',
                  isTotal
                    ? 'text-base font-bold text-white'
                    : isEmph
                      ? 'text-sm font-semibold text-white'
                      : row.sign === 'negative'
                        ? 'text-sm text-red-400'
                        : 'text-sm text-gray-200',
                ].join(' ')}
              >
                {display}
              </span>
            </div>
          );
        })}
      </div>
    </AnalyticsCard>
  );
}
