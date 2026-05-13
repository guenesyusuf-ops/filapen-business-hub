'use client';

import { useState } from 'react';
import { X, Plane, Calendar, Loader2 } from 'lucide-react';
import { vacationApi } from '@/lib/vacation';

interface Props {
  onClose: () => void;
  onCreated?: () => void;
  defaultStart?: string;
}

export function VacationModal({ onClose, onCreated, defaultStart }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(defaultStart || today);
  const [endDate, setEndDate] = useState(defaultStart || today);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!startDate || !endDate) {
      setError('Start- und End-Datum erforderlich');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End-Datum darf nicht vor Start-Datum liegen');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await vacationApi.create({ startDate, endDate, reason: reason.trim() || undefined });
      onCreated?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Antrag konnte nicht eingereicht werden');
    } finally {
      setBusy(false);
    }
  }

  // Tage berechnen (inklusive)
  const days = startDate && endDate
    ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
    : 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Plane className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Urlaub beantragen</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Von">
              <input
                type="date"
                className={inputCls}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={today}
              />
            </Field>
            <Field label="Bis">
              <input
                type="date"
                className={inputCls}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || today}
              />
            </Field>
          </div>
          {days > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 inline-flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              {days} {days === 1 ? 'Tag' : 'Tage'} (inkl. Wochenende)
            </div>
          )}
          <Field label="Grund / Notiz (optional)">
            <textarea
              rows={3}
              className={inputCls}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z.B. Familienurlaub, Krankenpflege …"
            />
          </Field>
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <p className="text-[11px] text-gray-400">
            Owner/Admin bekommt eine Benachrichtigung + Email. Du wirst informiert
            sobald entschieden wurde.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plane className="h-3.5 w-3.5" />}
            Antrag einreichen
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      {children}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30';
