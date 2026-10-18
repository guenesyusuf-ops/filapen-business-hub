import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ds } from './tokens';

export interface KpiTileProps {
  label: ReactNode;
  value: ReactNode;
  /** Veränderungs-Delta (z. B. "12,4 %"). */
  delta?: ReactNode;
  /** Richtung des Deltas — steuert nur die semantische Farbe, nicht den Akzent. */
  trend?: 'up' | 'down' | 'flat';
  /** Optionaler Sparkline-/Grafik-Slot rechts oben. */
  visual?: ReactNode;
  className?: string;
}

/**
 * KPI-Kachel: große, tabulare Zahl, zurückhaltendes Label, semantisches Delta.
 * Neutrale Fläche — kein eingefärbter Hintergrund (Farbe nur über Semantik/Trend).
 */
export function KpiTile({ label, value, delta, trend = 'flat', visual, className }: KpiTileProps) {
  const trendCls =
    trend === 'up' ? 'text-success' : trend === 'down' ? 'text-error' : 'text-[var(--text-secondary)]';
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
  return (
    <div
      className={cn(
        ds.card,
        ds.rCard,
        ds.shadowCard,
        ds.ease,
        'relative min-h-[110px] p-[18px] flex flex-col gap-[11px] hover:border-[var(--border-color)] hover:-translate-y-px',
        className,
      )}
    >
      <div className="text-[12.5px] font-medium text-[var(--text-secondary)]">{label}</div>
      <div className="font-semibold text-[34px] leading-none tracking-[-0.022em] text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
        {value}
      </div>
      {delta != null && (
        <div className={cn('text-[12.5px] font-semibold inline-flex items-center gap-1', trendCls)}>
          {arrow && <span aria-hidden="true">{arrow}</span>}
          {delta}
        </div>
      )}
      {visual && <div className="absolute right-[18px] top-[18px]">{visual}</div>}
    </div>
  );
}
