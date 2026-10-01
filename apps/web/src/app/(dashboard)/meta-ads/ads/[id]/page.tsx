'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Plus, Trash2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { AdFormModal } from '@/components/meta-ads/AdFormModal';
import {
  MetaDivider, MetaSectionLabel, MetaPropertyGrid, MetaStatus, MetaEmptyState, META_FRAME, btnGhost,
} from '@/components/meta-ads/MetaUI';
import { fmtEur, fmtInt, fmtPct, fmtRoas, fmtNum, fmtSeconds, fmtDate } from '@/components/meta-ads/format';
import {
  useMetaAd, useMetaAdMetrics, useUpsertMetric, useDeleteMetric, useDeleteAd,
  FORMAT_LABELS, AWARENESS_LABELS, RANGE_LABELS, PeriodRange, DailyMetric, AggregatedMetrics,
} from '@/hooks/meta-ads/useMetaAds';

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

      {isVideo && agg && <><MetaDivider /><RetentionSection agg={agg} videoLength={ad.videoLengthSeconds} /></>}

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

function RetentionSection({ agg, videoLength }: { agg: AggregatedMetrics; videoLength: number | null }) {
  const drops = [
    { label: '25–50 %', v: agg.drop25to50, from: 25, to: 50 }, { label: '50–75 %', v: agg.drop50to75, from: 50, to: 75 },
    { label: '75–95 %', v: agg.drop75to95, from: 75, to: 95 }, { label: '95–100 %', v: agg.drop95to100, from: 95, to: 100 },
  ].filter((d) => d.v != null) as { label: string; v: number; from: number; to: number }[];
  const biggest = drops.length ? drops.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const timeAt = (p: number) => (videoLength ? Math.round((videoLength * p) / 100) : null);
  const steps = [
    { label: '25 %', v: agg.videoViews25 }, { label: '50 %', v: agg.videoViews50 }, { label: '75 %', v: agg.videoViews75 },
    { label: '95 %', v: agg.videoViews95 }, { label: '100 %', v: agg.videoViews100 },
  ];
  const max = Math.max(...steps.map((s) => s.v || 0), 1);
  const watchPct = agg.averageWatchTimeSeconds != null && videoLength ? (agg.averageWatchTimeSeconds / videoLength) * 100 : null;

  return (
    <section className="flex flex-col gap-4">
      <MetaSectionLabel>Retention</MetaSectionLabel>
      <div className="flex flex-wrap gap-x-7 gap-y-3">
        {[['Watch %', fmtPct(watchPct)], ['Ø Wiedergabe', fmtSeconds(agg.averageWatchTimeSeconds)], ['25 → 50', fmtPct(agg.retention25to50)], ['25 → 100', fmtPct(agg.completion25to100)]].map(([l, v]) => (
          <div key={l} className="flex flex-col"><span className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">{v}</span><span className="mt-0.5 text-[11.5px] text-gray-400 dark:text-white/40">{l}</span></div>
        ))}
      </div>
      <div className={cn(META_FRAME, 'flex items-end gap-2 bg-gray-50/40 p-5 dark:bg-white/[0.015]')} style={{ height: 160 }}>
        {steps.map((s) => {
          const h = Math.max(6, Math.round(((s.v || 0) / max) * 100));
          return (
            <div key={s.label} className="flex flex-1 flex-col items-center justify-end gap-1.5" style={{ height: '100%' }}>
              <div className="text-[10px] tabular-nums text-gray-400 dark:text-white/40">{fmtInt(s.v)}</div>
              <div className="flex w-full items-end" style={{ height: '100%' }}><div className="w-full rounded-t-md bg-gradient-to-t from-accent-meta/55 to-accent-meta" style={{ height: `${h}%` }} /></div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-white/50">{s.label}</div>
            </div>
          );
        })}
      </div>
      {biggest && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Größter Retention-Verlust: <b>{biggest.label}</b> ({fmtNum(biggest.v, 1)} % Drop){videoLength ? <> — ca. Sekunde {timeAt(biggest.from)}–{timeAt(biggest.to)}.</> : null}</p>}
    </section>
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
