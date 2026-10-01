'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Plus, Trash2, ExternalLink, Euro, TrendingUp, Target, Users, Eye, MousePointerClick, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/meta-ads/MetaControls';
import { AdFormModal } from '@/components/meta-ads/AdFormModal';
import { MetaSectionHeader, MetaKpiCard, MetaEmptyState, META_CARD } from '@/components/meta-ads/MetaUI';
import { fmtEur, fmtInt, fmtPct, fmtRoas, fmtNum, fmtSeconds, fmtDate } from '@/components/meta-ads/format';
import {
  useMetaAd, useMetaAdMetrics, useUpsertMetric, useDeleteMetric, useDeleteAd,
  FORMAT_LABELS, AWARENESS_LABELS, RANGE_LABELS, PeriodRange, DailyMetric, AggregatedMetrics,
} from '@/hooks/meta-ads/useMetaAds';

const RANGES: PeriodRange[] = ['last7', 'last14', 'last30', 'lifetime'];
const lbl = 'text-[11px] font-medium text-gray-500 dark:text-white/50';
const fieldCls = 'w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-meta/30 focus:border-accent-meta';

export default function MetaAdDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) ?? null;
  const [range, setRange] = useState<PeriodRange>('last30');
  const [editOpen, setEditOpen] = useState(false);
  const { confirm } = useConfirm();
  const toast = useToast();
  const deleteAd = useDeleteAd();

  const { data: ad, isLoading: adLoading } = useMetaAd(id);
  const { data: metrics, isLoading: mLoading } = useMetaAdMetrics(id, { range });

  const handleDeleteAd = async () => {
    if (!ad) return;
    const ok = await confirm({
      title: 'Ad löschen?',
      message: `"${ad.name}" und alle zugehörigen Tageswerte werden entfernt. Das kann nicht rückgängig gemacht werden.`,
      confirmLabel: 'Ad löschen', variant: 'danger',
    });
    if (!ok) return;
    try { await deleteAd.mutateAsync(ad.id); toast.success('Ad gelöscht'); router.push('/meta-ads/ads'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen'); }
  };

  if (adLoading) return <div className="mx-auto max-w-6xl p-6"><div className={cn(META_CARD, 'h-40 animate-pulse bg-gray-50 dark:bg-white/5')} /></div>;
  if (!ad) return <div className="mx-auto max-w-6xl p-6 text-sm text-gray-500">Ad nicht gefunden. <Link href="/meta-ads/ads" className="text-accent-meta">Zurück</Link></div>;

  const agg = metrics?.aggregate;
  const isVideo = ad.format === 'video';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/meta-ads/ads" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Ads
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent-meta/40 hover:text-accent-meta">
            <Pencil className="h-3.5 w-3.5" /> Bearbeiten
          </button>
          <button onClick={handleDeleteAd} disabled={deleteAd.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-red-600 hover:border-red-300 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10">
            <Trash2 className="h-3.5 w-3.5" /> Löschen
          </button>
        </div>
      </div>

      {/* Ad Overview */}
      <section className={cn(META_CARD, 'p-5 sm:p-6')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-meta">
              {ad.productName ?? 'Ad'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{ad.name}</h1>
              <StatusBadge status={ad.status} />
            </div>
            {ad.hookText && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-white/50">„{ad.hookText}"</p>}
          </div>
          {ad.adLink && (
            <a href={ad.adLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent-meta hover:underline">
              Ad öffnen <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          <Info label="Produkt" value={ad.productName ?? '—'} />
          <Info label="Format" value={FORMAT_LABELS[ad.format]} />
          <Info label="Angle" value={ad.angleName ?? '—'} />
          <Info label="Offer" value={ad.offerName ?? '—'} />
          <Info label="Awareness" value={ad.awareness ? AWARENESS_LABELS[ad.awareness] : '—'} />
          <Info label="Startdatum" value={fmtDate(ad.startDate)} />
          <Info label="Meta Ad ID" value={ad.metaAdId ?? '—'} />
          {isVideo && <Info label="Video-Länge" value={ad.videoLengthSeconds ? `${ad.videoLengthSeconds}s` : '—'} />}
        </dl>
      </section>

      {/* Performance */}
      <section className="flex flex-col gap-3">
        <MetaSectionHeader
          title="Performance"
          action={
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-white/5">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setRange(r)} className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  range === r ? 'bg-white text-accent-meta shadow-sm dark:bg-white/15' : 'text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white',
                )}>{RANGE_LABELS[r]}</button>
              ))}
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetaKpiCard variant="hero" label="Spend" value={fmtEur(agg?.spend ?? 0)} icon={Euro} />
          <MetaKpiCard variant="hero" label="Umsatz (Hyros)" value={fmtEur(agg?.revenue ?? 0)} icon={TrendingUp} />
          <MetaKpiCard variant="hero" label="Berechneter ROAS" value={fmtRoas(agg?.calculatedRoas)} sub="Umsatz ÷ Spend" accent icon={TrendingUp} />
          <MetaKpiCard variant="hero" label="CPA Unique" value={fmtEur(agg?.cpaUnique)} icon={Target} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetaKpiCard label="Impressionen" value={fmtInt(agg?.impressions ?? 0)} icon={Eye} />
          <MetaKpiCard label="Unique Sales" value={fmtInt(agg?.uniqueSales ?? 0)} icon={Users} />
          <MetaKpiCard label="Sales gesamt" value={fmtInt(agg?.totalSales ?? 0)} icon={Users} />
          <MetaKpiCard label="CPA Gesamt" value={fmtEur(agg?.cpaTotal)} icon={Target} />
          <MetaKpiCard label="Hook / Hold" value={`${fmtPct(agg?.hookRate)} · ${fmtPct(agg?.holdRate)}`} icon={MousePointerClick} />
          <MetaKpiCard label="CTR / Ausg." value={`${fmtPct(agg?.ctrAll)} · ${fmtPct(agg?.outboundCtr)}`} icon={MousePointerClick} />
        </div>
      </section>

      {/* Retention (nur Video) */}
      {isVideo && agg && <RetentionSection agg={agg} videoLength={ad.videoLengthSeconds} />}

      {/* Data Entry */}
      <DailyEntrySection adId={ad.id} isVideo={isVideo} />

      {/* Daily Metrics */}
      <HistorySection adId={ad.id} loading={mLoading} items={metrics?.items ?? []} videoLength={metrics?.videoLengthSeconds ?? null} />

      <AdFormModal open={editOpen} onClose={() => setEditOpen(false)} ad={ad} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/40">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}

function RetentionSection({ agg, videoLength }: { agg: AggregatedMetrics; videoLength: number | null }) {
  const drops = [
    { label: '25–50 %', v: agg.drop25to50, from: 25, to: 50 },
    { label: '50–75 %', v: agg.drop50to75, from: 50, to: 75 },
    { label: '75–95 %', v: agg.drop75to95, from: 75, to: 95 },
    { label: '95–100 %', v: agg.drop95to100, from: 95, to: 100 },
  ].filter((d) => d.v != null) as { label: string; v: number; from: number; to: number }[];
  const biggest = drops.length ? drops.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const timeAt = (pct: number) => (videoLength ? Math.round((videoLength * pct) / 100) : null);
  const steps = [
    { label: '25 %', v: agg.videoViews25 }, { label: '50 %', v: agg.videoViews50 },
    { label: '75 %', v: agg.videoViews75 }, { label: '95 %', v: agg.videoViews95 }, { label: '100 %', v: agg.videoViews100 },
  ];
  const max = Math.max(...steps.map((s) => s.v || 0), 1);
  const watchPct = agg.averageWatchTimeSeconds != null && videoLength ? (agg.averageWatchTimeSeconds / videoLength) * 100 : null;

  return (
    <section className="flex flex-col gap-3">
      <MetaSectionHeader title="Retention" description="Video-Verweildauer über die Wiedergabestufen" />
      <div className={cn(META_CARD, 'p-5')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Watch %', value: fmtPct(watchPct) },
            { label: 'Ø Wiedergabe', value: fmtSeconds(agg.averageWatchTimeSeconds) },
            { label: '25 → 50', value: fmtPct(agg.retention25to50) },
            { label: '25 → 100', value: fmtPct(agg.completion25to100) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
              <div className="text-[11px] text-gray-400 dark:text-white/40">{s.label}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-end gap-2">
          {steps.map((s) => {
            const h = Math.max(6, Math.round(((s.v || 0) / max) * 100));
            return (
              <div key={s.label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="text-[10px] tabular-nums text-gray-400 dark:text-white/40">{fmtInt(s.v)}</div>
                <div className="flex h-28 w-full items-end">
                  <div className="w-full rounded-t-md bg-gradient-to-t from-accent-meta/60 to-accent-meta transition-all" style={{ height: `${h}%` }} />
                </div>
                <div className="text-[11px] font-medium text-gray-500 dark:text-white/50">{s.label}</div>
              </div>
            );
          })}
        </div>

        {biggest && (
          <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Größter gemessener Retention-Verlust: <strong>{biggest.label}</strong> ({fmtNum(biggest.v, 1)} % Drop)
            {videoLength ? <> — ungefähr Sekunde {timeAt(biggest.from)}–{timeAt(biggest.to)} im Video.</> : null}
          </p>
        )}
      </div>
    </section>
  );
}

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
const VIDEO_ONLY = new Set(['videoViews3s', 'videoViews25', 'videoViews50', 'videoViews75', 'videoViews95', 'videoViews100', 'thruplays', 'averageWatchTimeSeconds', 'hookRate', 'holdRate']);

function DailyEntrySection({ adId, isVideo }: { adId: string; isVideo: boolean }) {
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
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen'); }
  };

  return (
    <section className="flex flex-col gap-3">
      <MetaSectionHeader
        title="Tageswerte eintragen"
        description="Manuelle Erfassung — nur gefüllte Felder werden gespeichert."
        action={
          <div className="flex items-center gap-2">
            <label className={lbl}>Datum</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-meta/30" />
          </div>
        }
      />
      <div className={cn(META_CARD, 'flex flex-col gap-6 p-5')}>
        {METRIC_GROUPS.map((g) => {
          const fields = g.fields.filter((f) => isVideo || !VIDEO_ONLY.has(f.key as string));
          return (
            <div key={g.title}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-accent-meta">{g.title}</span>
                <span className="h-px flex-1 bg-gray-100 dark:bg-white/8" />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
                {fields.map((f) => (
                  <div key={f.key as string} className="flex flex-col gap-1">
                    <label className="text-[11px] text-gray-500 dark:text-white/50">{f.label}</label>
                    <input type="number" step={f.step ?? '1'} min={0} value={vals[f.key as string] ?? ''} onChange={(e) => set(f.key as string, e.target.value)}
                      className="rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-meta/30 focus:border-accent-meta" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex justify-end border-t border-gray-100 pt-4 dark:border-white/8">
          <button onClick={submit} disabled={upsert.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            <Plus className="h-4 w-4" /> {upsert.isPending ? 'Speichern…' : 'Tageswerte speichern'}
          </button>
        </div>
      </div>
    </section>
  );
}

function HistorySection({ adId, loading, items, videoLength }: {
  adId: string; loading: boolean; items: (DailyMetric & { derived: any })[]; videoLength: number | null;
}) {
  const del = useDeleteMetric(adId);
  const { confirm } = useConfirm();
  const toast = useToast();
  const th = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40 whitespace-nowrap';
  const td = 'px-3 py-2.5 text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-white/80';

  const remove = async (date: string) => {
    const ok = await confirm({ title: 'Tageswerte löschen?', message: `Datensatz vom ${fmtDate(date)} entfernen.`, confirmLabel: 'Löschen', variant: 'danger' });
    if (!ok) return;
    try { await del.mutateAsync(date); toast.success('Gelöscht'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen'); }
  };

  return (
    <section className="flex flex-col gap-3">
      <MetaSectionHeader title="Tageshistorie" count={items.length || undefined} />
      <div className={cn(META_CARD, 'overflow-hidden')}>
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-5 animate-pulse rounded bg-gray-100 dark:bg-white/5" />)}</div>
        ) : !items.length ? (
          <MetaEmptyState className="border-0 bg-transparent" icon={Database} title="Noch keine Performance-Daten" description="Trage oben Tageswerte ein oder importiere einen Report." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50/50 dark:bg-white/[0.02]">
                <tr>
                  <th className={th}>Datum</th>
                  <th className={cn(th, 'text-right')}>Spend</th>
                  <th className={cn(th, 'text-right hidden sm:table-cell')}>Impr.</th>
                  <th className={cn(th, 'text-right hidden md:table-cell')}>Hook</th>
                  <th className={cn(th, 'text-right hidden md:table-cell')}>Hold</th>
                  <th className={cn(th, 'text-right')}>Unique</th>
                  <th className={cn(th, 'text-right')}>Umsatz</th>
                  <th className={cn(th, 'text-right')}>Hyros ROAS</th>
                  <th className={cn(th, 'text-right hidden sm:table-cell')}>ROAS (ber.)</th>
                  <th className={cn(th, 'text-right hidden lg:table-cell')}>CPA Uniq.</th>
                  <th className={cn(th, 'text-right')}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <td className={cn(td, 'font-medium text-gray-900 dark:text-white')}>{fmtDate(it.date)}</td>
                    <td className={cn(td, 'text-right')}>{fmtEur(it.spend)}</td>
                    <td className={cn(td, 'text-right hidden sm:table-cell')}>{fmtInt(it.impressions)}</td>
                    <td className={cn(td, 'text-right hidden md:table-cell')}>{fmtPct(it.hookRate)}</td>
                    <td className={cn(td, 'text-right hidden md:table-cell')}>{fmtPct(it.holdRate)}</td>
                    <td className={cn(td, 'text-right')}>{fmtInt(it.uniqueSales)}</td>
                    <td className={cn(td, 'text-right')}>{fmtEur(it.revenue)}</td>
                    <td className={cn(td, 'text-right font-medium')}>{fmtRoas(it.hyrosRoas)}</td>
                    <td className={cn(td, 'text-right text-gray-400 dark:text-white/40 hidden sm:table-cell')}>{fmtRoas(it.derived?.calculatedRoas)}</td>
                    <td className={cn(td, 'text-right hidden lg:table-cell')}>{fmtEur(it.derived?.cpaUnique)}</td>
                    <td className={cn(td, 'text-right')}>
                      <button onClick={() => remove(it.date)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {videoLength && items.length ? <div className="border-t border-gray-100 px-5 py-2 text-xs text-gray-400 dark:border-white/8 dark:text-white/40">Video-Länge {videoLength}s · Hyros ROAS ist der führende ROAS; „ROAS (ber.)" = Umsatz ÷ Spend.</div> : null}
      </div>
    </section>
  );
}
