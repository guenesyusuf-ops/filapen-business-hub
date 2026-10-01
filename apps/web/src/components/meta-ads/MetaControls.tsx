'use client';

import { cn } from '@/lib/utils';
import { RANGE_LABELS, PeriodRange } from '@/hooks/meta-ads/useMetaAds';
import { ProductGroupSelect } from './ProductGroupSelect';

const RANGES: PeriodRange[] = ['today', 'yesterday', 'last3', 'last7', 'last14', 'last30', 'lifetime', 'custom'];

export interface MetaControlsValue {
  productGroupId?: string;
  range: PeriodRange;
  start?: string;
  end?: string;
}

export function MetaControls({ value, onChange, className }: {
  value: MetaControlsValue; onChange: (next: MetaControlsValue) => void; className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2.5', className)}>
      <div className="w-[220px] max-w-full">
        <ProductGroupSelect mode="filter" value={value.productGroupId} onChange={(id) => onChange({ ...value, productGroupId: id })} />
      </div>
      <div className="flex flex-wrap items-center gap-1 rounded-[9px] border border-gray-200 bg-white p-0.5 dark:border-white/[0.1] dark:bg-[var(--card-bg)]">
        {RANGES.map((r) => (
          <button key={r} type="button" onClick={() => onChange({ ...value, range: r })}
            className={cn('rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition',
              value.range === r ? 'bg-accent-meta/10 text-accent-meta' : 'text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white')}>
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>
      {value.range === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={value.start ?? ''} onChange={(e) => onChange({ ...value, start: e.target.value })}
            className="h-[34px] rounded-[9px] border border-gray-200 bg-white px-2 text-xs dark:border-white/[0.1] dark:bg-[var(--card-bg)] dark:text-white" />
          <span className="text-gray-400">–</span>
          <input type="date" value={value.end ?? ''} onChange={(e) => onChange({ ...value, end: e.target.value })}
            className="h-[34px] rounded-[9px] border border-gray-200 bg-white px-2 text-xs dark:border-white/[0.1] dark:bg-[var(--card-bg)] dark:text-white" />
        </div>
      )}
    </div>
  );
}
