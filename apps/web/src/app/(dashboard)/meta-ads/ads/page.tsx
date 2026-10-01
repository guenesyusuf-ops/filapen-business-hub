'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetaControls, MetaControlsValue, StatusBadge } from '@/components/meta-ads/MetaControls';
import { MetaPageHeader, MetaEmptyState, META_CARD } from '@/components/meta-ads/MetaUI';
import { AdFormModal } from '@/components/meta-ads/AdFormModal';
import { fmtEur, fmtInt, fmtPct, fmtRoas, fmtDate } from '@/components/meta-ads/format';
import {
  useMetaAdsList, AdListParams, FORMAT_LABELS, STATUS_LABELS, MaFormat, MaAdStatus,
} from '@/hooks/meta-ads/useMetaAds';

const FORMATS: MaFormat[] = ['video', 'static', 'carousel', 'gif', 'ugc', 'vsl', 'image', 'collection'];
const STATUSES: MaAdStatus[] = ['draft', 'active', 'paused', 'ended', 'archived'];

const th = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40 whitespace-nowrap';
const thR = cn(th, 'text-right');
const td = 'px-3 py-3 text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-white/80';
const tdR = cn(td, 'text-right');

export default function MetaAdsListPage() {
  const router = useRouter();
  const [controls, setControls] = useState<MetaControlsValue>({ range: 'last7' });
  const [format, setFormat] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const params: AdListParams = {
    productId: controls.productId, range: controls.range, start: controls.start, end: controls.end,
    format: format || undefined, status: status || undefined, search: search.trim() || undefined,
    page, pageSize: 25,
  };
  const { data, isLoading, isError } = useMetaAdsList(params);

  const filtersActive = !!(format || status || search.trim());
  const resetFilters = () => { setFormat(''); setStatus(''); setSearch(''); setPage(1); };
  const selectCls = 'rounded-lg border-0 bg-transparent py-1.5 pl-2 pr-7 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-meta/30 dark:text-white/80';

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-4 sm:p-6">
      <MetaPageHeader
        eyebrow="Meta Ads"
        title="Ads"
        description="Alle Ads mit aggregierter Performance im gewählten Zeitraum."
        actions={
          <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-3.5 py-2 text-sm font-medium text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Neue Ad
          </button>
        }
      >
        <MetaControls value={controls} onChange={(v) => { setControls(v); setPage(1); }} />
      </MetaPageHeader>

      {/* Zusammenhängende Filterbar */}
      <div className={cn(META_CARD, 'flex flex-wrap items-center gap-1 p-1.5')}>
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg px-2.5">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name, Meta Ad ID, Hook…"
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm focus:outline-none dark:text-white"
          />
        </div>
        <span className="hidden h-6 w-px bg-gray-200 dark:bg-white/10 sm:block" />
        <select value={format} onChange={(e) => { setFormat(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Alle Formate</option>
          {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Alle Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {filtersActive && (
          <button onClick={resetFilters} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white">
            <X className="h-3.5 w-3.5" /> Filter zurücksetzen
          </button>
        )}
      </div>

      <div className={cn(META_CARD, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-gray-100 bg-gray-50/50 dark:border-white/8 dark:bg-white/[0.02]">
              <tr>
                <th className={th}>Ad</th>
                <th className={th}>Status</th>
                <th className={cn(th, 'hidden sm:table-cell')}>Start</th>
                <th className={thR}>Spend</th>
                <th className={cn(thR, 'hidden md:table-cell')}>Impr.</th>
                <th className={cn(thR, 'hidden lg:table-cell')}>Hook</th>
                <th className={cn(thR, 'hidden lg:table-cell')}>Hold</th>
                <th className={cn(thR, 'hidden xl:table-cell')}>CTR</th>
                <th className={cn(thR, 'hidden md:table-cell')}>Unique</th>
                <th className={thR}>Umsatz</th>
                <th className={thR}>ROAS</th>
                <th className={cn(thR, 'hidden sm:table-cell')}>CPA Uniq.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 12 }).map((__, j) => (
                    <td key={j} className={td}><div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-white/5" /></td>
                  ))}</tr>
                ))
              ) : isError ? (
                <tr><td colSpan={12} className="px-3 py-10 text-center text-sm text-red-600 dark:text-red-400">Daten konnten nicht geladen werden.</td></tr>
              ) : !data?.items.length ? (
                <tr><td colSpan={12} className="p-0">
                  <MetaEmptyState
                    className="border-0 bg-transparent"
                    icon={Megaphone}
                    title={filtersActive ? 'Keine Ads für diese Filter' : 'Noch keine Ads vorhanden'}
                    description={filtersActive ? 'Filter anpassen oder zurücksetzen.' : 'Lege deine erste Ad an, um Performance zu erfassen.'}
                    actions={filtersActive
                      ? <button onClick={resetFilters} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent-meta/40">Filter zurücksetzen</button>
                      : <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"><Plus className="h-4 w-4" /> Neue Ad</button>}
                  />
                </td></tr>
              ) : (
                data.items.map((ad) => {
                  const m = ad.metrics;
                  return (
                    <tr key={ad.id} onClick={() => router.push(`/meta-ads/ads/${ad.id}`)} className="cursor-pointer transition-colors hover:bg-accent-meta/[0.04] dark:hover:bg-white/[0.03]">
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{ad.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-400 dark:text-white/40">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-white/10">{FORMAT_LABELS[ad.format]}</span>
                          {ad.productName && <span className="font-medium text-gray-500 dark:text-white/60">{ad.productName}</span>}
                          {ad.offerName && <span>· {ad.offerName}</span>}
                          {ad.angleName && <span>· {ad.angleName}</span>}
                          {ad.metaAdId && <span className="hidden sm:inline">· ID {ad.metaAdId}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={ad.status} /></td>
                      <td className={cn(td, 'hidden sm:table-cell text-gray-500 dark:text-white/50')}>{fmtDate(ad.startDate)}</td>
                      <td className={tdR}>{fmtEur(m.spend)}</td>
                      <td className={cn(tdR, 'hidden md:table-cell')}>{fmtInt(m.impressions)}</td>
                      <td className={cn(tdR, 'hidden lg:table-cell')}>{fmtPct(m.hookRate)}</td>
                      <td className={cn(tdR, 'hidden lg:table-cell')}>{fmtPct(m.holdRate)}</td>
                      <td className={cn(tdR, 'hidden xl:table-cell')}>{fmtPct(m.ctrAll)}</td>
                      <td className={cn(tdR, 'hidden md:table-cell')}>{fmtInt(m.uniqueSales)}</td>
                      <td className={tdR}>{fmtEur(m.revenue)}</td>
                      <td className={cn(tdR, 'font-medium text-accent-meta')}>{fmtRoas(m.calculatedRoas)}</td>
                      <td className={cn(tdR, 'hidden sm:table-cell')}>{fmtEur(m.cpaUnique)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2.5 text-sm dark:border-white/8">
            <span className="text-gray-500 dark:text-white/50">{data.total} Ads · Seite {data.page}/{data.totalPages}</span>
            <div className="flex gap-1.5">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">Zurück</button>
              <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">Weiter</button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-white/40">
        „ROAS" = berechneter ROAS (Umsatz ÷ Spend). Der führende Hyros ROAS steht pro Tag in der Ad-Detailansicht.
      </p>

      <AdFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
