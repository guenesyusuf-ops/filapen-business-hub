'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, Plus, Search, Loader2, Star, Ban, Edit2, Trash2,
  ExternalLink, Filter,
} from 'lucide-react';
import {
  influencerPerformanceApi,
  PLATFORMS, STATUS_OPTIONS,
  type PerformanceEntry, type EntryStatus,
} from '@/lib/influencer-performance';
import { EntryFormModal } from './EntryFormModal';
import { cn } from '@/lib/utils';

export default function PerformanceTrackingPage() {
  // Daten
  const [items, setItems] = useState<PerformanceEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<string>('');
  const [status, setStatus] = useState<EntryStatus | 'all'>('all');
  const [profitableOnly, setProfitableOnly] = useState(false);
  const [whitelistOnly, setWhitelistOnly] = useState(false);
  const [blacklistOnly, setBlacklistOnly] = useState(false);
  const [minRoas, setMinRoas] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Modal-State
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PerformanceEntry | null>(null);

  const params = useMemo(() => ({
    search: search || undefined,
    platform: platform || undefined,
    status: status === 'all' ? undefined : status,
    profitableOnly: profitableOnly ? true : undefined,
    whitelist: whitelistOnly ? true : undefined,
    blacklist: blacklistOnly ? true : undefined,
    minRoas: minRoas ? Number(minRoas) : undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  }), [search, platform, status, profitableOnly, whitelistOnly, blacklistOnly, minRoas, fromDate, toDate]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await influencerPerformanceApi.list({ ...params, limit: 200 });
      setItems(d.items);
      setTotal(d.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [JSON.stringify(params)]);

  function resetFilters() {
    setSearch(''); setPlatform(''); setStatus('all'); setProfitableOnly(false);
    setWhitelistOnly(false); setBlacklistOnly(false); setMinRoas('');
    setFromDate(''); setToDate('');
  }

  async function quickToggleWhitelist(e: PerformanceEntry) {
    try {
      await influencerPerformanceApi.update(e.id, { whitelist: !e.whitelist });
      load();
    } catch (err: any) { window.alert(err.message); }
  }
  async function quickToggleBlacklist(e: PerformanceEntry) {
    try {
      await influencerPerformanceApi.update(e.id, { blacklist: !e.blacklist });
      load();
    } catch (err: any) { window.alert(err.message); }
  }
  async function handleDelete(e: PerformanceEntry) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Eintrag von "${e.influencerName}" wirklich löschen?`)) return;
    try {
      await influencerPerformanceApi.remove(e.id);
      load();
    } catch (err: any) { window.alert(err.message); }
  }

  const activeFilterCount = [platform, status !== 'all', profitableOnly, whitelistOnly, blacklistOnly, minRoas, fromDate, toDate].filter(Boolean).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            Performance Tracking
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {total} Eintrag{total === 1 ? '' : 'e'} · Influencer-Kampagnen, ROAS, Profit
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4" />
          Neuer Eintrag
        </button>
      </div>

      {/* Filter-Bar */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Influencer / Kampagne / Code …"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-3 py-2 text-sm">
            <option value="">Alle Plattformen</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-3 py-2 text-sm">
            <option value="all">Alle Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button
            onClick={() => setFiltersExpanded((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm',
              filtersExpanded || activeFilterCount > 2
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.02]',
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Mehr Filter
            {activeFilterCount > 0 && <span className="text-[10px] bg-violet-600 text-white rounded-full px-1.5">{activeFilterCount}</span>}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-red-600 underline">
              Reset
            </button>
          )}
        </div>
        {filtersExpanded && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
            <label className="text-xs">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Min ROAS</span>
              <input type="number" step="0.1" min="0" value={minRoas} onChange={(e) => setMinRoas(e.target.value)} placeholder="z.B. 2.0" className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-2 py-1.5 text-xs" />
            </label>
            <label className="text-xs">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Von</span>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-2 py-1.5 text-xs" />
            </label>
            <label className="text-xs">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Bis</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-2 py-1.5 text-xs" />
            </label>
            <div className="flex items-center gap-3 text-xs flex-wrap pt-4">
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={profitableOnly} onChange={(e) => setProfitableOnly(e.target.checked)} className="rounded text-emerald-600" />
                Nur profitabel
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={whitelistOnly} onChange={(e) => setWhitelistOnly(e.target.checked)} className="rounded text-emerald-600" />
                ⭐ Whitelist
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={blacklistOnly} onChange={(e) => setBlacklistOnly(e.target.checked)} className="rounded text-red-600" />
                🚫 Blacklist
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Tabelle */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Lade …
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-400">
            ⚠ {error}
            <p className="text-xs text-gray-500 mt-1">Falls "table not found": Migration in Supabase noch nicht gelaufen.</p>
          </div>
        ) : items.length === 0 ? (
          <EmptyState onCreate={() => { setEditing(null); setShowForm(true); }} hasFilters={activeFilterCount > 0 || !!search} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/60 dark:bg-white/[0.02] text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2.5 text-left">Influencer</th>
                  <th className="px-3 py-2.5 text-left">Plattform</th>
                  <th className="px-3 py-2.5 text-left">Kampagne</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  <th className="px-3 py-2.5 text-right">Kosten</th>
                  <th className="px-3 py-2.5 text-right">Umsatz</th>
                  <th className="px-3 py-2.5 text-right">Profit</th>
                  <th className="px-3 py-2.5 text-right">ROAS</th>
                  <th className="px-3 py-2.5 text-right">ROI</th>
                  <th className="px-3 py-2.5 text-center"></th>
                  <th className="px-3 py-2.5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {items.map((e) => (
                  <Row
                    key={e.id}
                    entry={e}
                    onEdit={() => { setEditing(e); setShowForm(true); }}
                    onDelete={() => handleDelete(e)}
                    onWhitelist={() => quickToggleWhitelist(e)}
                    onBlacklist={() => quickToggleBlacklist(e)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <EntryFormModal
          entry={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function Row({
  entry, onEdit, onDelete, onWhitelist, onBlacklist,
}: {
  entry: PerformanceEntry;
  onEdit: () => void;
  onDelete: () => void;
  onWhitelist: () => void;
  onBlacklist: () => void;
}) {
  const status = STATUS_OPTIONS.find((s) => s.value === entry.status);
  const profit = entry.profit;
  const profitColor = profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500';
  const roasColor = entry.roas == null ? 'text-gray-400' : entry.roas >= (entry.breakEvenRoas ?? 1) * 2 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : entry.profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';

  return (
    <tr className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02] group">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{entry.perfFlag ?? '·'}</span>
          <div className="min-w-0">
            <div className="font-medium text-gray-900 dark:text-white truncate max-w-[180px] flex items-center gap-1">
              {entry.influencerName}
              {entry.whitelist && <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
              {entry.blacklist && <Ban className="h-3 w-3 text-red-500 flex-shrink-0" />}
            </div>
            {entry.category && <div className="text-[10px] text-gray-500 truncate max-w-[180px]">{entry.category}</div>}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300 capitalize">{entry.platform}</td>
      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300 truncate max-w-[160px]">{entry.campaignName ?? '—'}</td>
      <td className="px-3 py-2.5">
        {status && <span className={cn('inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full', status.color)}>{status.label}</span>}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{eur(entry.totalCost)}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{eur(entry.revenue)}</td>
      <td className={cn('px-3 py-2.5 text-right font-mono text-xs tabular-nums', profitColor)}>{eur(profit)}</td>
      <td className={cn('px-3 py-2.5 text-right font-mono text-xs tabular-nums', roasColor)}>
        {entry.roas == null ? '—' : entry.roas.toFixed(2)}
      </td>
      <td className={cn('px-3 py-2.5 text-right font-mono text-xs tabular-nums', profitColor)}>
        {entry.roi == null ? '—' : `${entry.roi.toFixed(1)}%`}
      </td>
      <td className="px-3 py-2.5 text-center">
        {entry.profileUrl && (
          <a href={entry.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-violet-600">
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </td>
      <td className="px-3 py-2.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="inline-flex items-center gap-0.5">
          <button onClick={onWhitelist} title={entry.whitelist ? 'Aus Whitelist' : 'Whitelist'} className="rounded p-1 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20">
            <Star className={cn('h-3.5 w-3.5', entry.whitelist && 'text-amber-500 fill-amber-500')} />
          </button>
          <button onClick={onBlacklist} title={entry.blacklist ? 'Aus Blacklist' : 'Blacklist'} className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Ban className={cn('h-3.5 w-3.5', entry.blacklist && 'text-red-500')} />
          </button>
          <button onClick={onEdit} title="Bearbeiten" className="rounded p-1 text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} title="Löschen" className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EmptyState({ onCreate, hasFilters }: { onCreate: () => void; hasFilters: boolean }) {
  return (
    <div className="p-12 text-center">
      <TrendingUp className="h-12 w-12 mx-auto text-violet-400 mb-3" />
      <h3 className="font-display-serif text-lg font-medium text-gray-900 dark:text-white mb-1">
        {hasFilters ? 'Keine Treffer' : 'Noch keine Einträge'}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-4">
        {hasFilters
          ? 'Die aktuellen Filter haben keine Eintraege gefunden. Setz sie zurueck oder erstelle einen neuen Eintrag.'
          : 'Trag den ersten Influencer ein um Performance, ROAS und Profit zu tracken.'}
      </p>
      {!hasFilters && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Ersten Eintrag anlegen
        </button>
      )}
    </div>
  );
}

const eur = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
