'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetaControls, MetaControlsValue, StatusBadge } from '@/components/meta-ads/MetaControls';
import { AdFormModal } from '@/components/meta-ads/AdFormModal';
import { fmtEur, fmtInt, fmtPct, fmtRoas, fmtDate } from '@/components/meta-ads/format';
import {
  useMetaAdsList, AdListParams, FORMAT_LABELS, STATUS_LABELS, MaFormat, MaAdStatus,
} from '@/hooks/meta-ads/useMetaAds';

const CARD = 'rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card';
const FORMATS: MaFormat[] = ['video', 'static', 'carousel', 'gif', 'ugc', 'vsl', 'image', 'collection'];
const STATUSES: MaAdStatus[] = ['draft', 'active', 'paused', 'ended', 'archived'];

const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-white/40 whitespace-nowrap';
const td = 'px-3 py-2.5 text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-white/80';

export default function MetaAdsListPage() {
  const router = useRouter();
  const [controls, setControls] = useState<MetaControlsValue>({ range: 'last7' });
  const [format, setFormat] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const params: AdListParams = {
    productId: controls.productId,
    range: controls.range,
    start: controls.start,
    end: controls.end,
    format: format || undefined,
    status: status || undefined,
    search: search.trim() || undefined,
    page,
    pageSize: 25,
  };
  const { data, isLoading, isError } = useMetaAdsList(params);

  const inputCls = 'rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-meta/30';

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Ads</h1>
          <p className="text-sm text-gray-500 dark:text-white/50">Alle Meta Ads mit aggregierter Performance im gewählten Zeitraum.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-3.5 py-2 text-sm font-medium text-white hover:opacity-90">
          <Plus className="h-4 w-4" /> Neue Ad
        </button>
      </header>

      <MetaControls value={controls} onChange={(v) => { setControls(v); setPage(1); }} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Suche: Name, Meta Ad ID, Hook…"
            className={cn(inputCls, 'pl-8 min-w-[240px]')}
          />
        </div>
        <select value={format} onChange={(e) => { setFormat(e.target.value); setPage(1); }} className={inputCls}>
          <option value="">Alle Formate</option>
          {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={inputCls}>
          <option value="">Alle Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-gray-100 dark:border-white/8 bg-gray-50/60 dark:bg-white/[0.02]">
              <tr>
                <th className={th}>Ad</th>
                <th className={th}>Status</th>
                <th className={th}>Start</th>
                <th className={cn(th, 'text-right')}>Spend</th>
                <th className={cn(th, 'text-right')}>Impr.</th>
                <th className={cn(th, 'text-right')}>Hook</th>
                <th className={cn(th, 'text-right')}>Hold</th>
                <th className={cn(th, 'text-right')}>CTR</th>
                <th className={cn(th, 'text-right')}>Unique Sales</th>
                <th className={cn(th, 'text-right')}>Umsatz</th>
                <th className={cn(th, 'text-right')}>ROAS (ber.)</th>
                <th className={cn(th, 'text-right')}>CPA Uniq.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 12 }).map((__, j) => (
                      <td key={j} className={td}><div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-white/5" /></td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr><td colSpan={12} className="px-3 py-10 text-center text-sm text-red-600 dark:text-red-400">Daten konnten nicht geladen werden.</td></tr>
              ) : !data?.items.length ? (
                <tr><td colSpan={12} className="px-3 py-16 text-center">
                  <div className="text-sm font-medium text-gray-700 dark:text-white/70">Noch keine Ads vorhanden.</div>
                  <div className="mt-1 text-xs text-gray-400 dark:text-white/40">Lege deine erste Ad an, um Performance zu erfassen.</div>
                  <button onClick={() => setModalOpen(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
                    <Plus className="h-4 w-4" /> Neue Ad
                  </button>
                </td></tr>
              ) : (
                data.items.map((ad) => {
                  const m = ad.metrics;
                  return (
                    <tr
                      key={ad.id}
                      onClick={() => router.push(`/meta-ads/ads/${ad.id}`)}
                      className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-gray-900 dark:text-white">{ad.name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/40">
                          <span className="rounded bg-gray-100 dark:bg-white/10 px-1.5 py-0.5">{FORMAT_LABELS[ad.format]}</span>
                          {ad.metaAdId && <span className="truncate">ID {ad.metaAdId}</span>}
                          {ad.angleName && <span>· {ad.angleName}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={ad.status} /></td>
                      <td className={td}>{fmtDate(ad.startDate)}</td>
                      <td className={cn(td, 'text-right')}>{fmtEur(m.spend)}</td>
                      <td className={cn(td, 'text-right')}>{fmtInt(m.impressions)}</td>
                      <td className={cn(td, 'text-right')}>{fmtPct(m.hookRate)}</td>
                      <td className={cn(td, 'text-right')}>{fmtPct(m.holdRate)}</td>
                      <td className={cn(td, 'text-right')}>{fmtPct(m.ctrAll)}</td>
                      <td className={cn(td, 'text-right')}>{fmtInt(m.uniqueSales)}</td>
                      <td className={cn(td, 'text-right')}>{fmtEur(m.revenue)}</td>
                      <td className={cn(td, 'text-right text-accent-meta')}>{fmtRoas(m.calculatedRoas)}</td>
                      <td className={cn(td, 'text-right')}>{fmtEur(m.cpaUnique)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/8 px-3 py-2.5 text-sm">
            <span className="text-gray-500 dark:text-white/50">{data.total} Ads · Seite {data.page}/{data.totalPages}</span>
            <div className="flex gap-1.5">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">Zurück</button>
              <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">Weiter</button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-white/40">
        Hinweis: „ROAS (ber.)" ist der berechnete ROAS (Umsatz ÷ Spend). Der führende Hyros ROAS steht pro Tag/Ad in der Detailansicht.
      </p>

      <AdFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
