'use client';

import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AttentionSegment, ATTENTION_SIGNAL_LABELS } from '@/hooks/meta-ads/useMetaAds';

const SIGNAL_BG: Record<string, string> = {
  strong: 'bg-green-500 dark:bg-green-500',
  stable: 'bg-sky-500 dark:bg-sky-500',
  weak: 'bg-amber-500 dark:bg-amber-500',
  severe_drop: 'bg-red-500 dark:bg-red-500',
};
const SIGNAL_TEXT: Record<string, string> = {
  strong: 'text-green-700 dark:text-green-400',
  stable: 'text-sky-700 dark:text-sky-400',
  weak: 'text-amber-700 dark:text-amber-400',
  severe_drop: 'text-red-700 dark:text-red-400',
};

interface Comp { code: string; type: string; name: string; startTimeSeconds: number | null; endTimeSeconds: number | null }
interface Drop { segment: string; dropPct: number; fromSeconds: number | null; toSeconds: number | null }

function intensity(norm: number) { return Math.max(0.3, Math.min(1, 0.3 + (norm / 100) * 0.7)); }
function segWidthPct(seg: AttentionSegment, vl: number | null, count: number) {
  if (vl && seg.startSecond != null && seg.endSecond != null && vl > 0) return ((seg.endSecond - seg.startSecond) / vl) * 100;
  return 100 / count;
}
function overlaps(c: Comp, d: Drop | null | undefined): boolean {
  if (!d || d.fromSeconds == null || d.toSeconds == null || c.startTimeSeconds == null || c.endTimeSeconds == null) return false;
  return c.startTimeSeconds < d.toSeconds && c.endTimeSeconds > d.fromSeconds;
}
function suggestedAction(d: Drop | null | undefined, comp: Comp | null, segments: AttentionSegment[]): string {
  if (!d) return 'Kein auffälliger Drop — Hook-Prinzip weiter ausbauen und Varianten testen.';
  const t = comp?.type;
  if (t === 'proof' || t === 'testimonial') return 'Proof-Section prüfen / alternative Proof-Version testen (behalte den davor haltenden Body).';
  if (t === 'cta' || t === 'offer_section') return 'Abschluss/CTA straffen oder vorziehen.';
  if (t === 'body' || t === 'problem_section' || t === 'solution_section' || t === 'product_demo') return 'Mittelteil/Body in diesem Abschnitt neu schneiden.';
  if (t === 'hook' || t === 'visual_opening') return 'Hook/Opening stärker gestalten — Pattern-Interrupt früher.';
  const first = segments[0];
  if (first && first.signal === 'severe_drop') return 'Starker Early-Drop — neuen Hook/Opening testen.';
  return 'Diesen Abschnitt gezielt überarbeiten und als Variante testen.';
}

