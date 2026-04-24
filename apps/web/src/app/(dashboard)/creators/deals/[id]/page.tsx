'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  CheckCircle,
  ChevronRight,
  Edit,
  FileText,
  UserCircle,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDollars } from '@filapen/shared/src/utils/money';
import {
  useDeal,
  useMoveDealStage,
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_COLORS,
} from '@/hooks/creators/useDeals';
import type { DealStage } from '@/hooks/creators/useDeals';
import { useBriefings } from '@/hooks/creators/useBriefings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEAL_TYPE_STYLES: Record<string, string> = {
  sponsored_post: 'bg-orange-50 text-orange-700 border-orange-200',
  video: 'bg-red-50 text-red-700 border-red-200',
  story: 'bg-amber-50 text-amber-700 border-amber-200',
  campaign: 'bg-blue-50 text-blue-700 border-blue-200',
  ambassador: 'bg-amber-50 text-amber-700 border-amber-200',
};

const PAYMENT_STYLES: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  pending: 'bg-gray-50 text-gray-600',
};

const BRIEFING_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-50 text-gray-600',
  sent: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  revision: 'bg-amber-50 text-amber-700',
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DealDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-5 w-24 rounded bg-gray-200" />
      <div className="rounded-xl bg-white p-6 shadow-card">
        <div className="h-6 w-48 rounded bg-gray-200 mb-3" />
        <div className="flex gap-2 mb-4">
          <div className="h-5 w-20 rounded bg-gray-200" />
          <div className="h-5 w-16 rounded bg-gray-200" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-5 shadow-card">
            <div className="h-3 w-16 rounded bg-gray-200 mb-3" />
            <div className="h-5 w-20 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage Progress Bar
// ---------------------------------------------------------------------------

