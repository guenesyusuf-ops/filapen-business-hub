'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MetaSectionLabel, META_FRAME } from '@/components/meta-ads/MetaUI';
import { useProductAttention, PeriodRange } from '@/hooks/meta-ads/useMetaAds';
import { AttentionBar } from '@/components/meta-ads/AttentionMap';

/**
 * Produkt-Level Attention-Vergleich (interpoliert aus Meta-Checkpoints).
 * Geteilt zwischen Creative-Lab-Attention-Tab und ggf. anderen Stellen —
 * keine Logik-Duplikation.
 */
export function AttentionComparison({ productGroupId, range, start, end }: { productGroupId?: string; range?: PeriodRange; start?: string; end?: string }) {
  const router = useRouter();
  const { data, isLoading } = useProductAttention({ productGroupId, range, start, end });
  const header = <MetaSectionLabel>Attention-Vergleich (interpoliert)</MetaSectionLabel>;
  if (!productGroupId) return <section className="flex flex-col gap-3">{header}<p className="text-[12.5px] text-gray-400 dark:text-white/40">Wähle oben eine Produktgruppe, um die Aufmerksamkeitsverläufe der Video-Ads nebeneinander zu sehen.</p></section>;
  if (isLoading) return <section className="flex flex-col gap-3">{header}<div className={cn(META_FRAME, 'h-32 animate-pulse bg-gray-50 dark:bg-white/5')} /></section>;
  const ads = data?.ads ?? [];
  if (!ads.length) return <section className="flex flex-col gap-3">{header}<p className="text-[12.5px] text-gray-400 dark:text-white/40">Keine Video-Ads mit genügend Retention-Checkpoints in diesem Zeitraum.</p></section>;

  return (
    <section className="flex flex-col gap-3">
      {header}
      <p className="text-[11px] text-gray-400 dark:text-white/40">Interpolierte Aufmerksamkeit aus Meta-Checkpoints (3s/25/50/75/95/100 %) — ungefähre Zeiten, keine echte Sekunden-Retention. Sortiert nach Hook Rate.</p>
      <div className={cn(META_FRAME, 'flex flex-col divide-y divide-gray-100 dark:divide-white/[0.05]')}>
        {ads.map((a) => (
          <button key={a.adId} onClick={() => router.push(`/meta-ads/ads/${a.adId}`)}
            className="flex flex-col gap-1.5 px-4 py-3 text-left transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[13px] font-medium text-gray-900 dark:text-white">{a.name}</span>
              <span className="shrink-0 text-[11.5px] tabular-nums text-gray-400 dark:text-white/40">Hook {a.hookRate != null ? `${Math.round(a.hookRate)}%` : '—'}</span>
            </div>
            <AttentionBar segments={a.segments} vl={a.videoLengthSeconds} />
            {a.biggestDrop && (
              <span className="text-[11px] text-amber-700 dark:text-amber-400">Größter Drop: {a.biggestDrop.segment} · −{Math.round(a.biggestDrop.dropPct)} %{a.biggestDrop.fromSeconds != null ? ` · ca. ${a.biggestDrop.fromSeconds}–${a.biggestDrop.toSeconds}s` : ''}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
