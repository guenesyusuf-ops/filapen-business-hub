'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  LayoutGrid,
  List,
  ChevronRight,
  X,
  Calendar,
  DollarSign,
  UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDollars } from '@filapen/shared/src/utils/money';
import {
  useDealKanban,
  useDeals,
  useCreateDeal,
  useMoveDealStage,
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_COLORS,
} from '@/hooks/creators/useDeals';
import type { Deal, DealStage, KanbanColumn } from '@/hooks/creators/useDeals';

// ---------------------------------------------------------------------------
// Deal Type Badges
// ---------------------------------------------------------------------------

const DEAL_TYPE_STYLES: Record<string, string> = {
  sponsored_post: 'bg-orange-50 text-orange-700',
  video: 'bg-red-50 text-red-700',
  story: 'bg-amber-50 text-amber-700',
  campaign: 'bg-blue-50 text-blue-700',
  ambassador: 'bg-amber-50 text-amber-700',
};

// ---------------------------------------------------------------------------
// Kanban Card
// ---------------------------------------------------------------------------

function KanbanCard({
  deal,
  onMoveStage,
  onClick,
}: {
  deal: Deal;
  onMoveStage: (dealId: string, stage: DealStage) => void;
  onClick: () => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const currentIndex = DEAL_STAGES.indexOf(deal.stage);

  // Available stages to move to (one before and one after, plus any)
  const availableStages = DEAL_STAGES.filter((s) => s !== deal.stage);

  return (
    <div
      className="group rounded-lg border border-border bg-white p-3 shadow-sm hover:shadow-card transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Creator */}
      <div className="flex items-center gap-2 mb-2">
        <div className="h-6 w-6 rounded-full bg-accent-creator-light flex items-center justify-center text-accent-creator text-xxs font-medium shrink-0">
          {deal.creatorName.charAt(0)}
        </div>
        <span className="text-xs text-gray-500 truncate">{deal.creatorName}</span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{deal.title}</p>

      {/* Meta */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatDollars(deal.amount)}</span>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-xxs font-medium capitalize',
            DEAL_TYPE_STYLES[deal.type] ?? 'bg-gray-50 text-gray-600',
          )}
        >
          {deal.type.replace('_', ' ')}
        </span>
      </div>

      {/* Deadline */}
      {deal.deadline && (
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <Calendar className="h-3 w-3" />
          {new Date(deal.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      )}

      {/* Move to dropdown */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMoveMenu(!showMoveMenu);
          }}
          className="w-full mt-1 flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-xxs font-medium text-gray-500 hover:text-gray-700 hover:bg-surface-secondary transition-colors opacity-0 group-hover:opacity-100"
        >
          Move to...
          <ChevronRight className="h-3 w-3" />
        </button>
        {showMoveMenu && (
          <div
            className="absolute bottom-full left-0 mb-1 w-full bg-white border border-border rounded-lg shadow-dropdown z-10 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            {availableStages.map((stage) => (
              <button
                key={stage}
                onClick={() => {
                  onMoveStage(deal.id, stage);
                  setShowMoveMenu(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-surface-secondary transition-colors"
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: DEAL_STAGE_COLORS[stage] }}
                />
                {DEAL_STAGE_LABELS[stage]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kanban Column
// ---------------------------------------------------------------------------

function KanbanColumnComponent({
  column,
  onMoveStage,
  onCardClick,
}: {
  column: KanbanColumn;
  onMoveStage: (dealId: string, stage: DealStage) => void;
  onCardClick: (dealId: string) => void;
}) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px]">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: DEAL_STAGE_COLORS[column.stage] }}
          />
          <span className="text-sm font-medium text-gray-900 dark:text-white">{column.label}</span>
          <span className="text-xs text-gray-400 bg-surface-secondary rounded-full px-1.5 py-0.5">
            {column.deals.length}
          </span>
        </div>
        <span className="text-xs font-medium text-gray-500">{formatDollars(column.totalValue)}</span>
      </div>

      {/* Cards */}
      <div className="space-y-2 flex-1">
        {column.deals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong p-4 text-center">
            <p className="text-xs text-gray-400">No deals</p>
          </div>
        ) : (
          column.deals.map((deal) => (
            <KanbanCard
              key={deal.id}
              deal={deal}
              onMoveStage={onMoveStage}
              onClick={() => onCardClick(deal.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------

function DealsListView({
  deals,
  onRowClick,
}: {
  deals: Deal[];
  onRowClick: (id: string) => void;
}) {
  if (deals.length === 0) {
    return (
      <div className="rounded-xl bg-white shadow-card text-center py-16">
        <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-900 mb-1">No deals found</p>
        <p className="text-xs text-gray-500">Create your first deal to get started</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Deal</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase">Creator</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase">Stage</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="text-right px-3 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase">Payment</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase">Deadline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {deals.map((deal) => (
              <tr
                key={deal.id}
                onClick={() => onRowClick(deal.id)}
                className="cursor-pointer hover:bg-surface-secondary transition-colors"
              >
                <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{deal.title}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-accent-creator-light flex items-center justify-center text-accent-creator text-xxs font-medium">
                      {deal.creatorName.charAt(0)}
                    </div>
                    <span className="text-gray-700 text-xs">{deal.creatorName}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: DEAL_STAGE_COLORS[deal.stage] }}
                  >
                    {DEAL_STAGE_LABELS[deal.stage]}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs font-medium capitalize',
                      DEAL_TYPE_STYLES[deal.type] ?? 'bg-gray-50 text-gray-600',
                    )}
                  >
                    {deal.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-medium text-gray-900 dark:text-white">
                  {formatDollars(deal.amount)}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      deal.paymentStatus === 'paid'
                        ? 'bg-emerald-50 text-emerald-700'
                        : deal.paymentStatus === 'partial'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-50 text-gray-600',
                    )}
                  >
                    {deal.paymentStatus}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-600">
                  {deal.deadline
                    ? new Date(deal.deadline).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Deal Modal
// ---------------------------------------------------------------------------

function NewDealModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createMutation = useCreateDeal();
  const [form, setForm] = useState({
    title: '',
    creatorId: '',
    type: 'sponsored_post' as Deal['type'],
    amount: '',
    deadline: '',
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      createMutation.mutate(
        {
          title: form.title,
          creatorId: form.creatorId,
          type: form.type,
          amount: Number(form.amount),
          deadline: form.deadline || undefined,
          stage: 'lead',
        },
        {
          onSuccess: () => {
            onClose();
            setForm({ title: '', creatorId: '', type: 'sponsored_post', amount: '', deadline: '' });
          },
        },
      );
    },
    [createMutation, form, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-dropdown w-full max-w-md mx-4 animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">New Deal</h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-surface-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Deal Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator"
              placeholder="e.g. Spring Campaign"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Deal['type'] }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator"
              >
                <option value="sponsored_post">Sponsored Post</option>
                <option value="video">Video</option>
                <option value="story">Story</option>
                <option value="campaign">Campaign</option>
                <option value="ambassador">Ambassador</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator"
                placeholder="5000"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-accent-creator px-4 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kanban Skeleton
// ---------------------------------------------------------------------------

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="min-w-[280px] animate-pulse">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="h-2.5 w-2.5 rounded-full bg-gray-200" />
            <div className="h-3 w-20 rounded bg-gray-200" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: i % 3 === 0 ? 2 : 1 }).map((_, j) => (
              <div key={j} className="rounded-lg border border-border bg-white p-3">
                <div className="h-3 w-16 rounded bg-gray-200 mb-2" />
                <div className="h-3.5 w-full rounded bg-gray-200 mb-2" />
                <div className="h-3 w-12 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function DealsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [showNewDealModal, setShowNewDealModal] = useState(searchParams.get('action') === 'new');

  const kanbanQuery = useDealKanban();
  const dealsQuery = useDeals();
  const moveStageMutation = useMoveDealStage();

  const handleMoveStage = useCallback(
    (dealId: string, stage: DealStage) => {
      moveStageMutation.mutate({ id: dealId, stage });
    },
    [moveStageMutation],
  );

  const handleCardClick = useCallback(
    (dealId: string) => {
      router.push(`/creators/deals/${dealId}`);
    },
    [router],
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">Deals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your creator deal pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border bg-white">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'flex items-center gap-1.5 rounded-l-lg px-3 py-2 text-sm transition-colors',
                view === 'kanban'
                  ? 'bg-accent-creator text-white'
                  : 'text-gray-600 hover:bg-surface-secondary',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 rounded-r-lg px-3 py-2 text-sm transition-colors',
                view === 'list'
                  ? 'bg-accent-creator text-white'
                  : 'text-gray-600 hover:bg-surface-secondary',
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>
          <button
            onClick={() => setShowNewDealModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-creator px-3 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Deal
          </button>
        </div>
      </div>

      {/* Error banner */}
      {(kanbanQuery.isError || dealsQuery.isError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load deals. Showing cached data.
        </div>
      )}

      {/* Content */}
      {view === 'kanban' ? (
        kanbanQuery.isLoading ? (
          <KanbanSkeleton />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {(kanbanQuery.data ?? []).map((column) => (
              <KanbanColumnComponent
                key={column.stage}
                column={column}
                onMoveStage={handleMoveStage}
                onCardClick={handleCardClick}
              />
            ))}
          </div>
        )
      ) : dealsQuery.isLoading ? (
        <div className="rounded-xl bg-white shadow-card animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
              <div className="h-3 w-40 rounded bg-gray-200" />
              <div className="h-3 w-24 rounded bg-gray-200" />
              <div className="h-3 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : (
        <DealsListView deals={dealsQuery.data ?? []} onRowClick={handleCardClick} />
      )}

      {/* New Deal Modal */}
      <NewDealModal open={showNewDealModal} onClose={() => setShowNewDealModal(false)} />
    </div>
  );
}

export default function DealsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" /></div>}>
      <DealsPageInner />
    </Suspense>
  );
}
