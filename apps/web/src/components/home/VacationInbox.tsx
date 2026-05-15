'use client';

import { useEffect, useState } from 'react';
import { Plane, Check, X, MessageSquare, Loader2 } from 'lucide-react';
import { vacationApi, type VacationRequest } from '@/lib/vacation';
import { colorForUser } from '@/lib/userColor';
import { cn } from '@/lib/utils';

/**
 * Pending-Inbox fuer Owner/Admin. Zeigt offene Urlaubsantraege mit
 * Approve/Reject + optionaler Notiz.
 */
export function VacationInbox({ canReview }: { canReview: boolean }) {
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canReview) return;
    vacationApi.listPending()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [canReview]);

  if (!canReview) return null;
  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/15 dark:to-orange-900/15 border border-amber-200/60 dark:border-amber-500/30 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-amber-200/40 dark:border-amber-500/20">
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Urlaubsantraege ({requests.length})
          </h2>
        </div>
      </div>
      <div className="divide-y divide-amber-200/40 dark:divide-amber-500/10">
        {requests.map((r) => (
          <RequestRow
            key={r.id}
            request={r}
            onDecided={(updated) => setRequests((prev) => prev.filter((x) => x.id !== updated.id))}
          />
        ))}
      </div>
    </div>
  );
}

function RequestRow({
  request, onDecided,
}: {
  request: VacationRequest;
  onDecided: (r: VacationRequest) => void;
}) {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const userName = request.user?.name
    || [request.user?.firstName, request.user?.lastName].filter(Boolean).join(' ').trim()
    || request.user?.email
    || 'Mitarbeiter';
  const start = new Date(request.startDate);
  const end = new Date(request.endDate);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const color = colorForUser(request.userId);

  async function decide(action: 'approve' | 'reject') {
    setBusy(action);
    try {
      const updated = action === 'approve'
        ? await vacationApi.approve(request.id, note.trim() || undefined)
        : await vacationApi.reject(request.id, note.trim() || undefined);
      onDecided(updated);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-5 py-3">
      <div className="flex items-start gap-3">
        {request.user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={request.user.avatarUrl} alt="" className="h-9 w-9 rounded-full flex-shrink-0 ring-2" style={{ boxShadow: `0 0 0 2px ${color.bg}` }} />
        ) : (
          <div
            className="h-9 w-9 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
            style={{ background: color.bg, color: color.text }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{userName}</div>
          <div className="text-xs text-gray-700 dark:text-gray-300">
            {start.toLocaleDateString('de-DE')} – {end.toLocaleDateString('de-DE')} · {days} {days === 1 ? 'Tag' : 'Tage'}
          </div>
          {request.reason && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{request.reason}</div>
          )}
          {showNote && (
            <textarea
              rows={2}
              className="mt-2 w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1.5 text-xs"
              placeholder="Notiz zur Entscheidung (optional, geht an Mitarbeiter per Email)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => decide('approve')}
              disabled={!!busy}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50',
              )}
            >
              {busy === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Genehmigen
            </button>
            <button
              onClick={() => decide('reject')}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50"
            >
              {busy === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Ablehnen
            </button>
            <button
              onClick={() => setShowNote((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-white/5"
            >
              <MessageSquare className="h-3.5 w-3.5" /> {showNote ? 'Notiz aus' : 'Notiz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