/** Volle Attention Map (Ad-Detail): Timeline + Component-Overlay + Largest Drop + Action. */
export function AttentionMap({ segments, components = [], biggestDrop, videoLengthSeconds }: {
  segments: AttentionSegment[]; components?: Comp[]; biggestDrop?: Drop | null; videoLengthSeconds: number | null;
}) {
  if (!segments.length) return <p className="text-[12.5px] text-gray-400 dark:text-white/40">Zu wenige Retention-Checkpoints für eine Attention Map.</p>;
  const vl = videoLengthSeconds;
  const overlapComp = components.find((c) => overlaps(c, biggestDrop)) ?? null;
  const positioned = vl && vl > 0 && components.some((c) => c.startTimeSeconds != null && c.endTimeSeconds != null);

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-white/40"><Info className="h-3.5 w-3.5" /> Interpolated Attention Map · ungefähre Zeiten aus Meta-Checkpoints (3s/25/50/75/95/100 %), keine echte Sekunden-Retention.</div>

      {/* Timeline */}
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="flex items-stretch gap-0.5" style={{ height: 56 }}>
            {segments.map((s) => (
              <div key={s.label} className="relative flex items-end" style={{ width: `${segWidthPct(s, vl, segments.length)}%`, minWidth: 28 }}
                title={`${s.label}\nViewers: ${s.startViewers.toLocaleString('de-DE')} → ${s.endViewers.toLocaleString('de-DE')}\nRetention: ${s.retention ?? '—'} %\nDrop: ${s.drop ?? '—'} %${s.startSecond != null ? `\nca. ${s.startSecond}–${s.endSecond}s` : ''}\nSignal: ${ATTENTION_SIGNAL_LABELS[s.signal]}`}>
                <div className={cn('w-full rounded-sm', SIGNAL_BG[s.signal])} style={{ height: `${Math.max(14, s.normalizedAttention)}%`, opacity: intensity(s.normalizedAttention) }} />
              </div>
            ))}
          </div>
          {/* Achsen-/Segmentbeschriftung */}
          <div className="mt-1 flex gap-0.5">
            {segments.map((s) => (
              <div key={s.label} className="flex flex-col items-center" style={{ width: `${segWidthPct(s, vl, segments.length)}%`, minWidth: 28 }}>
                <span className="text-[9.5px] text-gray-400 dark:text-white/40">{s.label}</span>
                <span className={cn('text-[10px] font-medium tabular-nums', SIGNAL_TEXT[s.signal])}>{s.drop != null ? `−${s.drop}%` : '—'}</span>
              </div>
            ))}
          </div>

          {/* Component-Overlay */}
          {positioned && (
            <div className="relative mt-2 h-6">
              {components.filter((c) => c.startTimeSeconds != null && c.endTimeSeconds != null).map((c) => {
                const left = (c.startTimeSeconds! / (vl as number)) * 100;
                const width = ((c.endTimeSeconds! - c.startTimeSeconds!) / (vl as number)) * 100;
                return (
                  <div key={c.code} className="absolute top-0 flex h-6 items-center justify-center overflow-hidden rounded border border-accent-meta/40 bg-accent-meta/10 px-1 text-[9.5px] font-medium text-accent-meta"
                    style={{ left: `${left}%`, width: `${Math.max(6, width)}%` }} title={`${c.code} · ${c.type} · ${c.name}`}>
                    <span className="truncate">{c.type.toUpperCase()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Largest Drop + Action */}
      {biggestDrop && (
        <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <div className="font-semibold">Größter Drop: {biggestDrop.segment} · −{Math.round(biggestDrop.dropPct)} %{biggestDrop.fromSeconds != null ? ` · ca. ${biggestDrop.fromSeconds}–${biggestDrop.toSeconds}s` : ''}</div>
          {overlapComp && <div className="mt-0.5">Überschneidet sich mit <b>{overlapComp.code} · {overlapComp.type}</b> (keine Kausalität — nur zeitliche Überschneidung).</div>}
          <div className="mt-1 text-amber-800 dark:text-amber-300/90">Empfehlung: {suggestedAction(biggestDrop, overlapComp, segments)}</div>
        </div>
      )}
    </div>
  );
}

/** Kompakte Ein-Zeilen-Bar (Multi-Ad-Vergleich). Gleiche relative Timeline. */
export function AttentionBar({ segments, vl }: { segments: AttentionSegment[]; vl: number | null }) {
  if (!segments.length) return <div className="h-4 flex-1 rounded bg-gray-100 dark:bg-white/5" />;
  return (
    <div className="flex h-4 flex-1 items-stretch gap-px overflow-hidden rounded">
      {segments.map((s) => (
        <div key={s.label} className={cn(SIGNAL_BG[s.signal])} style={{ width: `${segWidthPct(s, vl, segments.length)}%`, opacity: intensity(s.normalizedAttention) }}
          title={`${s.label} · Retention ${s.retention ?? '—'} % · Drop ${s.drop ?? '—'} %`} />
      ))}
    </div>
  );
}
