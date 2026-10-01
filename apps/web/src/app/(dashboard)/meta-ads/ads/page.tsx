'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, Megaphone, Play, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetaControls, MetaControlsValue } from '@/components/meta-ads/MetaControls';
import { MetaPageHeader, MetaEmptyState, MetaStatus, META_FRAME, btnPrimary } from '@/components/meta-ads/MetaUI';
import { AdFormModal } from '@/components/meta-ads/AdFormModal';
import { fmtEur, fmtInt, fmtPct, fmtRoas } from '@/components/meta-ads/format';
import { useMetaAdsList, AdListParams, FORMAT_LABELS, STATUS_LABELS, MaFormat, MaAdStatus } from '@/hooks/meta-ads/useMetaAds';

const FORMATS: MaFormat[] = ['video', 'static', 'carousel', 'gif', 'ugc', 'vsl', 'image', 'collection'];
const STATUSES: MaAdStatus[] = ['draft', 'active', 'paused', 'ended', 'archived'];

const th = 'px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-white/40 whitespace-nowrap';
const thR = cn(th, 'text-right');
const td = 'px-4 py-3 text-[13px] tabular-nums whitespace-nowrap text-gray-700 dark:text-white/80';
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
    productGroupId: controls.productGroupId, range: controls.range, start: controls.start, end: controls.end,
    format: format || undefined, status: status || undefined, search: search.trim() || undefined, page, pageSize: 25,
  };
  const { data, isLoading, isError } = useMetaAdsList(params);
  const filtersActive = !!(format || status || search.trim());
  const reset = () => { setFormat(''); setStatus(''); setSearch(''); setPage(1); };
  const selCls = 'h-8 rounded-lg border-0 bg-transparent pl-2.5 pr-7 text-[13px] font-medium text-gray-600 dark:text-white/70 outline-none focus:ring-2 focus:ring-accent-meta/25 appearance-none cursor-pointer';

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5 p-4 sm:p-7">
      <MetaPageHeader eyebrow="Meta Ads" title="Ads" description="Alle Ads mit aggregierter Performance im gewählten Zeitraum."
        actions={<button onClick={() => setModalOpen(true)} className={btnPrimary}><Plus className="h-4 w-4" /> Neue Ad</button>}>
        <MetaControls value={controls} onChange={(v) => { setControls(v); setPage(1); }} />
      </MetaPageHeader>

      {/* Filterbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-[10px] border border-gray-200 bg-white p-1.5 dark:border-white/[0.1] dark:bg-[var(--card-bg)]">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 pl-2 text-gray-400">
          <Search className="h-4 w-4 shrink-0" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Name, Meta Ad ID, Hook…"
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[13px] text-gray-900 outline-none dark:text-white" />
        </div>
        <span className="mx-0.5 hidden h-5 w-px bg-gray-200 dark:bg-white/10 sm:block" />
        <select value={format} onChange={(e) => { setFormat(e.target.value); setPage(1); }} className={selCls}>
          <option value="">Alle Formate</option>{FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selCls}>
          <option value="">Alle Status</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {filtersActive && <button onClick={reset} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-white/50 dark:hover:bg-white/5"><X className="h-3.5 w-3.5" /> Zurücksetzen</button>}
      </div>

      <div className={META_FRAME}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-gray-200/70 bg-gray-50/40 dark:border-white/[0.07] dark:bg-white/[0.015]">
              <tr>
                <th className={th}>Ad</th><th className={th}>Status</th><th className={thR}>Spend</th>
                <th className={cn(thR, 'hidden md:table-cell')}>Hook</th><th className={cn(thR, 'hidden lg:table-cell')}>Hold</th>
                <th className={cn(thR, 'hidden xl:table-cell')}>Ausg. CTR</th><th className={cn(thR, 'hidden sm:table-cell')}>Unique</th>
                <th className={thR}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-white/[0.05]">{Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className={td}><div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-white/5" /></td>))}</tr>
                ))
              ) : isError ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-red-600 dark:text-red-400">Daten konnten nicht geladen werden.</td></tr>
              ) : !data?.items.length ? (
                <tr><td colSpan={8}><MetaEmptyState icon={Megaphone}
                  title={filtersActive ? 'Keine Ads für diese Filter' : 'Noch keine Ads vorhanden'}
                  description={filtersActive ? 'Filter anpassen oder zurücksetzen.' : 'Lege deine erste Ad an, um Performance zu erfassen.'}
                  actions={filtersActive
                    ? <button onClick={reset} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium dark:border-white/10">Zurücksetzen</button>
                    : <button onClick={() => setModalOpen(true)} className={btnPrimary}><Plus className="h-4 w-4" /> Neue Ad</button>} /></td></tr>
              ) : (
                data.items.map((ad) => {
                  const m = ad.metrics;
                  const Fmt = ad.format === 'video' ? Play : ImageIcon;
                  return (
                    <tr key={ad.id} onClick={() => router.push(`/meta-ads/ads/${ad.id}`)}
                      className="cursor-pointer border-b border-gray-100 transition last:border-0 hover:bg-accent-meta/[0.04] dark:border-white/[0.05] dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-gray-200 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/5"><Fmt className="h-4 w-4" /></div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-gray-900 dark:text-white">{ad.name}</div>
                            <div className="mt-0.5 truncate text-[11.5px] text-gray-400 dark:text-white/40">
                              {ad.productGroupName ?? '—'}{ad.awareness ? ` · ${ad.awareness.replace(/_/g, ' ')}` : ''}{ad.angleName ? ` · ${ad.angleName}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><MetaStatus status={ad.status} /></td>
                      <td className={tdR}>{fmtEur(m.spend)}</td>
                      <td className={cn(tdR, 'hidden md:table-cell')}>{fmtPct(m.hookRate)}</td>
                      <td className={cn(tdR, 'hidden lg:table-cell')}>{fmtPct(m.holdRate)}</td>
                      <td className={cn(tdR, 'hidden xl:table-cell')}>{fmtPct(m.outboundCtr)}</td>
                      <td className={cn(tdR, 'hidden sm:table-cell')}>{fmtInt(m.uniqueSales)}</td>
                      <td className={cn(tdR, 'font-semibold text-accent-meta')}>{fmtRoas(m.calculatedRoas)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200/70 px-4 py-2.5 text-[13px] dark:border-white/[0.07]">
            <span className="text-gray-500 dark:text-white/50">{data.total} Ads · Seite {data.page}/{data.totalPages}</span>
            <div className="flex gap-1.5">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40 dark:border-white/10">Zurück</button>
              <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40 dark:border-white/10">Weiter</button>
            </div>
          </div>
        )}
      </div>
      <p className="text-[12px] text-gray-400 dark:text-white/40">„ROAS" = berechneter ROAS (Umsatz ÷ Spend). Der führende Hyros ROAS steht pro Tag in der Ad-Detailansicht.</p>
      <AdFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