function StageProgress({
  currentStage,
  onMoveStage,
}: {
  currentStage: DealStage;
  onMoveStage: (stage: DealStage) => void;
}) {
  const currentIndex = DEAL_STAGES.indexOf(currentStage);
  const nextStage = currentIndex < DEAL_STAGES.length - 1 ? DEAL_STAGES[currentIndex + 1] : null;
  const prevStage = currentIndex > 0 ? DEAL_STAGES[currentIndex - 1] : null;

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-4">Pipeline Stage</h3>

      {/* Progress bar */}
      <div className="flex items-center gap-1 mb-4">
        {DEAL_STAGES.map((stage, i) => (
          <div key={stage} className="flex-1 flex items-center">
            <div
              className={cn(
                'h-2 w-full rounded-full transition-colors',
                i <= currentIndex ? 'opacity-100' : 'opacity-20',
              )}
              style={{ backgroundColor: DEAL_STAGE_COLORS[stage] }}
              title={DEAL_STAGE_LABELS[stage]}
            />
          </div>
        ))}
      </div>

      {/* Current stage label */}
      <div className="flex items-center justify-between mb-4">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: DEAL_STAGE_COLORS[currentStage] }}
        >
          {DEAL_STAGE_LABELS[currentStage]}
        </span>
        <span className="text-xs text-gray-400">
          Step {currentIndex + 1} of {DEAL_STAGES.length}
        </span>
      </div>

      {/* Move buttons */}
      <div className="flex items-center gap-2">
        {prevStage && (
          <button
            onClick={() => onMoveStage(prevStage)}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
          >
            Back to {DEAL_STAGE_LABELS[prevStage]}
          </button>
        )}
        {nextStage && (
          <button
            onClick={() => onMoveStage(nextStage)}
            className="flex-1 rounded-lg bg-accent-creator px-3 py-2 text-xs font-medium text-white hover:bg-accent-creator-dark transition-colors flex items-center justify-center gap-1"
          >
            Move to {DEAL_STAGE_LABELS[nextStage]}
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: deal, isLoading } = useDeal(id);
  const { data: briefings } = useBriefings(id);
  const moveStageMutation = useMoveDealStage();

  const handleMoveStage = useCallback(
    (stage: DealStage) => {
      moveStageMutation.mutate({ id, stage });
    },
    [id, moveStageMutation],
  );

  if (isLoading) return <DealDetailSkeleton />;
  if (!deal) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">Deal not found</p>
        <button
          onClick={() => router.push('/creators/deals')}
          className="mt-3 text-sm text-accent-creator hover:underline"
        >
          Back to deals
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => router.push('/creators/deals')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Deals
      </button>

      {/* Header */}
      <div className="rounded-xl bg-white p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">{deal.title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: DEAL_STAGE_COLORS[deal.stage] }}
              >
                {DEAL_STAGE_LABELS[deal.stage]}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
                  DEAL_TYPE_STYLES[deal.type] ?? 'bg-gray-50 text-gray-600 border-gray-200',
                )}
              >
                {deal.type.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
          >
            <Edit className="h-3.5 w-3.5" />
            Edit Deal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column - 2/3 */}
        <div className="xl:col-span-2 space-y-6">
          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Creator */}
            <div
              className="rounded-xl bg-white p-5 shadow-card cursor-pointer hover:shadow-card-hover transition-shadow"
              onClick={() => router.push(`/creators/list/${deal.creatorId}`)}
            >
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Creator</h3>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-accent-creator-light flex items-center justify-center text-accent-creator font-medium text-sm">
                  {deal.creatorName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{deal.creatorName}</p>
                  <p className="text-xs text-gray-500">{deal.creatorHandle}</p>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="rounded-xl bg-white p-5 shadow-card">
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Amount</h3>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatDollars(deal.amount)}</p>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize mt-1',
                  PAYMENT_STYLES[deal.paymentStatus],
                )}
              >
                {deal.paymentStatus}
              </span>
            </div>

            {/* Deadline */}
            <div className="rounded-xl bg-white p-5 shadow-card">
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Deadline</h3>
              {deal.deadline ? (
                <>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {new Date(deal.deadline).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(() => {
                      const diff = Math.ceil(
                        (new Date(deal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                      );
                      if (diff < 0) return `${Math.abs(diff)} days overdue`;
                      if (diff === 0) return 'Due today';
                      return `${diff} days remaining`;
                    })()}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">No deadline set</p>
              )}
            </div>
          </div>

          {/* Deliverables */}
          <div className="rounded-xl bg-white p-5 shadow-card">
            <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
              <Package className="h-3 w-3" />
              Deliverables
            </h3>
            {deal.deliverables.length === 0 ? (
              <p className="text-sm text-gray-400">No deliverables specified</p>
            ) : (
              <ul className="space-y-2">
                {deal.deliverables.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-gray-300 shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Notes */}
          {deal.notes && (
            <div className="rounded-xl bg-white p-5 shadow-card">
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Notes</h3>
              <p className="text-sm text-gray-600">{deal.notes}</p>
            </div>
          )}

          {/* Briefings */}
          <div className="rounded-xl bg-white shadow-card overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-gray-400" />
                Briefings ({briefings?.length ?? 0})
              </h3>
              <button
                onClick={() => router.push(`/creators/briefings?dealId=${deal.id}`)}
                className="text-xs text-accent-creator hover:underline"
              >
                Create Briefing
              </button>
            </div>
            {!briefings || briefings.length === 0 ? (
              <div className="text-center py-10">
                <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No briefings yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {briefings.map((briefing) => (
                  <div key={briefing.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-secondary transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{briefing.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(briefing.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        BRIEFING_STATUS_STYLES[briefing.status] ?? BRIEFING_STATUS_STYLES.draft,
                      )}
                    >
                      {briefing.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column - 1/3 */}
        <div className="space-y-6">
          <StageProgress currentStage={deal.stage} onMoveStage={handleMoveStage} />

          {/* Timeline placeholder */}
          <div className="rounded-xl bg-white p-5 shadow-card">
            <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Timeline</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="h-2 w-2 rounded-full bg-accent-creator mt-1.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white">Deal created</p>
                  <p className="text-xxs text-gray-400">
                    {new Date(deal.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="h-2 w-2 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white">Last updated</p>
                  <p className="text-xxs text-gray-400">
                    {new Date(deal.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
