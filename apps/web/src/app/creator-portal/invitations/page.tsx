'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  Calendar,
  Package,
  Check,
  X,
  Loader2,
  FolderKanban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCreatorInvitations,
  useAcceptInvitation,
  useDeclineInvitation,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPE_COLORS,
  INVITATION_STATUS_LABELS,
  INVITATION_STATUS_COLORS,
  type ProjectCampaignType,
  type InvitationStatus,
} from '@/hooks/creators/useProjects';

function formatDate(input?: string) {
  if (!input) return '—';
  try {
    return new Date(input).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return input;
  }
}

export default function CreatorInvitationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Resolve creatorId from session storage, query param, or localStorage fallback
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Session storage (creator-portal login)
    try {
      const stored = sessionStorage.getItem('creator_data');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          setCreatorId(parsed.id);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    // 2. Query param fallback (email links)
    const qp = searchParams.get('creatorId');
    if (qp) {
      setCreatorId(qp);
      return;
    }
  }, [searchParams]);

  const {
    data: invitations,
    isLoading,
    isError,
  } = useCreatorInvitations(creatorId ?? undefined);

  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  const handleAccept = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await acceptMutation.mutateAsync(id);
      } finally {
        setBusyId(null);
      }
    },
    [acceptMutation],
  );

  const handleDecline = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await declineMutation.mutateAsync(id);
      } finally {
        setBusyId(null);
      }
    },
    [declineMutation],
  );

  if (!creatorId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          Bitte einloggen
        </h2>
        <p className="text-sm text-gray-500">
          Um deine Einladungen zu sehen, logge dich bitte im Creator Portal ein.
        </p>
        <button
          onClick={() => router.push('/creator-portal')}
          className="mt-4 inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
        >
          Zum Login
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">
          Einladungen konnten nicht geladen werden. Kommt in Kürze.
        </p>
      </div>
    );
  }

  const pending = (invitations ?? []).filter((i) => i.status === 'pending');
  // Show only accepted/expired in history; declined are shown greyed out
  const other = (invitations ?? []).filter((i) => i.status !== 'pending' && i.status !== 'declined');
  const declined = (invitations ?? []).filter((i) => i.status === 'declined');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Deine Einladungen
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Marken möchten dich zu ihren Projekten einladen
        </p>
      </div>

      {/* Pending */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
          Ausstehend ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <Mail className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              Keine offenen Einladungen
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((inv) => {
              const ct = (inv.project?.campaignType ?? 'other') as ProjectCampaignType;
              const isBusy = busyId === inv.id;
              return (
                <div
                  key={inv.id}
                  className="rounded-xl bg-white border border-gray-200 shadow-card p-5"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 flex-shrink-0">
                        <FolderKanban className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {inv.project?.name ?? 'Projekt'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Du wurdest zu diesem Projekt eingeladen
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                            style={{
                              backgroundColor:
                                CAMPAIGN_TYPE_COLORS[ct] || '#6B7280',
                            }}
                          >
                            {CAMPAIGN_TYPE_LABELS[ct] || ct}
                          </span>
                          {inv.project?.startDate && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              {formatDate(inv.project.startDate)}
                            </span>
                          )}
                          {inv.project?.productName && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Package className="h-3 w-3" />
                              {inv.project.productName}
                            </span>
                          )}
                        </div>
                        {inv.message && (
                          <p className="mt-3 text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-3">
                            {inv.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDecline(inv.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                      >
                        {isBusy && declineMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        Ablehnen
                      </button>
                      <button
                        onClick={() => handleAccept(inv.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
                      >
                        {isBusy && acceptMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Annehmen
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* History */}
      {other.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Historie ({other.length})
          </h2>
          <div className="rounded-xl bg-white border border-gray-200 shadow-card overflow-hidden">
            <div className="divide-y divide-gray-100">
              {other.map((inv) => {
                const ct = (inv.project?.campaignType ?? 'other') as ProjectCampaignType;
                const status = inv.status as InvitationStatus;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {inv.project?.name ?? 'Projekt'}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {CAMPAIGN_TYPE_LABELS[ct] || ct} •{' '}
                          {formatDate(inv.respondedAt ?? inv.invitedAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white',
                      )}
                      style={{
                        backgroundColor:
                          INVITATION_STATUS_COLORS[status] || '#6B7280',
                      }}
                    >
                      {INVITATION_STATUS_LABELS[status] || status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Declined — greyed out */}
      {declined.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Abgelehnt ({declined.length})
          </h2>
          <div className="rounded-xl bg-gray-50 border border-gray-200 shadow-card overflow-hidden opacity-60">
            <div className="divide-y divide-gray-100">
              {declined.map((inv) => {
                const ct = (inv.project?.campaignType ?? 'other') as ProjectCampaignType;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-500 truncate">
                          {inv.project?.name ?? 'Projekt'}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {CAMPAIGN_TYPE_LABELS[ct] || ct} •{' '}
                          {formatDate(inv.respondedAt ?? inv.invitedAt)}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white bg-gray-400">
                      Abgelehnt
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
