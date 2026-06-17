'use client';

import { useState } from 'react';
import { Share2, Copy, Check, Trash2, Plus, Loader2, X, Clock, Eye, AlertCircle } from 'lucide-react';
import {
  useDocShareLinks, useCreateDocShareLink, useRevokeDocShareLink,
  type DocShareLink,
} from '@/hooks/useDocuments';
import { useToast } from '@/components/shared/Toast';

interface Props {
  folderId: string;
  folderName: string;
  onClose: () => void;
}

type DurationKey = '1d' | '7d' | '30d' | 'custom' | 'never';

const DURATION_OPTIONS: { key: DurationKey; label: string; days: number | null }[] = [
  { key: '1d', label: '1 Tag', days: 1 },
  { key: '7d', label: '7 Tage', days: 7 },
  { key: '30d', label: '30 Tage', days: 30 },
  { key: 'custom', label: 'Eigenes Datum', days: 0 },
  { key: 'never', label: 'Unbefristet', days: null },
];

export default function DocShareModal({ folderId, folderName, onClose }: Props) {
  const toast = useToast();
  const { data: links = [], isLoading } = useDocShareLinks(folderId);
  const createLink = useCreateDocShareLink();
  const revokeLink = useRevokeDocShareLink();

  const [selectedDuration, setSelectedDuration] = useState<DurationKey>('7d');
  const [customDate, setCustomDate] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCreate() {
    const opt = DURATION_OPTIONS.find((o) => o.key === selectedDuration);
    if (!opt) return;

    let days: number | null;
    if (selectedDuration === 'never') {
      days = null;
    } else if (selectedDuration === 'custom') {
      if (!customDate) {
        toast.error('Datum waehlen', 'Bitte ein Ablaufdatum auswaehlen.');
        return;
      }
      const target = new Date(customDate);
      const diff = Math.ceil((target.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      if (diff < 1) {
        toast.error('Datum ungueltig', 'Das Datum muss in der Zukunft liegen.');
        return;
      }
      days = diff;
    } else {
      days = opt.days as number;
    }

    try {
      await createLink.mutateAsync({ folderId, durationDays: days });
      toast.success('Link erstellt', 'Du kannst ihn jetzt kopieren und teilen.');
    } catch (err: any) {
      toast.error('Fehler', err?.message ?? 'Link konnte nicht erstellt werden.');
    }
  }

  async function handleCopy(link: DocShareLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen', 'Kopiere die URL manuell.');
    }
  }

  async function handleRevoke(link: DocShareLink) {
    if (!confirm('Diesen Link widerrufen? Externe koennen ihn dann nicht mehr oeffnen.')) return;
    try {
      await revokeLink.mutateAsync({ id: link.id, folderId });
      toast.success('Widerrufen', 'Der Link ist jetzt deaktiviert.');
    } catch (err: any) {
      toast.error('Fehler', err?.message ?? 'Widerruf fehlgeschlagen.');
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[5] w-full sm:max-w-xl bg-white dark:bg-[#0f1117] rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-200 dark:border-white/10 max-h-[90dvh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-700 items-center justify-center flex-shrink-0">
              <Share2 className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">Ordner teilen</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{folderName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Create new link */}
          <section>
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Neuen Link erstellen</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-3">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedDuration(opt.key)}
                  className={
                    'rounded-lg px-2 py-2 text-xs font-medium border transition-colors ' +
                    (selectedDuration === opt.key
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5')
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {selectedDuration === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm mb-3"
              />
            )}
            <button
              onClick={handleCreate}
              disabled={createLink.isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-700 hover:from-indigo-600 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white"
            >
              {createLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Link erstellen
            </button>
          </section>

          {/* Existing links */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vorhandene Links</p>
              <p className="text-[10px] text-gray-400">{links.length}</p>
            </div>
            {isLoading ? (
              <div className="text-center py-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Laedt …
              </div>
            ) : links.length === 0 ? (
              <div className="text-center py-8 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                <p className="text-xs text-gray-500 dark:text-gray-400">Noch keine Links fuer diesen Ordner</p>
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    copied={copiedId === link.id}
                    onCopy={() => handleCopy(link)}
                    onRevoke={() => handleRevoke(link)}
                    busy={revokeLink.isPending}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Hint */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>Mit dem Link kann jeder den Ordner und alle Unterordner ansehen und Dateien herunterladen — kein Login noetig.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkRow({ link, copied, onCopy, onRevoke, busy }: {
  link: DocShareLink;
  copied: boolean;
  onCopy: () => void;
  onRevoke: () => void;
  busy: boolean;
}) {
  const expiry = link.expiresAt ? new Date(link.expiresAt) : null;
  const now = Date.now();
  const isExpired = expiry !== null && expiry.getTime() < now;
  const isRevoked = !!link.revokedAt;
  const isActive = !isExpired && !isRevoked;

  let statusLabel = 'Aktiv';
  let statusClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (isRevoked) { statusLabel = 'Widerrufen'; statusClass = 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'; }
  else if (isExpired) { statusLabel = 'Abgelaufen'; statusClass = 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400'; }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${statusClass}`}>{statusLabel}</span>
        <span className="text-[10px] text-gray-400 inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {link.viewCount} Aufrufe</span>
        {expiry && (
          <span className="text-[10px] text-gray-400 inline-flex items-center gap-1"><Clock className="h-3 w-3" />
            {isExpired ? 'lief ab am ' : 'gueltig bis '}{expiry.toLocaleDateString('de-DE')}
          </span>
        )}
        {!expiry && !isRevoked && (
          <span className="text-[10px] text-gray-400">Unbefristet</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={link.url}
          className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-2 py-1.5 text-xs font-mono text-gray-700 dark:text-gray-300 select-all"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          onClick={onCopy}
          disabled={!isActive}
          className="rounded-lg border border-gray-200 dark:border-white/10 px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 inline-flex items-center gap-1"
          title="Kopieren"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        {isActive && (
          <button
            onClick={onRevoke}
            disabled={busy}
            className="rounded-lg border border-red-200 dark:border-red-500/30 px-2 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 inline-flex items-center gap-1 disabled:opacity-40"
            title="Widerrufen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
