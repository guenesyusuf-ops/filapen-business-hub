'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, X, Loader2, Calendar } from 'lucide-react';
import { invoicesApi, fmtEUR, type Invoice } from '@/lib/invoices';

interface Props {
  invoice: Pick<Invoice, 'id' | 'supplierName' | 'invoiceNumber' | 'grossAmount' | 'dueDate'>;
  onClose: () => void;
  onPaid: () => void;
}

/** Local-Date in YYYY-MM-DD (toISOString waere UTC) */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MarkPaidDialog({ invoice, onClose, onPaid }: Props) {
  const [paidAt, setPaidAt] = useState<string>(todayLocal());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit() {
    if (!paidAt) {
      setError('Zahlungsdatum ist erforderlich');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await invoicesApi.markPaid(invoice.id, {
        paidAt,
        note: note.trim() || undefined,
      });
      onPaid();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[5] w-full max-w-md bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Als bezahlt markieren
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {invoice.supplierName ?? 'Lieferant unbekannt'}
                {invoice.invoiceNumber && ` · ${invoice.invoiceNumber}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Betrag-Info */}
          <div className="rounded-xl bg-gray-50/80 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/8 p-3 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Betrag</span>
            <strong className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
              {fmtEUR(invoice.grossAmount as any)}
            </strong>
          </div>

          {/* Datum */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">
              Zahlungsdatum *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                autoFocus
                max={todayLocal()}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-9 pr-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            {invoice.dueDate && (
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                Fällig war am {new Date(invoice.dueDate).toLocaleDateString('de-DE')}
              </div>
            )}
          </div>

          {/* Notiz (optional) */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">
              Notiz <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="z.B. SEPA-Überweisung, Konto Hypovereinsbank …"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.02]">
          <button onClick={onClose} disabled={saving} className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-50">
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={saving || !paidAt}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Als bezahlt markieren
          </button>
        </div>
      </div>
    </div>
  );
}
