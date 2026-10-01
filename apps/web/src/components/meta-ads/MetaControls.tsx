'use client';

import { cn } from '@/lib/utils';
import { useMetaProducts, RANGE_LABELS, PeriodRange } from '@/hooks/meta-ads/useMetaAds';

const RANGES: PeriodRange[] = ['today', 'yesterday', 'last3', 'last7', 'last14', 'last30', 'lifetime', 'custom'];

export interface MetaControlsValue {
  productId?: string;
  range: PeriodRange;
  start?: string;
  end?: string;
}

interface Props {
  value: MetaControlsValue;
  onChange: (next: MetaControlsValue) => void;
  className?: string;
}

/**
 * Product Switcher + Zeitraum-Auswahl. Sticky-fähige Steuerleiste, die auf
 * Overview und Ads-Liste geteilt wird. Produktbezogen ist Standard; "Alle
 * Produkte" ist der produktübergreifende Modus.
 */
export function MetaControls({ value, onChange, className }: Props) {
  const { data: products, isLoading } = useMetaProducts();

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-3 shadow-card sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500 dark:text-white/50">Produkt</label>
        <select
          value={value.productId ?? ''}
          onChange={(e) => onChange({ ...value, productId: e.target.value || undefined })}
          disabled={isLoading}
          className="min-w-[180px] rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-meta/30 focus:border-accent-meta"
        >
          <option value="">Alle Produkte</option>
          {products?.items.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 dark:bg-white/5 p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onChange({ ...value, range: r })}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                value.range === r
                  ? 'bg-white dark:bg-white/15 text-accent-meta shadow-sm'
                  : 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white',
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        {value.range === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={value.start ?? ''}
              onChange={(e) => onChange({ ...value, start: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-meta/30"
            />
            <span className="text-gray-400">–</span>
            <input
              type="date"
              value={value.end ?? ''}
              onChange={(e) => onChange({ ...value, end: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-meta/30"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
    paused: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    ended: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/60',
    draft: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    archived: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-white/40',
  };
  const labels: Record<string, string> = {
    active: 'Aktiv', paused: 'Pausiert', ended: 'Beendet', draft: 'Entwurf', archived: 'Archiviert',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', map[status] ?? map.draft)}>
      {labels[status] ?? status}
    </span>
  );
}
