'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Plus, Trash2, ExternalLink, Boxes, Clock, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { AdFormModal } from '@/components/meta-ads/AdFormModal';
import {
  MetaDivider, MetaSectionLabel, MetaPropertyGrid, MetaStatus, MetaEmptyState, META_FRAME, btnGhost,
} from '@/components/meta-ads/MetaUI';
import { fmtEur, fmtInt, fmtPct, fmtRoas, fmtNum, fmtSeconds, fmtDate } from '@/components/meta-ads/format';
import {
  useMetaAd, useMetaAdMetrics, useUpsertMetric, useDeleteMetric, useDeleteAd, useRetentionAnalysis,
  FORMAT_LABELS, AWARENESS_LABELS, RANGE_LABELS, PeriodRange, DailyMetric,
  RetentionAnalysis, RetentionBaseline,
} from '@/hooks/meta-ads/useMetaAds';
import { useAdComponents, useUnlinkComponent, COMPONENT_TYPE_LABELS } from '@/hooks/meta-ads/useCreative';
import { CreateComponentModal, ConfidenceDot } from '@/components/meta-ads/CreativeBits';

const RANGES: PeriodRange[] = ['last7', 'last14', 'last30', 'lifetime'];

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
    const ok = await confirm({ title: 'Ad löschen?', message: `"${ad.name}" und alle Tageswerte werden entfernt. Das kann nicht rückgängig gemacht werden.`, confirmLabel: 'Ad löschen', variant: 'danger' });
    if (!ok) return;
    try { await deleteAd.mutateAsync(ad.id); toast.success('Ad gelöscht'); router.push('/meta-ads/ads'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen'); }
  };

  if (adLoading) return <div className="mx-auto max-w-5xl p-7"><div className={cn(META_FRAME, 'h-40 animate-pulse bg-gray-50 dark:bg-white/5')} /></div>;
  if (!ad) return <div className="mx-auto max-w-5xl p-7 text-sm text-gray-500">Ad nicht gefunden. <Link href="/meta-ads/ads" className="text-accent-meta">Zurück</Link></div>;

  const agg = metrics?.aggregate;
  const isVideo = ad.format === 'video';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-7">
      <Link href="/meta-ads/ads" className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 transition hover:text-gray-900 dark:text-white/50 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Ads</Link>

      {/* Record header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.11em] text-accent-meta">{ad.productGroupName ?? 'Ad'}</div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">{ad.name}</h1>
            <MetaStatus status={ad.status} />
          </div>
          {ad.hookText && <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-gray-500 dark:text-white/50">„{ad.hookText}"</p>}
        </div>
        <div className="flex items-center gap-2">
          {ad.adLink && <a href={ad.adLink} target="_blank" rel="noopener noreferrer" className={btnGhost}>Ad öffnen <ExternalLink className="h-3.5 w-3.5" /></a>}
          <button onClick={() => setEditOpen(true)} className={btnGhost}><Pencil className="h-3.5 w-3.5" /> Bearbeiten</button>
          <button onClick={handleDeleteAd} disabled={deleteAd.isPending} className={cn(btnGhost, 'text-red-600 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-500/10')}><Trash2 className="h-3.5 w-3.5" /> Löschen</button>
        </div>
      </div>

      <MetaPropertyGrid items={[
        { k: 'Produkt', v: ad.productGroupName ?? '—' },
        { k: 'Angle', v: ad.angleName ?? '—' },
        { k: 'Awareness', v: ad.awareness ? AWARENESS_LABELS[ad.awareness] : '—' },
        { k: 'Offer', v: ad.offerName ?? '—' },
        { k: 'Format', v: FORMAT_LABELS[ad.format] },
        { k: 'Meta ID', v: ad.metaAdId ?? '—' },
        { k: 'Start', v: fmtDate(ad.startDate) },
        ...(isVideo ? [{ k: 'Video', v: ad.videoLengthSeconds ? `${ad.videoLengthSeconds}s` : '—' }] : []),
      ]} />

      <MetaDivider />

      {/* Performance */}
      <section className="flex flex-col gap-4">
        <MetaSectionLabel action={
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5 dark:border-white/10 dark:bg-[var(--card-bg)]">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cn('rounded-md px-2.5 py-1 text-[12px] font-medium transition',
                range === r ? 'bg-accent-meta/10 text-accent-meta' : 'text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white')}>{RANGE_LABELS[r]}</button>
            ))}
          </div>
        }>Performance</MetaSectionLabel>
        <div className="flex flex-wrap items-end gap-x-9 gap-y-4">
          <HeroMetric value={fmtEur(agg?.revenue ?? 0)} label="Umsatz (Hyros)" />
          <HeroMetric value={fmtRoas(agg?.calculatedRoas)} label="Berechneter ROAS" accent />
          <HeroMetric value={fmtEur(agg?.cpaUnique)} label="CPA Unique" />
        </div>
        <p className="text-[13px] text-gray-500 dark:text-white/55">
          Spend <b className="font-semibold text-gray-900 dark:text-white">{fmtEur(agg?.spend ?? 0)}</b> · Unique Sales <b className="font-semibold text-gray-900 dark:text-white">{fmtInt(agg?.uniqueSales ?? 0)}</b> · Hook <b className="font-semibold text-gray-900 dark:text-white">{fmtPct(agg?.hookRate)}</b> · Hold <b className="font-semibold text-gray-900 dark:text-white">{fmtPct(agg?.holdRate)}</b> · Ausg. CTR <b className="font-semibold text-gray-900 dark:text-white">{fmtPct(agg?.outboundCtr)}</b> · Impr. <b className="font-semibold text-gray-900 dark:text-white">{fmtInt(agg?.impressions ?? 0)}</b>
        </p>
      </section>

      {isVideo && <><MetaDivider /><RetentionAnalytics adId={ad.id} range={range} /></>}

      <MetaDivider />
      <ComponentsSection adId={ad.id} productGroupId={ad.productGroupId} isVideo={isVideo} range={range} />

      <MetaDivider />
      <DailyEntrySection adId={ad.id} isVideo={isVideo} />

      <MetaDivider />
      <HistorySection adId={ad.id} loading={mLoading} items={metrics?.items ?? []} videoLength={metrics?.videoLengthSeconds ?? null} />

      <AdFormModal open={editOpen} onClose={() => setEditOpen(false)} ad={ad} />
    </div>
  );
}

