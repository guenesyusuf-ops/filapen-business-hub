'use client';

/**
 * Multi-Views fuer Performance Tracking.
 * Jede View definiert ein UI-Layout + verarbeitet die items selbst.
 * Filter-Presets werden vom Hauptpage (über setFilter*-Calls) gesetzt
 * BEVOR die View gerendert wird — die View selbst macht keine API-Calls.
 */

import { useMemo } from 'react';
import { Star, Ban, Edit2, Trash2, ExternalLink, Trophy, TrendingDown, Users, Calendar, Layers, Sparkles } from 'lucide-react';
import { STATUS_OPTIONS, type PerformanceEntry } from '@/lib/influencer-performance';
import { cn } from '@/lib/utils';

const eur = (n: number | null | undefined, opts?: Intl.NumberFormatOptions) =>
  n == null ? '—' : Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, ...opts });
const pct = (n: number | null) => n == null ? '—' : `${n.toFixed(1)}%`;
const num2 = (n: number | null) => n == null ? '—' : n.toFixed(2);

// ---------------------------------------------------------------------------
// Pipeline (Kanban) — Kacheln nach Status gruppiert
// ---------------------------------------------------------------------------
export function PipelineKanbanView({
  items, onEdit,
}: { items: PerformanceEntry[]; onEdit: (e: PerformanceEntry) => void }) {
  // Wir filtern blacklisted+cancelled raus aus dem Kanban-View — die haben dort keinen Sinn
  const PIPELINE_STATUSES = STATUS_OPTIONS.filter((s) => !['cancelled', 'blacklisted'].includes(s.value));

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
      <div className="flex gap-3 min-w-max pb-2">
        {PIPELINE_STATUSES.map((status) => {
          const cards = items.filter((e) => e.status === status.value);
          const totalRevenue = cards.reduce((s, e) => s + e.revenue, 0);
          return (
            <div key={status.value} className="w-[280px] flex-shrink-0 rounded-2xl bg-gray-50 dark:bg-white/[0.02] p-3 border border-gray-200/70 dark:border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={cn('inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full', status.color)}>{status.label}</span>
                  <span className="text-xs text-gray-500">{cards.length}</span>
                </div>
                {totalRevenue > 0 && (
                  <span className="text-[10px] text-gray-500 font-mono">{eur(totalRevenue)}</span>
                )}
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {cards.length === 0 ? (
                  <div className="text-[11px] text-gray-400 italic text-center py-3">leer</div>
                ) : cards.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEdit(e)}
                    className="w-full text-left rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 hover:border-violet-400 dark:hover:border-violet-500/40 hover:shadow-md transition-all p-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate flex-1 flex items-center gap-1">
                        {e.perfFlag && <span>{e.perfFlag}</span>}
                        <span className="truncate">{e.influencerName}</span>
                      </div>
                      {e.whitelist && <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
                    </div>
                    <div className="text-[10px] text-gray-500 capitalize mb-1.5">{e.platform} · {e.campaignName ?? 'keine Kampagne'}</div>
                    {(e.revenue > 0 || e.totalCost > 0) && (
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-gray-500">{eur(e.totalCost)}</span>
                        <span className={cn(
                          'font-semibold',
                          e.profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : e.profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500',
                        )}>
                          {e.roas != null ? `${e.roas.toFixed(2)}×` : eur(e.profit)}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group-By: Plattform
// ---------------------------------------------------------------------------
export function PlatformGroupView({ items }: { items: PerformanceEntry[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, PerformanceEntry[]>();
    for (const e of items) {
      const arr = map.get(e.platform) ?? [];
      arr.push(e);
      map.set(e.platform, arr);
    }
    return Array.from(map.entries())
      .map(([platform, entries]) => {
        const revenue = entries.reduce((s, e) => s + e.revenue, 0);
        const cost = entries.reduce((s, e) => s + e.totalCost, 0);
        const profit = revenue - cost;
        const orders = entries.reduce((s, e) => s + e.orders, 0);
        const roas = cost > 0 ? revenue / cost : null;
        const profitable = entries.filter((e) => e.profit > 0).length;
        return { platform, entries, revenue, cost, profit, orders, roas, profitable };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [items]);

  if (groups.length === 0) return <EmptyView icon={Layers} text="Keine Plattformen vorhanden" />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {groups.map((g) => (
        <div key={g.platform} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-500" />
              <h3 className="font-semibold text-base capitalize text-gray-900 dark:text-white">{g.platform}</h3>
            </div>
            <span className="text-xs text-gray-500">
              {g.entries.length} Eintrag{g.entries.length === 1 ? '' : 'e'} · {g.profitable} profitabel
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Umsatz" value={eur(g.revenue)} />
            <Stat label="Kosten" value={eur(g.cost)} />
            <Stat label="Profit" value={eur(g.profit)} positive={g.profit > 0} negative={g.profit < 0} />
            <Stat label="ROAS" value={num2(g.roas)} positive={g.roas != null && g.roas > 1} negative={g.roas != null && g.roas < 1} />
          </div>
          <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden flex">
            <div className="bg-emerald-500" style={{ width: `${g.entries.length > 0 ? (g.profitable / g.entries.length) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group-By: Kampagne
// ---------------------------------------------------------------------------
export function CampaignGroupView({ items, onEdit }: { items: PerformanceEntry[]; onEdit: (e: PerformanceEntry) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, PerformanceEntry[]>();
    for (const e of items) {
      const key = e.campaignName ?? '__no_campaign__';
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([key, entries]) => {
        const revenue = entries.reduce((s, e) => s + e.revenue, 0);
        const cost = entries.reduce((s, e) => s + e.totalCost, 0);
        const profit = revenue - cost;
        const orders = entries.reduce((s, e) => s + e.orders, 0);
        const roas = cost > 0 ? revenue / cost : null;
        return {
          campaignName: key === '__no_campaign__' ? '— Keine Kampagne —' : key,
          entries, revenue, cost, profit, orders, roas,
        };
      })
      .sort((a, b) => b.profit - a.profit);
  }, [items]);

  if (groups.length === 0) return <EmptyView icon={Sparkles} text="Keine Kampagnen vorhanden" />;
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <details key={g.campaignName} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] overflow-hidden group" open>
          <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02] list-none">
            <div className="flex items-center gap-3 min-w-0">
              <Sparkles className="h-4 w-4 text-violet-500 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{g.campaignName}</h3>
                <p className="text-[11px] text-gray-500">{g.entries.length} Influencer · {g.orders} Bestellungen</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-gray-500">{eur(g.cost)}</span>
              <span className="text-gray-700 dark:text-gray-300">{eur(g.revenue)}</span>
              <span className={cn(
                'font-semibold',
                g.profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )}>
                {eur(g.profit)}
              </span>
              <span className={cn(
                'inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full',
                g.roas != null && g.roas > 1
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
              )}>
                {num2(g.roas)}× ROAS
              </span>
            </div>
          </summary>
          <div className="border-t border-gray-100 dark:border-white/5 divide-y divide-gray-100 dark:divide-white/5">
            {g.entries.map((e) => (
              <button key={e.id} onClick={() => onEdit(e)} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <span className="text-base">{e.perfFlag ?? '·'}</span>
                <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">{e.influencerName}</span>
                <span className="text-xs text-gray-500 capitalize">{e.platform}</span>
                <span className="text-xs font-mono w-20 text-right">{eur(e.totalCost)}</span>
                <span className="text-xs font-mono w-20 text-right">{eur(e.revenue)}</span>
                <span className={cn(
                  'text-xs font-mono w-16 text-right',
                  e.profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : e.profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500',
                )}>
                  {e.roas != null ? `${e.roas.toFixed(2)}×` : '—'}
                </span>
              </button>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline (chronologisch nach postedAt)
// ---------------------------------------------------------------------------
export function TimelineView({ items, onEdit }: { items: PerformanceEntry[]; onEdit: (e: PerformanceEntry) => void }) {
  const sorted = useMemo(() => {
    return items
      .filter((e) => e.postedAt)
      .sort((a, b) => (a.postedAt! > b.postedAt! ? -1 : 1));
  }, [items]);
  const noDate = items.filter((e) => !e.postedAt);

  if (sorted.length === 0 && noDate.length === 0) return <EmptyView icon={Calendar} text="Keine datierten Eintraege" />;

  return (
    <div className="space-y-4">
      {sorted.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Timeline</div>
          <div className="space-y-2">
            {sorted.map((e) => (
              <div key={e.id} className="flex items-stretch gap-3">
                <div className="w-24 flex-shrink-0 text-right text-[11px] text-gray-500 pt-1.5">
                  {new Date(e.postedAt!).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div className="relative flex-shrink-0 w-3">
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-200 dark:bg-white/10" />
                  <div className={cn(
                    'absolute top-2 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full border-2 border-white dark:border-[#0c0e1c]',
                    e.profit > 0 ? 'bg-emerald-500' : e.profit < 0 ? 'bg-red-500' : 'bg-gray-400',
                  )} />
                </div>
                <button onClick={() => onEdit(e)} className="flex-1 text-left rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] hover:border-violet-400 dark:hover:border-violet-500/40 hover:bg-white dark:hover:bg-white/[0.04] p-3 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate flex items-center gap-1">
                        <span>{e.perfFlag ?? '·'}</span>
                        {e.influencerName}
                        {e.whitelist && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                      </div>
                      <div className="text-[11px] text-gray-500 capitalize">
                        {e.platform} · {e.campaignName ?? 'keine Kampagne'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono flex-shrink-0">
                      <span className={cn(
                        e.profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : e.profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500',
                      )}>
                        {eur(e.profit)}
                      </span>
                      {e.roas != null && (
                        <span className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded',
                          e.roas > 1
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                        )}>
                          {e.roas.toFixed(2)}×
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {noDate.length > 0 && (
        <div className="rounded-2xl border border-amber-200/60 dark:border-amber-700/30 bg-amber-50/30 dark:bg-amber-900/10 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-2">
            Ohne Datum ({noDate.length})
          </div>
          <div className="space-y-1">
            {noDate.map((e) => (
              <button key={e.id} onClick={() => onEdit(e)} className="w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:text-violet-600 dark:hover:text-violet-400 truncate">
                · {e.influencerName} {e.campaignName && <span className="text-gray-500">— {e.campaignName}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Influencer Ranking (Top 10 nach mehreren Metriken)
// ---------------------------------------------------------------------------
export function RankingView({ items, onEdit }: { items: PerformanceEntry[]; onEdit: (e: PerformanceEntry) => void }) {
  const topProfit = useMemo(() => [...items].sort((a, b) => b.profit - a.profit).slice(0, 10), [items]);
  const topRoas = useMemo(() => items.filter((e) => e.roas != null).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0)).slice(0, 10), [items]);
  const topRevenue = useMemo(() => [...items].sort((a, b) => b.revenue - a.revenue).slice(0, 10), [items]);
  const topConv = useMemo(() => items.filter((e) => e.conversionRate != null).sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0)).slice(0, 10), [items]);

  if (items.length === 0) return <EmptyView icon={Trophy} text="Keine Daten fuer Rankings" />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <RankingCard title="Top 10 — Profit" items={topProfit} valueFor={(e) => eur(e.profit)} onEdit={onEdit} medal />
      <RankingCard title="Top 10 — ROAS" items={topRoas} valueFor={(e) => `${e.roas!.toFixed(2)}×`} onEdit={onEdit} />
      <RankingCard title="Top 10 — Umsatz" items={topRevenue} valueFor={(e) => eur(e.revenue)} onEdit={onEdit} />
      <RankingCard title="Top 10 — Conversion Rate" items={topConv} valueFor={(e) => `${(e.conversionRate! * 100).toFixed(1)}%`} onEdit={onEdit} />
    </div>
  );
}

function RankingCard({
  title, items, valueFor, onEdit, medal = false,
}: {
  title: string;
  items: PerformanceEntry[];
  valueFor: (e: PerformanceEntry) => string;
  onEdit: (e: PerformanceEntry) => void;
  medal?: boolean;
}) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        {title}
      </h3>
      <div className="space-y-1">
        {items.length === 0 ? (
          <div className="text-xs text-gray-400 italic text-center py-3">keine Daten</div>
        ) : items.map((e, i) => (
          <button
            key={e.id}
            onClick={() => onEdit(e)}
            className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
          >
            <span className="w-6 text-center text-xs font-bold text-gray-400">
              {medal && medals[i] ? medals[i] : `${i + 1}`}
            </span>
            <span className="flex-1 truncate text-sm text-gray-900 dark:text-white flex items-center gap-1">
              {e.perfFlag && <span className="text-xs">{e.perfFlag}</span>}
              {e.influencerName}
            </span>
            <span className="text-xs text-gray-500 capitalize">{e.platform}</span>
            <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 w-20 text-right">
              {valueFor(e)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Stat({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
      <div className={cn(
        'font-mono font-semibold tabular-nums text-sm',
        positive && 'text-emerald-600 dark:text-emerald-400',
        negative && 'text-red-600 dark:text-red-400',
      )}>
        {value}
      </div>
    </div>
  );
}

function EmptyView({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-12 text-center">
      <Icon className="h-10 w-10 mx-auto text-gray-300 dark:text-white/10 mb-3" />
      <div className="text-sm text-gray-500 dark:text-gray-400">{text}</div>
    </div>
  );
}
