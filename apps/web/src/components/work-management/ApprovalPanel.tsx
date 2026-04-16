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
  type ApprovalStep,
} from '@/hooks/work-management/useWmApproval';
import { useAuthStore } from '@/stores/auth';

interface ApprovalPanelProps {
  taskId: string;
  onClose?: () => void;
}

function StepIcon({ status }: { status: string }) {
  if (status === 'approved') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === 'rejected') return <XCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-gray-400" />;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
    <div className="border-t border-gray-200 dark:border-white/10 px-6 py-4">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600/30 border-t-primary-600" />
        Lade Genehmigungs-Daten...
      </div>
    </div>
  );
  if (!detail || !detail.approvalStatus) return null;

  const isCreator = detail.createdById === user?.id;
  const currentVersionSteps = detail.approvalSteps.filter((s) => s.version === detail.approvalVersion);
  const progress = detail.approvalProgress;

  // Find if current user is the active approver (all previous steps approved, this step pending)
  const myStep = currentVersionSteps.find((s) => s.userId === user?.id && s.status === 'pending');
  const isMyTurn = myStep && currentVersionSteps
    .filter((s) => s.position < myStep.position)
    .every((s) => s.status === 'approved');

  return (
    <div className="border-t border-gray-200 dark:border-white/10 bg-gradient-to-b from-amber-50/30 dark:from-amber-900/5 to-transparent">
      {/* Header */}
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Abnahme-Workflow</span>
          {detail.approvalVersion > 1 && (
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
              Version {detail.approvalVersion}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Progress ring */}
          <div className="flex items-center gap-1.5">
            <div className="relative h-7 w-7">
              <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
                <circle cx="14" cy="14" r="12" fill="none" strokeWidth="3"
                  strokeDasharray={`${(progress.approved / Math.max(progress.total, 1)) * 75.4} 75.4`}
                  strokeLinecap="round"
                  className={cn(
                    detail.approvalStatus === 'approved' ? 'text-emerald-500'
                      : detail.approvalStatus === 'rejected' ? 'text-red-500'
                        : 'text-blue-500',
                  )}
                />
              </svg>
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              {progress.approved}/{progress.total}
            </span>
          </div>

          {/* Status badge */}
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full',
            detail.approvalStatus === 'draft' && 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
            detail.approvalStatus === 'in_review' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
            detail.approvalStatus === 'approved' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
            detail.approvalStatus === 'rejected' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
          )}>
            {detail.approvalStatus === 'draft' ? 'Entwurf'
              : detail.approvalStatus === 'in_review' ? 'In Pruefung'
                : detail.approvalStatus === 'approved' ? 'Genehmigt'
                  : 'Abgelehnt'}
          </span>
        </div>
      </div>

      {/* Step chain visualization */}
      <div className="px-6 pb-3">
        <div className="flex items-center gap-0.5 flex-wrap">
          {currentVersionSteps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-0.5">
              {i > 0 && <div className={cn('h-0.5 w-4', step.status === 'approved' ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700')} />}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-all',
                  step.status === 'approved' && 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
                  step.status === 'rejected' && 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
                  step.status === 'pending' && step.userId === user?.id && isMyTurn
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-2 ring-blue-400/50'
                    : step.status === 'pending' && 'bg-gray-50 dark:bg-white/[0.03] text-gray-500',
                )}
                title={step.comment ? `${step.userName}: ${step.comment}` : step.userName}
              >
                {step.userAvatarUrl ? (
                  <img src={step.userAvatarUrl} alt={step.userName} className="h-4 w-4 rounded-full object-cover" />
                ) : (
                  <span className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold">
                    {step.userName.charAt(0).toUpperCase()}
                  </span>
                )}
                <StepIcon status={step.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-6 pb-4 flex items-center gap-2 flex-wrap">
        {/* Success message after action */}
        {actionDone && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            {actionDone}
          </div>
        )}

        {/* Creator: Submit / Resubmit */}
        {!actionDone && isCreator && (detail.approvalStatus === 'draft' || detail.approvalStatus === 'rejected') && (
          <button
            onClick={() => {
              submitForApproval.mutate(taskId, {
                onSuccess: () => { setActionDone('Zur Genehmigung eingereicht'); refetch(); setTimeout(() => setActionDone(null), 3000); },
              });
            }}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {busy ? (
              <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Wird eingereicht...</>
            ) : (
              <><Send className="h-3.5 w-3.5" /> {detail.approvalStatus === 'rejected' ? 'Erneut einreichen' : 'Genehmigung einholen'}</>
            )}
          </button>
        )}

        {/* Approver: Approve */}
        {!actionDone && isMyTurn && (
          <>
            <button
              onClick={() => {
                decide.mutate({ taskId, action: 'approved' }, {
                  onSuccess: () => { setActionDone('Genehmigt'); refetch(); setTimeout(() => setActionDone(null), 3000); },
                });
              }}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {busy ? (
                <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Wird verarbeitet...</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Genehmigen</>
              )}
            </button>

            {showRejectInput ? (
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <input
                  autoFocus
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Ablehnungsgrund (Pflicht)..."
                  className="flex-1 rounded-lg border border-red-200 dark:border-red-900/30 bg-white dark:bg-white/5 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && rejectComment.trim()) {
                      decide.mutate({ taskId, action: 'rejected', comment: rejectComment.trim() }, {
                        onSuccess: () => { setActionDone('Abgelehnt'); refetch(); setShowRejectInput(false); setRejectComment(''); setTimeout(() => setActionDone(null), 3000); },
                      });
                    }
                    if (e.key === 'Escape') { setShowRejectInput(false); setRejectComment(''); }
                  }}
                />
                <button
                  onClick={() => {
                    if (rejectComment.trim()) {
                      decide.mutate({ taskId, action: 'rejected', comment: rejectComment.trim() }, {
                        onSuccess: () => { setActionDone('Abgelehnt'); refetch(); setShowRejectInput(false); setRejectComment(''); setTimeout(() => setActionDone(null), 3000); },
                      });
                    }
                  }}
                  disabled={!rejectComment.trim() || busy}
                  className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                >
                  Ablehnen
                </button>
                <button onClick={() => { setShowRejectInput(false); setRejectComment(''); }} className="text-xs text-gray-400">
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRejectInput(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                Ablehnen
              </button>
            )}
          </>
        )}

        {/* Approved stamp */}
        {detail.approvalStatus === 'approved' && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {currentVersionSteps.map((step) => (
                <div key={step.id} className="relative">
                  {step.userAvatarUrl ? (
                    <img src={step.userAvatarUrl} alt={step.userName} className="h-7 w-7 rounded-full object-cover border-2 border-white dark:border-[#1a1d2e]" />
                  ) : (
                    <span className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border-2 border-white dark:border-[#1a1d2e]">
                      {step.userName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-emerald-500 fill-white dark:fill-[#1a1d2e]" />
                </div>
              ))}
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Alle genehmigt</span>
          </div>
        )}

        {/* Toggle timeline */}
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <FileText className="h-3 w-3" />
          Timeline
          {showTimeline ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Timeline */}
      {showTimeline && (
        <div className="px-6 pb-4 border-t border-gray-100 dark:border-white/5 pt-3">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(detail.activities ?? []).map((act: any) => (
              <div key={act.id} className="flex items-start gap-2">
                <div className={cn(
                  'mt-1 h-2 w-2 rounded-full flex-shrink-0',
                  act.action === 'approved' ? 'bg-emerald-500'
                    : act.action === 'rejected' ? 'bg-red-500'
                      : act.action === 'submitted' || act.action === 'resubmitted' ? 'bg-blue-500'
                        : 'bg-gray-300',
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 dark:text-gray-300">{act.details}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(act.createdAt).toLocaleDateString('de-DE', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            {(detail.activities ?? []).length === 0 && (
              <p className="text-xs text-gray-400 italic">Noch keine Aktivitaeten</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
