'use client';

import Link from 'next/link';
import { ShieldCheck, CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePendingApprovals, useApprovalDecide } from '@/hooks/work-management/useWmApproval';
import { useState } from 'react';

export function PendingApprovalsWidget() {
  const { data: pending = [], isLoading } = usePendingApprovals();
  const decide = useApprovalDecide();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  if (isLoading) return null;
  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] border border-amber-200 dark:border-amber-900/30 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 dark:border-amber-900/20 bg-amber-50/50 dark:bg-amber-900/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Warten auf Genehmigung</h2>
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-amber-500 text-[10px] font-bold text-white">
            {pending.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-white/5 max-h-72 overflow-y-auto">
        {pending.map((item) => (
          <div key={item.taskId} className="px-5 py-3 space-y-2">
            <div className="flex items-center gap-3">
              <div
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.projectColor || '#8b5cf6' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.title}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  {item.projectName} · von {item.createdByName} · {item.progress} genehmigt
                  {item.version > 1 && <span className="ml-1 text-amber-600 font-semibold">V{item.version}</span>}
                </p>
              </div>
              {item.deadline && (
                <span className="flex items-center gap-1 text-[10px] text-orange-500 flex-shrink-0">
                  <Clock className="h-3 w-3" />
                  Deadline
                </span>
              )}
            </div>

            {/* Quick actions */}
            {rejectingId === item.taskId ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Ablehnungsgrund (Pflicht)..."
                  className="flex-1 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && rejectComment.trim()) {
                      decide.mutate({ taskId: item.taskId, action: 'rejected', comment: rejectComment.trim() });
                      setRejectingId(null);
                      setRejectComment('');
                    }
                    if (e.key === 'Escape') { setRejectingId(null); setRejectComment(''); }
                  }}
                />
                <button
                  onClick={() => {
                    if (rejectComment.trim()) {
                      decide.mutate({ taskId: item.taskId, action: 'rejected', comment: rejectComment.trim() });
                      setRejectingId(null);
                      setRejectComment('');
                    }
                  }}
                  className="text-xs text-red-600 font-semibold hover:text-red-700"
                >
                  Ablehnen
                </button>
                <button
                  onClick={() => { setRejectingId(null); setRejectComment(''); }}
                  className="text-xs text-gray-400"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => decide.mutate({ taskId: item.taskId, action: 'approved' })}
                  disabled={decide.isPending}
                  className="flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Genehmigen
                </button>
                <button
                  onClick={() => setRejectingId(item.taskId)}
                  className="px-3 py-1 rounded-md border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Ablehnen
                </button>
                <Link
                  href={`/work-management/${item.taskId}`}
                  className="ml-auto text-xs text-gray-400 hover:text-primary-500 flex items-center gap-0.5"
                >
                  Details
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
