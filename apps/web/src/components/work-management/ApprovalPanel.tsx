'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ShieldCheck, CheckCircle2, XCircle, Send, Clock,
  ChevronDown, ChevronUp, FileText,
} from 'lucide-react';
import {
  useApprovalDetail,
  useSubmitForApproval,
  useApprovalDecide,
} from '@/hooks/work-management/useWmApproval';
import { useAuthStore } from '@/stores/auth';

interface ApprovalPanelProps {
  taskId: string;
}

function StepIcon({ status }: { status: string }) {
  if (status === 'approved') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === 'rejected') return <XCircle className="h-3.5 w-3.5 text-red-500" />;
  return <Clock className="h-3.5 w-3.5 text-gray-400" />;
}

export function ApprovalPanel({ taskId }: ApprovalPanelProps) {
  const { user } = useAuthStore();
  const { data: detail, isLoading, refetch } = useApprovalDetail(taskId);
  const submitForApproval = useSubmitForApproval();
  const decide = useApprovalDecide();
  const [rejectComment, setRejectComment] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [actionDone, setActionDone] = useState<string | null>(null);

  const busy = submitForApproval.isPending || decide.isPending;

  if (isLoading) return (
    <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 p-3">
      <div className="flex items-center gap-2 text-xs text-amber-600">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-600/30 border-t-amber-600" />
        Lade Abnahme...
      </div>
    </div>
  );
  if (!detail || !detail.approvalStatus) return null;

  const isCreator = detail.createdById === user?.id;
  const currentVersionSteps = detail.approvalSteps.filter((s) => s.version === detail.approvalVersion);
  const progress = detail.approvalProgress;

  const myStep = currentVersionSteps.find((s) => s.userId === user?.id && s.status === 'pending');
  const isMyTurn = myStep && currentVersionSteps
    .filter((s) => s.position < myStep.position)
    .every((s) => s.status === 'approved');

  const statusLabel = detail.approvalStatus === 'draft' ? 'Entwurf'
    : detail.approvalStatus === 'in_review' ? 'In Prüfung'
      : detail.approvalStatus === 'approved' ? 'Genehmigt'
        : 'Abgelehnt';

  const statusColor = detail.approvalStatus === 'approved' ? 'text-emerald-600 dark:text-emerald-400'
    : detail.approvalStatus === 'rejected' ? 'text-red-600 dark:text-red-400'
      : detail.approvalStatus === 'in_review' ? 'text-blue-600 dark:text-blue-400'
        : 'text-gray-600 dark:text-gray-400';

  function doSubmit() {
    submitForApproval.mutate(taskId, {
      onSuccess: () => { setActionDone('Eingereicht'); refetch(); setTimeout(() => setActionDone(null), 3000); },
    });
  }

  function doApprove() {
    decide.mutate({ taskId, action: 'approved' }, {
      onSuccess: () => { setActionDone('Genehmigt'); refetch(); setTimeout(() => setActionDone(null), 3000); },
    });
  }

  function doReject() {
    if (!rejectComment.trim()) return;
    decide.mutate({ taskId, action: 'rejected', comment: rejectComment.trim() }, {
      onSuccess: () => { setActionDone('Abgelehnt'); refetch(); setShowRejectInput(false); setRejectComment(''); setTimeout(() => setActionDone(null), 3000); },
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-900/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-900/10">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">Abnahme</span>
        </div>
        <span className={cn('text-[10px] font-bold', statusColor)}>{statusLabel}</span>
      </div>

      {/* Progress + steps */}
      <div className="px-3 py-2 space-y-2 bg-white dark:bg-transparent">
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all',
                detail.approvalStatus === 'approved' ? 'bg-emerald-500'
                  : detail.approvalStatus === 'rejected' ? 'bg-red-500'
                    : 'bg-blue-500',
              )}
              style={{ width: `${(progress.approved / Math.max(progress.total, 1)) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">{progress.approved}/{progress.total}</span>
        </div>

        {/* Steps list (vertical, compact) */}
        <div className="space-y-1">
          {currentVersionSteps.map((step) => (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1 rounded text-[11px]',
                step.status === 'approved' && 'bg-emerald-50 dark:bg-emerald-900/10',
                step.status === 'rejected' && 'bg-red-50 dark:bg-red-900/10',
                step.status === 'pending' && step.userId === user?.id && isMyTurn && 'bg-blue-50 dark:bg-blue-900/10 ring-1 ring-blue-300 dark:ring-blue-700',
              )}
            >
              <StepIcon status={step.status} />
              <span className="flex-1 truncate font-medium text-gray-700 dark:text-gray-300">
                {step.userName}
              </span>
              {step.deadline && step.status === 'pending' && (() => {
                const remaining = new Date(step.deadline).getTime() - Date.now();
                const hours = Math.floor(remaining / 3_600_000);
                const isUrgent = remaining < 12 * 3_600_000;
                const isOverdue = remaining < 0;
                return (
                  <span className={cn(
                    'text-[9px] font-semibold flex-shrink-0',
                    isOverdue ? 'text-red-600' : isUrgent ? 'text-orange-500' : 'text-gray-400',
                  )}>
                    {isOverdue ? 'Überfällig' : `${hours}h`}
                  </span>
                );
              })()}
              {step.comment && (
                <span className="text-[9px] text-gray-400 truncate max-w-[80px]" title={step.comment}>
                  &ldquo;{step.comment}&rdquo;
                </span>
              )}
            </div>
          ))}
        </div>

        {detail.approvalVersion > 1 && (
          <div className="text-[10px] font-semibold text-amber-600">Version {detail.approvalVersion}</div>
        )}
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-t border-amber-100 dark:border-amber-900/20 space-y-2">
        {/* Success message */}
        {actionDone && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {actionDone}
          </div>
        )}

        {/* Creator: Submit */}
        {!actionDone && isCreator && (detail.approvalStatus === 'draft' || detail.approvalStatus === 'rejected') && (
          <button
            onClick={doSubmit}
            disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {busy ? (
              <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Wird eingereicht...</>
            ) : (
              <><Send className="h-3 w-3" /> {detail.approvalStatus === 'rejected' ? 'Erneut einreichen' : 'Genehmigung einholen'}</>
            )}
          </button>
        )}

        {/* Approver: Approve + Reject */}
        {!actionDone && isMyTurn && (
          <div className="space-y-1.5">
            <button
              onClick={doApprove}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              {busy ? (
                <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Verarbeite...</>
              ) : (
                <><CheckCircle2 className="h-3 w-3" /> Genehmigen</>
              )}
            </button>

            {showRejectInput ? (
              <div className="space-y-1">
                <input
                  autoFocus
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Grund (Pflicht)..."
                  className="w-full rounded-md border border-red-200 dark:border-red-900/30 bg-white dark:bg-white/5 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                  onKeyDown={(e) => { if (e.key === 'Enter') doReject(); if (e.key === 'Escape') { setShowRejectInput(false); setRejectComment(''); } }}
                />
                <div className="flex gap-1">
                  <button onClick={doReject} disabled={!rejectComment.trim() || busy} className="flex-1 px-2 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold disabled:opacity-50">
                    Ablehnen
                  </button>
                  <button onClick={() => { setShowRejectInput(false); setRejectComment(''); }} className="px-2 py-1.5 rounded-md text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5">
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowRejectInput(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/30 text-red-600 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              >
                <XCircle className="h-3 w-3" /> Ablehnen
              </button>
            )}
          </div>
        )}

        {/* Approved stamp */}
        {detail.approvalStatus === 'approved' && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {currentVersionSteps.map((step) => (
                <div key={step.id} className="relative">
                  {step.userAvatarUrl ? (
                    <img src={step.userAvatarUrl} alt={step.userName} className="h-5 w-5 rounded-full object-cover border border-white dark:border-gray-800" />
                  ) : (
                    <span className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-[8px] font-bold text-emerald-700 border border-white dark:border-gray-800">
                      {step.userName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-emerald-500 fill-white dark:fill-gray-800" />
                </div>
              ))}
            </div>
            <span className="text-[10px] font-bold text-emerald-600">Alle genehmigt</span>
          </div>
        )}

        {/* Timeline toggle */}
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <FileText className="h-3 w-3" />
          Timeline
          {showTimeline ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showTimeline && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {/* Version markers */}
            {detail.approvalVersion > 1 && (
              <div className="flex items-center gap-1.5 pb-1">
                {Array.from({ length: detail.approvalVersion }, (_, i) => i + 1).map((v) => (
                  <span
                    key={v}
                    className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded',
                      v === detail.approvalVersion
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400',
                    )}
                  >
                    V{v}
                  </span>
                ))}
              </div>
            )}

            {(detail.activities ?? []).map((act: any) => (
              <div key={act.id} className="flex items-start gap-1.5">
                <div className={cn(
                  'mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0',
                  act.action === 'approved' ? 'bg-emerald-500'
                    : act.action === 'rejected' ? 'bg-red-500'
                      : act.action === 'resubmitted' ? 'bg-amber-500'
                        : 'bg-blue-500',
                )} />
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-snug">{act.details}</p>
                  <p className="text-[9px] text-gray-400">
                    {new Date(act.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {(detail.activities ?? []).length === 0 && (
              <p className="text-[10px] text-gray-400 italic">Noch keine Aktivitäten</p>
            )}

            {/* Attachment diff for resubmissions */}
            {detail.approvalVersion > 1 && (detail.attachments ?? []).length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Anhänge (V{detail.approvalVersion})</p>
                {detail.attachments.map((att: any) => (
                  <div key={att.id} className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-400">
                    <span className="h-1 w-1 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="truncate">{att.fileName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