function HeroMetric({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={cn('text-[30px] font-semibold leading-none tracking-[-0.025em] tabular-nums', accent ? 'text-accent-meta' : 'text-gray-900 dark:text-white')}>{value}</span>
      <span className="mt-2 text-[12px] text-gray-500 dark:text-white/50">{label}</span>
    </div>
  );
}

function confColor(level: string) {
  return level === 'high' ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-500/15'
    : level === 'medium' ? 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/15'
    : 'text-gray-500 bg-gray-100 dark:text-white/50 dark:bg-white/10';
}
const CONF_LABEL: Record<string, string> = { high: 'Hohe Aussagekraft', medium: 'Mittlere Aussagekraft', low: 'Geringe Aussagekraft' };

function RetentionAnalytics({ adId, range }: { adId: string; range: PeriodRange }) {
  const { data, isLoading } = useRetentionAnalysis(adId, { range });
  if (isLoading) return <section className="flex flex-col gap-4"><MetaSectionLabel>Retention</MetaSectionLabel><div className={cn(META_FRAME, 'h-40 animate-pulse bg-gray-50 dark:bg-white/5')} /></section>;
  if (!data) return null;
  const { steps, biggestDrop, confidence, self, baselines, averageWatchTimeSeconds } = data;
  const max = Math.max(...steps.map((s) => s.viewers || 0), 1);

  return (
    <section className="flex flex-col gap-4">
      <MetaSectionLabel action={
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium', confColor(confidence.level))}
          title={confidence.reasons.join(' · ')}>{CONF_LABEL[confidence.level] ?? confidence.level}</span>
      }>Retention</MetaSectionLabel>

      {/* Kopfzahlen */}
      <div className="flex flex-wrap gap-x-7 gap-y-3">
        {[['Watch %', fmtPct(self?.watchPercentage)], ['Ø Wiedergabe', fmtSeconds(averageWatchTimeSeconds)], ['Hook', fmtPct(self?.hookRate)], ['Hold', fmtPct(self?.holdRate)], ['Completion 25→100', fmtPct(self?.completion25to100)]].map(([l, v]) => (
          <div key={l} className="flex flex-col"><span className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">{v}</span><span className="mt-0.5 text-[11.5px] text-gray-400 dark:text-white/40">{l}</span></div>
        ))}
      </div>

      {/* Kurve */}
      <div className={cn(META_FRAME, 'flex items-end gap-2 bg-gray-50/40 p-5 dark:bg-white/[0.015]')} style={{ height: 170 }}>
        {steps.map((s) => {
          const h = Math.max(6, Math.round(((s.viewers || 0) / max) * 100));
          return (
            <div key={s.key} className="flex flex-1 flex-col items-center justify-end gap-1.5" style={{ height: '100%' }}>
              <div className="text-[10px] tabular-nums text-gray-400 dark:text-white/40">{fmtInt(s.viewers)}</div>
              <div className="flex w-full items-end" style={{ height: '100%' }}><div className="w-full rounded-t-md bg-gradient-to-t from-accent-meta/55 to-accent-meta" style={{ height: `${h}%` }} /></div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-white/50">{s.label}</div>
              {s.timeSeconds != null && <div className="text-[10px] text-gray-400 dark:text-white/35">{s.timeSeconds}s</div>}
            </div>
          );
        })}
      </div>

      {/* Stufen-Tabelle */}
      <div className={cn(META_FRAME, 'overflow-x-auto')}>
        <table className="w-full border-collapse">
          <thead className="border-b border-gray-200/70 bg-gray-50/40 dark:border-white/[0.07] dark:bg-white/[0.015]"><tr>
            {['Stufe', 'Viewer', 'Retention', 'Drop', 'Completion', 'Zeit'].map((h, i) => <th key={h} className={cn('px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-white/40 whitespace-nowrap', i === 0 ? 'text-left' : 'text-right')}>{h}</th>)}
          </tr></thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.key} className="border-b border-gray-100 last:border-0 dark:border-white/[0.05]">
                <td className="px-4 py-2.5 text-[13px] font-medium text-gray-900 dark:text-white">{s.label}</td>
                <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-gray-700 dark:text-white/80">{fmtInt(s.viewers)}</td>
                <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-gray-700 dark:text-white/80">{fmtPct(s.retentionFromPrev)}</td>
                <td className={cn('px-4 py-2.5 text-right text-[13px] tabular-nums', (s.dropFromPrev ?? 0) >= 50 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-white/50')}>{s.dropFromPrev != null ? `−${fmtNum(s.dropFromPrev, 1)} %` : '—'}</td>
                <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-gray-500 dark:text-white/50">{fmtPct(s.completionFrom25)}</td>
                <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-gray-400 dark:text-white/40">{s.timeSeconds != null ? `${s.timeSeconds}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {biggestDrop && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Größter Retention-Verlust: <b>{biggestDrop.segment}</b> (−{fmtNum(biggestDrop.dropPct, 1)} %){biggestDrop.fromSeconds != null ? <> — ca. Sekunde {biggestDrop.fromSeconds}–{biggestDrop.toSeconds}.</> : null}
        </p>
      )}

      {/* Baseline-Vergleich */}
      {(baselines.productGroup || baselines.format) && self && (
        <div className="flex flex-col gap-2">
          <span className="text-[11.5px] font-medium text-gray-400 dark:text-white/40">Vergleich zur Baseline</span>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {baselines.productGroup && <BaselineCard self={self} base={baselines.productGroup} />}
            {baselines.format && <BaselineCard self={self} base={baselines.format} />}
          </div>
        </div>
      )}
    </section>
  );
}

