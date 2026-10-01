'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Pencil, Plus, Trash2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/meta-ads/MetaControls';
import { AdFormModal } from '@/components/meta-ads/AdFormModal';
import { fmtEur, fmtInt, fmtPct, fmtRoas, fmtNum, fmtSeconds, fmtDate } from '@/components/meta-ads/format';
import {
  useMetaAd, useMetaAdMetrics, useUpsertMetric, useDeleteMetric,
  FORMAT_LABELS, AWARENESS_LABELS, RANGE_LABELS, PeriodRange, DailyMetric, AggregatedMetrics,
} from '@/hooks/meta-ads/useMetaAds';

const CARD = 'rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card';
const RANGES: PeriodRange[] = ['last7', 'last14', 'last30', 'lifetime'];
const lbl = 'text-xs font-medium text-gray-500 dark:text-white/50';

export default function MetaAdDetailPage() {
  const params = useParams();
  const id = (params?.id as string) ?? null;
  const [range, setRange] = useState<PeriodRange>('last30');
  const [editOpen, setEditOpen] = useState(false);

  const { data: ad, isLoading: adLoading } = useMetaAd(id);
  const { data: metrics, isLoading: mLoading } = useMetaAdMetrics(id, { range });

  if (adLoading) return <div className="mx-auto max-w-6xl p-6"><div className={cn(CARD, 'h-32 animate-pulse bg-gray-50 dark:bg-white/5')} /></div>;
  if (!ad) return <div className="mx-auto max-w-6xl p-6 text-sm text-gray-500">Ad nicht gefunden. <Link href="/meta-ads/ads" className="text-accent-meta">Zurück</Link></div>;

  const agg = metrics?.aggregate;
  const isVideo = ad.format === 'video';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/meta-ads/ads" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Ads
        </Link>
        <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent-meta/40 hover:text-accent-meta">
          <Pencil className="h-3.5 w-3.5" /> Bearbeiten
        </button>
      </div>

      {/* Ad-Info */}
      <div className={cn(CARD, 'p-5')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{ad.name}</h1>
              <StatusBadge status={ad.status} />
            </div>
            {ad.hookText && <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-white/50">„{ad.hookText}"</p>}
          </div>
          {ad.adLink && (
            <a href={ad.adLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent-meta hover:underline">
              Ad öffnen <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Info label="Format" value={FORMAT_LABELS[ad.format]} />
          <Info label="Angle" value={ad.angleName ?? '—'} />
          <Info label="Offer" value={ad.offerName ?? '—'} />
          <Info label="Awareness" value={ad.awareness ? AWARENESS_LABELS[ad.awareness] : '—'} />
          <Info label="Startdatum" value={fmtDate(ad.startDate)} />
          <Info label="Meta Ad ID" value={ad.metaAdId ?? '—'} />
          {isVideo && <Info label="Video-Länge" value={ad.videoLengthSeconds ? `${ad.videoLengthSeconds}s` : '—'} />}
        </dl>
      </div>

      {/* Zeitraum */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 dark:bg-white/5 p-1 self-start">
        {RANGES.map((r) => (
          <button key={r} onClick={() => setRange(r)} className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            range === r ? 'bg-white dark:bg-white/15 text-accent-meta shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white',
          )}>{RANGE_LABELS[r]}</button>
        ))}
      </div>

      {/* Performance Summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Kpi label="Spend" value={fmtEur(agg?.spend ?? 0)} />
        <Kpi label="Impressionen" value={fmtInt(agg?.impressions ?? 0)} />
        <Kpi label="Unique Sales" value={fmtInt(agg?.uniqueSales ?? 0)} />
        <Kpi label="Sales gesamt" value={fmtInt(agg?.totalSales ?? 0)} />
        <Kpi label="Umsatz (Hyros)" value={fmtEur(agg?.revenue ?? 0)} />
        <Kpi label="ROAS (berechnet)" value={fmtRoas(agg?.calculatedRoas)} accent />
        <Kpi label="CPA Unique" value={fmtEur(agg?.cpaUnique)} />
        <Kpi label="CPA Gesamt" value={fmtEur(agg?.cpaTotal)} />
        <Kpi label="Hook Rate" value={fmtPct(agg?.hookRate)} />
        <Kpi label="Hold Rate" value={fmtPct(agg?.holdRate)} />
        <Kpi label="CTR (Alle)" value={fmtPct(agg?.ctrAll)} />
        <Kpi label="Ausg. CTR" value={fmtPct(agg?.outboundCtr)} />
      </section>

      {isVideo && agg && <RetentionCard agg={agg} videoLength={ad.videoLengthSeconds} />}

      {/* Manuelle Eingabe */}
      <DailyEntryForm adId={ad.id} isVideo={isVideo} />

      {/* Tageshistorie */}
      <HistoryTable
        adId={ad.id}
        loading={mLoading}
        items={metrics?.items ?? []}
        videoLength={metrics?.videoLengthSeconds ?? null}
      />

      <AdFormModal open={editOpen} onClose={() => setEditOpen(false)} ad={ad} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 dark:text-white/40">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn(CARD, 'p-3.5')}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-white/40">{label}</div>
      <div className={cn('mt-1 text-lg font-semibold tabular-nums', accent ? 'text-accent-meta' : 'text-gray-900 dark:text-white')}>{value}</div>
    </div>
  );
}

function RetentionCard({ agg, videoLength }: { agg: AggregatedMetrics; videoLength: number | null }) {
  const drops = [
    { label: '25–50%', v: agg.drop25to50, from: 25, to: 50 },
    { label: '50–75%', v: agg.drop50to75, from: 50, to: 75 },
    { label: '75–95%', v: agg.drop75to95, from: 75, to: 95 },
    { label: '95–100%', v: agg.drop95to100, from: 95, to: 100 },
  ].filter((d) => d.v != null) as { label: string; v: number; from: number; to: number }[];
  const biggest = drops.length ? drops.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const timeAt = (pct: number) => (videoLength ? Math.round((videoLength * pct) / 100) : null);

  return (
    <section className={cn(CARD, 'p-5')}>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Retention</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Watch %', value: fmtPct(agg.averageWatchTimeSeconds != null && videoLength ? (agg.averageWatchTimeSeconds / videoLength) * 100 : null) },
          { label: 'Ø Wiedergabe', value: fmtSeconds(agg.averageWatchTimeSeconds) },
          { label: '25→50', value: fmtPct(agg.retention25to50) },
          { label: '50→75', value: fmtPct(agg.retention50to75) },
          { label: '75→100', value: fmtPct(agg.completion25to100 != null ? agg.retention75to95 : null) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">
            <div className="text-xs text-gray-400 dark:text-white/40">{s.label}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Stufen-Visualisierung */}
      <div className="mt-4 flex items-end gap-1.5">
        {[
          { label: '25%', v: agg.videoViews25 },
          { label: '50%', v: agg.videoViews50 },
          { label: '75%', v: agg.videoViews75 },
          { label: '95%', v: agg.videoViews95 },
          { label: '100%', v: agg.videoViews100 },
        ].map((s, i, arr) => {
          const max = Math.max(...arr.map((x) => x.v || 0), 1);
          const h = Math.max(6, Math.round(((s.v || 0) / max) * 100));
          return (
            <div key={s.label} className="flex flex-1 flex-col items-center gap-1">
              <div className="text-[10px] tabular-nums text-gray-400 dark:text-white/40">{fmtInt(s.v)}</div>
              <div className="flex h-24 w-full items-end">
                <div className="w-full rounded-t bg-accent-meta/70" style={{ height: `${h}%` }} />
              </div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-white/50">{s.label}</div>
            </div>
          );
        })}
      </div>

      {biggest && (
        <p className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          Größter gemessener Retention-Verlust: <strong>{biggest.label}</strong> ({fmtNum(biggest.v, 1)} % Drop)
          {videoLength ? <> — ungefähr Sekunde {timeAt(biggest.from)}–{timeAt(biggest.to)} im Video.</> : null}
        </p>
      )}
    </section>
  );
}

// --- Manuelle Tageseingabe ---

const METRIC_GROUPS: { title: string; fields: { key: keyof DailyMetric; label: string; step?: string }[] }[] = [
  {
    title: 'Meta',
    fields: [
      { key: 'spend', label: 'Spend (€)', step: '0.01' },
      { key: 'impressions', label: 'Impressionen' },
      { key: 'hookRate', label: 'Hook Rate (%)', step: '0.01' },
      { key: 'holdRate', label: 'Hold Rate (%)', step: '0.01' },
      { key: 'videoViews3s', label: '3s Views' },
      { key: 'videoViews25', label: '25% Views' },
      { key: 'videoViews50', label: '50% Views' },
      { key: 'videoViews75', label: '75% Views' },
      { key: 'videoViews95', label: '95% Views' },
      { key: 'videoViews100', label: '100% Views' },
      { key: 'thruplays', label: 'ThruPlays' },
      { key: 'averageWatchTimeSeconds', label: 'Ø Wiedergabe (s)', step: '0.1' },
      { key: 'cpcAll', label: 'CPC Alle (€)', step: '0.01' },
      { key: 'ctrAll', label: 'CTR Alle (%)', step: '0.01' },
      { key: 'outboundCtr', label: 'Ausg. CTR (%)', step: '0.01' },
    ],
  },
  {
    title: 'Hyros',
    fields: [
      { key: 'totalSales', label: 'Sales gesamt' },
      { key: 'uniqueSales', label: 'Unique Sales' },
      { key: 'hyrosRoas', label: 'Hyros ROAS', step: '0.01' },
      { key: 'revenue', label: 'Umsatz (€)', step: '0.01' },
    ],
  },
];

function DailyEntryForm({ adId, isVideo }: { adId: string; isVideo: boolean }) {
  const toast = useToast();
  const upsert = useUpsertMetric(adId);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vals, setVals] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!date) { toast.error('Datum erforderlich'); return; }
    const body: Record<string, unknown> = { date };
    for (const g of METRIC_GROUPS) for (const f of g.fields) {
      const raw = vals[f.key as string];
      if (raw !== undefined && raw !== '') body[f.key as string] = Number(raw);
    }
    try {
      const res = await upsert.mutateAsync(body as any);
      if (res.warnings?.length) res.warnings.forEach((w) => toast.info(w));
      toast.success(`Werte für ${date} gespeichert`);
      setVals({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    }
  };

  return (
    <section className={cn(CARD, 'p-5')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tageswerte eintragen</h2>
        <div className="flex items-center gap-2">
          <label className={lbl}>Datum</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-meta/30" />
        </div>
      </div>
      {METRIC_GROUPS.map((g) => (
        <div key={g.title} className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-meta">{g.title}</div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {g.fields
              .filter((f) => isVideo || !['videoViews3s', 'videoViews25', 'videoViews50', 'videoViews75', 'videoViews95', 'videoViews100', 'thruplays', 'averageWatchTimeSeconds', 'hookRate', 'holdRate'].includes(f.key as string))
              .map((f) => (
                <div key={f.key as string} className="flex flex-col gap-1">
                  <label className="text-[11px] text-gray-500 dark:text-white/50">{f.label}</label>
                  <input
                    type="number" step={f.step ?? '1'} min={0}
                    value={vals[f.key as string] ?? ''}
                    onChange={(e) => set(f.key as string, e.target.value)}
                    className="rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-meta/30"
                  />
                </div>
              ))}
          </div>
        </div>
      ))}
      <div className="mt-4 flex justify-end">
        <button onClick={submit} disabled={upsert.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          <Plus className="h-4 w-4" /> {upsert.isPending ? 'Speichern…' : 'Tageswerte speichern'}
        </button>
      </div>
    </section>
  );
}

function HistoryTable({ adId, loading, items, videoLength }: {
  adId: string; loading: boolean;
  items: (DailyMetric & { derived: any })[]; videoLength: number | null;
}) {
  const del = useDeleteMetric(adId);
  const { confirm } = useConfirm();
  const toast = useToast();
  const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-white/40 whitespace-nowrap';
  const td = 'px-3 py-2 text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-white/80';

  const remove = async (date: string) => {
    const ok = await confirm({ title: 'Tageswerte löschen?', message: `Datensatz vom ${fmtDate(date)} entfernen.`, confirmLabel: 'Löschen', variant: 'danger' });
    if (!ok) return;
    try { await del.mutateAsync(date); toast.success('Gelöscht'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen'); }
  };

  return (
    <section className={cn(CARD, 'overflow-hidden')}>
      <div className="border-b border-gray-100 dark:border-white/8 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tageshistorie</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50/60 dark:bg-white/[0.02]">
            <tr>
              <th className={th}>Datum</th>
              <th className={cn(th, 'text-right')}>Spend</th>
              <th className={cn(th, 'text-right')}>Impr.</th>
              <th className={cn(th, 'text-right')}>Hook</th>
              <th className={cn(th, 'text-right')}>Hold</th>
              <th className={cn(th, 'text-right')}>Unique</th>
              <th className={cn(th, 'text-right')}>Umsatz</th>
              <th className={cn(th, 'text-right')}>Hyros ROAS</th>
              <th className={cn(th, 'text-right')}>ROAS (ber.)</th>
              <th className={cn(th, 'text-right')}>CPA Uniq.</th>
              <th className={cn(th, 'text-right')}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 11 }).map((__, j) => <td key={j} className={td}><div className="h-4 animate-pulse rounded bg-gray-100 dark:bg-white/5" /></td>)}</tr>
              ))
            ) : !items.length ? (
              <tr><td colSpan={11} className="px-3 py-12 text-center">
                <div className="text-sm font-medium text-gray-700 dark:text-white/70">Noch keine Performance-Daten.</div>
                <div className="mt-1 text-xs text-gray-400 dark:text-white/40">Trage oben Tageswerte ein.</div>
              </td></tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                  <td className={cn(td, 'font-medium text-gray-900 dark:text-white')}>{fmtDate(it.date)}</td>
                  <td className={cn(td, 'text-right')}>{fmtEur(it.spend)}</td>
                  <td className={cn(td, 'text-right')}>{fmtInt(it.impressions)}</td>
                  <td className={cn(td, 'text-right')}>{fmtPct(it.hookRate)}</td>
                  <td className={cn(td, 'text-right')}>{fmtPct(it.holdRate)}</td>
                  <td className={cn(td, 'text-right')}>{fmtInt(it.uniqueSales)}</td>
                  <td className={cn(td, 'text-right')}>{fmtEur(it.revenue)}</td>
                  <td className={cn(td, 'text-right font-medium')}>{fmtRoas(it.hyrosRoas)}</td>
                  <td className={cn(td, 'text-right text-gray-400 dark:text-white/40')}>{fmtRoas(it.derived?.calculatedRoas)}</td>
                  <td className={cn(td, 'text-right')}>{fmtEur(it.derived?.cpaUnique)}</td>
                  <td className={cn(td, 'text-right')}>
                    <button onClick={() => remove(it.date)} className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {videoLength && <div className="border-t border-gray-100 dark:border-white/8 px-5 py-2 text-xs text-gray-400 dark:text-white/40">Video-Länge {videoLength}s · Hyros ROAS ist der führende ROAS; „ROAS (ber.)" = Umsatz ÷ Spend.</div>}
    </section>
  );
}
