'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Undo2, Plus, Loader2, Search, X, ImageIcon, Music2, ShoppingBag,
  CheckCircle2, XCircle, AlertCircle, Banknote, AlertTriangle,
} from 'lucide-react';
import {
  returnsApi, type Return, type ReturnPlatform, type ReturnStatus,
  STATUS_META, PLATFORM_META, reasonLabel, fmtEUR, fmtDate,
} from '@/lib/returns';
import { ReturnFormModal } from './ReturnFormModal';
import { ReturnDetailModal } from './ReturnDetailModal';

const STATUS_TABS: Array<{ key: string; label: string; icon: any }> = [
  { key: 'all', label: 'Alle', icon: Undo2 },
  { key: 'open', label: 'Offen', icon: AlertCircle },
  { key: 'in_review', label: 'Zu prüfen', icon: AlertCircle },
  { key: 'accepted', label: 'Akzeptiert', icon: CheckCircle2 },
  { key: 'rejected', label: 'Abgelehnt', icon: XCircle },
  { key: 'refunded', label: 'Erstattet', icon: Banknote },
];

const PAGE_SIZE = 30;

export default function ReturnsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const platformFilter = (params.get('platform') ?? 'all') as 'all' | ReturnPlatform;
  const tab = params.get('tab') ?? 'all';

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(0); }, [debouncedSearch, platformFilter, tab]);

  const listQuery = useQuery({
    queryKey: ['returns', { platformFilter, tab, debouncedSearch, page }],
    queryFn: () => returnsApi.list({
      platform: platformFilter !== 'all' ? platformFilter : undefined,
      tab: tab === 'all' ? undefined : tab,
      search: debouncedSearch || undefined,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    }),
    placeholderData: keepPreviousData,
  });

  const countsQuery = useQuery({
    queryKey: ['returns-counts', platformFilter],
    queryFn: () => returnsApi.statusCounts(platformFilter !== 'all' ? platformFilter : undefined),
    staleTime: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: ['returns-stats'],
    queryFn: () => returnsApi.statsDashboard(),
    staleTime: 60_000,
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function setPlatformTab(p: 'all' | ReturnPlatform) {
    const url = p === 'all' ? '/returns' : `/returns?platform=${p}`;
    router.push(url);
  }
  function setStatusTab(s: string) {
    const qs = new URLSearchParams();
    if (platformFilter !== 'all') qs.set('platform', platformFilter);
    if (s !== 'all') qs.set('tab', s);
    router.push(qs.toString() ? `/returns?${qs.toString()}` : '/returns');
  }

  function onCreated(id: string) {
    setCreateOpen(false);
    setDetailId(id);
    listQuery.refetch();
    countsQuery.refetch();
  }

  function onChanged() {
    listQuery.refetch();
    countsQuery.refetch();
    statsQuery.refetch();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 items-center justify-center shadow-md">
              <Undo2 className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
              Retouren
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-xl">
            Office trägt ein → Lager lädt Bilder hoch → Backoffice entscheidet. Kein E-Mail-Pingpong mehr.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-500/20 transition-all"
        >
          <Plus className="h-4 w-4" /> Retoure anlegen
        </button>
      </div>

      {/* Stats-Kacheln pro Plattform */}
      {statsQuery.data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {statsQuery.data.perPlatform.map((p) => (
            <PlatformStatCard
              key={p.platform}
              data={p}
              onClick={() => setPlatformTab(p.platform)}
              active={platformFilter === p.platform}
            />
          ))}
          <StatCard label="Σ Erstattet" value={fmtEUR(statsQuery.data.refunds.total)} sub={`${statsQuery.data.refunds.count} Erstattungen`} accent="text-teal-600 dark:text-teal-400" />
          {statsQuery.data.topRejectReasons.length > 0 && (
            <TopReasonsCard reasons={statsQuery.data.topRejectReasons} />
          )}
        </div>
      )}

      {/* Plattform-Switcher */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <PlatformChip active={platformFilter === 'all'} onClick={() => setPlatformTab('all')} icon={<Undo2 className="h-3.5 w-3.5" />} label="Alle Plattformen" />
        <PlatformChip active={platformFilter === 'tiktok'} onClick={() => setPlatformTab('tiktok')} icon={<Music2 className="h-3.5 w-3.5" />} label="TikTok" />
        <PlatformChip active={platformFilter === 'shopify'} onClick={() => setPlatformTab('shopify')} icon={<ShoppingBag className="h-3.5 w-3.5" />} label="Shopify" />
      </div>

      {/* Status-Tabs */}
      <div className="border-b border-gray-200 dark:border-white/8 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-px">
          {STATUS_TABS.map((t) => {
            const active = tab === t.key;
            const count = countsQuery.data ? (countsQuery.data as any)[t.key] ?? 0 : undefined;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setStatusTab(t.key)}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors ${
                  active
                    ? 'text-purple-700 dark:text-purple-300 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {typeof count === 'number' && (
                  <span className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-full ${
                    active
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-white/8 dark:text-gray-400'
                  }`}>{count}</span>
                )}
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-purple-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Suche */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suchen: Bestellnr, Kunde, Tracking, Produkt …"
          className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10">
            <X className="h-3 w-3 text-gray-400" />
          </button>
        )}
      </div>

      {/* Tabelle / Karten */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {listQuery.isLoading && items.length === 0 ? (
          <div className="p-16 text-center text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Laedt …
          </div>
        ) : items.length === 0 ? (
          <EmptyState filtered={!!(debouncedSearch || tab !== 'all' || platformFilter !== 'all')} onCreate={() => setCreateOpen(true)} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/8 text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-3 text-left">Plattform</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-3 py-3 text-left">Bestellnr</th>
                    <th className="px-3 py-3 text-left">Kunde</th>
                    <th className="px-3 py-3 text-left">Produkte</th>
                    <th className="px-3 py-3 text-left">Datum</th>
                    <th className="px-3 py-3 text-right">Erstattung</th>
                    <th className="px-3 py-3 text-center">Bilder</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ret) => <Row key={ret.id} ret={ret} onOpen={() => setDetailId(ret.id)} />)}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-white/8 text-xs text-gray-500 dark:text-gray-400">
              <div>
                <strong className="text-gray-700 dark:text-gray-200 tabular-nums">{total}</strong> {total === 1 ? 'Retoure' : 'Retouren'}
                {totalPages > 1 && <> · Seite <strong className="tabular-nums">{page + 1}</strong> / {totalPages}</>}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-md border border-gray-200 dark:border-white/10 px-2 py-1 disabled:opacity-40">Zurueck</button>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="rounded-md border border-gray-200 dark:border-white/10 px-2 py-1 disabled:opacity-40">Weiter</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {createOpen && (
        <ReturnFormModal
          onClose={() => setCreateOpen(false)}
          onCreated={onCreated}
        />
      )}
      {detailId && (
        <ReturnDetailModal
          returnId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Row
// -----------------------------------------------------------------------------
function Row({ ret, onOpen }: { ret: Return; onOpen: () => void }) {
  const status = ret.status as ReturnStatus;
  const meta = STATUS_META[status] ?? STATUS_META.open;
  const platMeta = PLATFORM_META[ret.platform];
  const productLabel = ret.items.length === 1
    ? (ret.items[0].product?.title ?? ret.items[0].productFreetext ?? '—')
    : `${ret.items.length} Positionen`;

  return (
    <tr onClick={onOpen} className="border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-purple-50/40 dark:hover:bg-purple-900/10 cursor-pointer">
      <td className="px-3 py-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full text-white" style={{ background: platMeta.color }}>
          {platMeta.label}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border ${meta.badge} ${meta.badgeDark}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        {ret.status === 'rejected' && ret.rejectionReason && (
          <div className="text-[10px] text-gray-500 mt-0.5 truncate" title={reasonLabel(ret.rejectionReason)}>
            {reasonLabel(ret.rejectionReason)}
          </div>
        )}
        {ret.damaged && (
          <div className="text-[10px] inline-flex items-center gap-0.5 text-red-600 dark:text-red-400 mt-0.5">
            <AlertTriangle className="h-2.5 w-2.5" /> Beschädigt
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">{ret.orderNumber}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 max-w-[200px]">
        <div className="truncate">{ret.customerName ?? <span className="text-gray-400 italic">—</span>}</div>
        {ret.customerEmail && <div className="text-[11px] text-gray-500 truncate">{ret.customerEmail}</div>}
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 max-w-[220px] truncate" title={productLabel}>{productLabel}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">{fmtDate(ret.requestDate)}</td>
      <td className="px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap text-gray-900 dark:text-white">
        {ret.refundAmount ? fmtEUR(ret.refundAmount as any) : <span className="text-gray-400 font-normal">—</span>}
      </td>
      <td className="px-3 py-3 text-center">
        <div className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs">
          <ImageIcon className="h-3 w-3" />
          {ret._count?.images ?? ret.images.length}
        </div>
      </td>
    </tr>
  );
}

// -----------------------------------------------------------------------------
// Stats / Helpers
// -----------------------------------------------------------------------------
function PlatformStatCard({ data, onClick, active }: {
  data: { platform: 'tiktok' | 'shopify'; open: number; in_review: number; accepted: number; rejected: number; refunded: number; total: number };
  onClick: () => void;
  active: boolean;
}) {
  const meta = PLATFORM_META[data.platform];
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border-2 transition-all p-3 ${
        active
          ? 'border-purple-500 bg-purple-50/40 dark:bg-purple-900/20'
          : 'border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] hover:border-purple-300'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">{meta.label}</span>
        <div className="flex-1" />
        <span className="text-base font-bold tabular-nums text-gray-900 dark:text-white">{data.total}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        {data.in_review > 0 && (
          <Mini label="Zu prüfen" value={data.in_review} accent="text-blue-600 dark:text-blue-400" />
        )}
        {data.accepted > 0 && (
          <Mini label="Akzeptiert" value={data.accepted} accent="text-emerald-600 dark:text-emerald-400" />
        )}
        {data.rejected > 0 && (
          <Mini label="Abgelehnt" value={data.rejected} accent="text-red-600 dark:text-red-400" />
        )}
        {data.open > 0 && (
          <Mini label="Offen" value={data.open} accent="text-amber-600 dark:text-amber-400" />
        )}
        {data.refunded > 0 && (
          <Mini label="Erstattet" value={data.refunded} accent="text-teal-600 dark:text-teal-400" />
        )}
      </div>
    </button>
  );
}

function Mini({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div>
      <div className="text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`font-bold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className={`text-base font-bold tabular-nums ${accent ?? 'text-gray-900 dark:text-white'}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function TopReasonsCard({ reasons }: { reasons: Array<{ reason: string | null; count: number }> }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">Top-Ablehnungsgründe</div>
      <div className="space-y-1">
        {reasons.slice(0, 3).map((r) => (
          <div key={r.reason ?? '?'} className="flex items-center justify-between text-xs">
            <span className="text-gray-700 dark:text-gray-300 truncate">{reasonLabel(r.reason)}</span>
            <span className="text-gray-500 dark:text-gray-400 tabular-nums">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformChip({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-purple-600 text-white'
          : 'bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.08]'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function EmptyState({ filtered, onCreate }: { filtered: boolean; onCreate: () => void }) {
  if (filtered) {
    return (
      <div className="p-16 text-center">
        <div className="inline-flex h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/[0.04] items-center justify-center mb-3">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Keine passenden Retouren</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Probier einen anderen Filter oder eine andere Suche.</p>
      </div>
    );
  }
  return (
    <div className="p-20 text-center">
      <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-950/30 items-center justify-center mb-4">
        <Undo2 className="h-7 w-7 text-purple-600 dark:text-purple-400" />
      </div>
      <h3 className="font-display-serif text-xl font-medium text-gray-900 dark:text-white mb-1">
        Noch keine Retouren
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-5">
        Lege deine erste Retoure an — Bestellnr, Plattform, Datum und Positionen. Bilder vom Lager folgen direkt im Detail-Popup.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-medium text-white"
      >
        <Plus className="h-4 w-4" /> Erste Retoure anlegen
      </button>
    </div>
  );
}