function BaselineCard({ self, base }: { self: NonNullable<RetentionAnalysis['self']>; base: RetentionBaseline }) {
  const rows: [string, number | null, number | null][] = [
    ['Hook Rate', self.hookRate, base.hookRate],
    ['Hold Rate', self.holdRate, base.holdRate],
    ['Ausg. CTR', self.outboundCtr, base.outboundCtr],
    ['25→50', self.retention25to50, base.retention25to50],
    ['50→75', self.retention50to75, base.retention50to75],
    ['Watch %', self.watchPercentage, base.watchPercentage],
  ];
  return (
    <div className={cn(META_FRAME, 'p-4')}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="truncate text-[12.5px] font-semibold text-gray-900 dark:text-white">{base.label}</span>
        <span className="shrink-0 text-[11px] text-gray-400 dark:text-white/40">{base.adCount} Ad{base.adCount === 1 ? '' : 's'}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map(([label, a, b]) => {
          const delta = a != null && b != null ? Math.round((a - b) * 10) / 10 : null;
          return (
            <div key={label} className="flex items-center justify-between text-[12.5px]">
              <span className="text-gray-500 dark:text-white/50">{label}</span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="font-medium text-gray-900 dark:text-white">{fmtPct(a)}</span>
                <span className="text-gray-300 dark:text-white/25">vs {fmtPct(b)}</span>
                {delta != null && <span className={cn('w-14 text-right font-medium', delta > 0 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400')}>{delta > 0 ? '+' : ''}{fmtNum(delta, 1)}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const METRIC_GROUPS: { title: string; fields: { key: keyof DailyMetric; label: string; step?: string }[] }[] = [
  { title: 'Meta', fields: [
    { key: 'spend', label: 'Spend (€)', step: '0.01' }, { key: 'impressions', label: 'Impressionen' },
    { key: 'hookRate', label: 'Hook Rate (%)', step: '0.01' }, { key: 'holdRate', label: 'Hold Rate (%)', step: '0.01' },
    { key: 'videoViews3s', label: '3s Views' }, { key: 'videoViews25', label: '25% Views' }, { key: 'videoViews50', label: '50% Views' },
    { key: 'videoViews75', label: '75% Views' }, { key: 'videoViews95', label: '95% Views' }, { key: 'videoViews100', label: '100% Views' },
    { key: 'thruplays', label: 'ThruPlays' }, { key: 'averageWatchTimeSeconds', label: 'Ø Wiedergabe (s)', step: '0.1' },
    { key: 'cpcAll', label: 'CPC Alle (€)', step: '0.01' }, { key: 'ctrAll', label: 'CTR Alle (%)', step: '0.01' }, { key: 'outboundCtr', label: 'Ausg. CTR (%)', step: '0.01' },
  ] },
  { title: 'Hyros', fields: [
    { key: 'totalSales', label: 'Sales gesamt' }, { key: 'uniqueSales', label: 'Unique Sales' },
    { key: 'hyrosRoas', label: 'Hyros ROAS', step: '0.01' }, { key: 'revenue', label: 'Umsatz (€)', step: '0.01' },
  ] },
];
const VIDEO_ONLY = new Set(['videoViews3s', 'videoViews25', 'videoViews50', 'videoViews75', 'videoViews95', 'videoViews100', 'thruplays', 'averageWatchTimeSeconds', 'hookRate', 'holdRate']);
const inp = 'h-[36px] w-full min-w-0 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[var(--card-bg)] px-2.5 text-[13px] tabular-nums text-gray-900 dark:text-white outline-none transition focus:border-accent-meta focus:ring-2 focus:ring-accent-meta/25';

function DailyEntrySection({ adId, isVideo }: { adId: string; isVideo: boolean }) {
  const toast = useToast();
  const upsert = useUpsertMetric(adId);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vals, setVals] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!date) { toast.error('Datum erforderlich'); return; }
    const body: Record<string, unknown> = { date };
    for (const g of METRIC_GROUPS) for (const f of g.fields) { const raw = vals[f.key as string]; if (raw !== undefined && raw !== '') body[f.key as string] = Number(raw); }
    try { const res = await upsert.mutateAsync(body as any); if (res.warnings?.length) res.warnings.forEach((w) => toast.info(w)); toast.success(`Werte für ${date} gespeichert`); setVals({}); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen'); }
  };

  return (
    <section className="flex flex-col gap-4">
      <MetaSectionLabel action={
        <div className="flex items-center gap-2"><label className="text-[12px] text-gray-400 dark:text-white/40">Datum</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-[34px] rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] dark:border-white/10 dark:bg-[var(--card-bg)] dark:text-white" /></div>
      }>Tageswerte eintragen</MetaSectionLabel>
      <div className="flex flex-col gap-6">
        {METRIC_GROUPS.map((g) => {
          const fields = g.fields.filter((f) => isVideo || !VIDEO_ONLY.has(f.key as string));
          return (
            <div key={g.title}>
              <div className="mb-3 flex items-center gap-3"><span className="text-[11px] font-semibold uppercase tracking-wide text-accent-meta">{g.title}</span><span className="h-px flex-1 bg-gray-200/70 dark:bg-white/[0.07]" /></div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
                {fields.map((f) => (
                  <div key={f.key as string} className="flex min-w-0 flex-col gap-1">
                    <label className="text-[11px] text-gray-500 dark:text-white/50">{f.label}</label>
                    <input type="number" step={f.step ?? '1'} min={0} value={vals[f.key as string] ?? ''} onChange={(e) => set(f.key as string, e.target.value)} className={inp} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex justify-end"><button onClick={submit} disabled={upsert.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-110 disabled:opacity-50"><Plus className="h-4 w-4" /> {upsert.isPending ? 'Speichern…' : 'Tageswerte speichern'}</button></div>
      </div>
    </section>
  );
}

function HistorySection({ adId, loading, items, videoLength }: { adId: string; loading: boolean; items: (DailyMetric & { derived: any })[]; videoLength: number | null }) {
  const del = useDeleteMetric(adId);
  const { confirm } = useConfirm();
  const toast = useToast();
  const th = 'px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-white/40 whitespace-nowrap';
  const td = 'px-4 py-2.5 text-[13px] tabular-nums whitespace-nowrap text-gray-700 dark:text-white/80';
  const remove = async (d: string) => {
    const ok = await confirm({ title: 'Tageswerte löschen?', message: `Datensatz vom ${fmtDate(d)} entfernen.`, confirmLabel: 'Löschen', variant: 'danger' });
    if (!ok) return;
    try { await del.mutateAsync(d); toast.success('Gelöscht'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen'); }
  };
  return (
    <section className="flex flex-col gap-4">
      <MetaSectionLabel>Daily Performance</MetaSectionLabel>
      <div className={META_FRAME}>
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-5 animate-pulse rounded bg-gray-100 dark:bg-white/5" />)}</div>
        ) : !items.length ? (
          <MetaEmptyState title="Noch keine Performance-Daten" description="Trage oben Tageswerte ein oder importiere einen Report." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-gray-200/70 bg-gray-50/40 dark:border-white/[0.07] dark:bg-white/[0.015]"><tr>
                <th className={th}>Datum</th><th className={cn(th, 'text-right')}>Spend</th><th className={cn(th, 'text-right hidden sm:table-cell')}>Impr.</th>
                <th className={cn(th, 'text-right hidden md:table-cell')}>Hook</th><th className={cn(th, 'text-right hidden md:table-cell')}>Hold</th>
                <th className={cn(th, 'text-right')}>Unique</th><th className={cn(th, 'text-right')}>Umsatz</th>
                <th className={cn(th, 'text-right')}>Hyros ROAS</th><th className={cn(th, 'text-right hidden lg:table-cell')}>ROAS ber.</th><th className={cn(th, 'text-right')}></th>
              </tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-gray-100 transition last:border-0 hover:bg-gray-50 dark:border-white/[0.05] dark:hover:bg-white/[0.03]">
                    <td className={cn(td, 'font-medium text-gray-900 dark:text-white')}>{fmtDate(it.date)}</td>
                    <td className={cn(td, 'text-right')}>{fmtEur(it.spend)}</td>
                    <td className={cn(td, 'text-right hidden sm:table-cell')}>{fmtInt(it.impressions)}</td>
                    <td className={cn(td, 'text-right hidden md:table-cell')}>{fmtPct(it.hookRate)}</td>
                    <td className={cn(td, 'text-right hidden md:table-cell')}>{fmtPct(it.holdRate)}</td>
                    <td className={cn(td, 'text-right')}>{fmtInt(it.uniqueSales)}</td>
                    <td className={cn(td, 'text-right')}>{fmtEur(it.revenue)}</td>
                    <td className={cn(td, 'text-right font-semibold')}>{fmtRoas(it.hyrosRoas)}</td>
                    <td className={cn(td, 'text-right text-gray-400 dark:text-white/40 hidden lg:table-cell')}>{fmtRoas(it.derived?.calculatedRoas)}</td>
                    <td className={cn(td, 'text-right')}><button onClick={() => remove(it.date)} className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {videoLength && items.length ? <p className="text-[12px] text-gray-400 dark:text-white/40">Hyros ROAS ist der führende ROAS; „ROAS ber." = Umsatz ÷ Spend. Video {videoLength}s.</p> : null}
    </section>
  );
}

function ComponentsSection({ adId, productGroupId, isVideo, range }: { adId: string; productGroupId: string | null; isVideo: boolean; range: PeriodRange }) {
  const { data, isLoading } = useAdComponents(adId, range);
  const unlink = useUnlinkComponent(adId);
  const toast = useToast();
  const { confirm } = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);

  const drop = data?.biggestDrop ?? null;
  const items = data?.items ?? [];
  const createDefaults = drop && drop.fromSeconds != null
    ? { type: 'body' as const, startTimeSeconds: drop.fromSeconds, endTimeSeconds: drop.toSeconds ?? undefined }
    : undefined;

  const handleUnlink = async (componentId: string, name: string) => {
    const ok = await confirm({ title: 'Verknüpfung lösen?', message: `„${name}" wird von dieser Ad entfernt (die Component selbst bleibt bestehen).`, confirmLabel: 'Entfernen', variant: 'danger' });
    if (!ok) return;
    try { await unlink.mutateAsync(componentId); toast.success('Verknüpfung gelöst'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen'); }
  };

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <MetaSectionLabel>Creative Components{items.length ? ` · ${items.length}` : ''}</MetaSectionLabel>
        <button onClick={() => setCreateOpen(true)} className={btnGhost}><Plus className="h-4 w-4" /> Component anlegen</button>
      </div>

      {isVideo && drop && drop.fromSeconds != null && (
        <div className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Größter Retention-Verlust bei <b>Sekunde {drop.fromSeconds}–{drop.toSeconds}</b> (−{Math.round(drop.dropPct)} %). Lege hier eine Component an, um diesen Abschnitt zu dokumentieren und später zu iterieren.</span>
        </div>
      )}

      {isLoading ? (
        <div className={cn(META_FRAME, 'h-20 animate-pulse bg-gray-50 dark:bg-white/5')} />
      ) : !items.length ? (
        <div className={META_FRAME}>
          <MetaEmptyState icon={Boxes} title="Noch keine Components" description="Zerlege diese Ad in Hook / Body / CTA — als wiederverwendbare Bausteine fürs Creative Lab." />
        </div>
      ) : (
        <div className={cn(META_FRAME, 'divide-y divide-gray-100 dark:divide-white/[0.05]')}>
          {items.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-500 dark:bg-white/10 dark:text-white/50">{c.code}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium text-gray-900 dark:text-white">{c.name}</span>
                  <span className="rounded-full bg-accent-meta/10 px-2 py-0.5 text-[11px] font-medium text-accent-meta">{COMPONENT_TYPE_LABELS[c.type] ?? c.type}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-gray-400 dark:text-white/40">
                  {c.startTimeSeconds != null && <span>{c.startTimeSeconds}–{c.endTimeSeconds ?? '?'}s</span>}
                  {c.overlap?.overlap && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" title="Überschneidung mit dem größten Retention-Verlust">
                      ⚠ Drop-Overlap {c.overlap.overlapSeconds}s · {Math.round(c.overlap.shareOfDrop * 100)}% des Drops
                    </span>
                  )}
                  <ConfidenceDot c={c.confidence} />
                </div>
              </div>
              <button onClick={() => handleUnlink(c.id, c.name)} className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-red-500 dark:hover:bg-white/5" title="Verknüpfung lösen"><Unlink className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <CreateComponentModal open={createOpen} onClose={() => setCreateOpen(false)} adId={adId} productGroupId={productGroupId} defaults={createDefaults} />
    </section>
  );
}
