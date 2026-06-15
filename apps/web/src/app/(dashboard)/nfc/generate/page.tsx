'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Hash, Plus, Loader2, Download, ExternalLink, Sparkles } from 'lucide-react';
import { nfcApi, fmtDateTime, type NfcBatch } from '@/lib/nfc';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/shared/Toast';

export default function NfcGeneratePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);

  const batchesQuery = useQuery({
    queryKey: ['nfc-batches'],
    queryFn: () => nfcApi.listBatches(),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 items-center justify-center shadow-md">
            <Hash className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
              Codes generieren
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Erstelle einen Batch von 1–10.000 Codes und exportiere als CSV
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 hover:from-cyan-600 hover:to-blue-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/20"
        >
          <Plus className="h-4 w-4" /> Neuer Batch
        </button>
      </div>

      {/* Batches-Liste */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {batchesQuery.isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Lädt …
          </div>
        ) : (batchesQuery.data?.length ?? 0) === 0 ? (
          <div className="p-16 text-center">
            <div className="inline-flex h-12 w-12 rounded-2xl bg-cyan-50 dark:bg-cyan-900/20 items-center justify-center mb-3">
              <Sparkles className="h-5 w-5 text-cyan-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Noch keine Batches</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Erstelle deinen ersten Batch — Codes werden zufällig generiert und sind global eindeutig.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/8 text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-3 text-left">Name</th>
                  <th className="px-3 py-3 text-right">Anzahl</th>
                  <th className="px-3 py-3 text-right">Aktiv</th>
                  <th className="px-3 py-3 text-left">Erstellt</th>
                  <th className="px-3 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {batchesQuery.data?.map((b) => (
                  <BatchRow key={b.id} batch={b} onChanged={() => batchesQuery.refetch()} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <GenerateModal
          onClose={() => setShowForm(false)}
          onCreated={(batch) => {
            setShowForm(false);
            batchesQuery.refetch();
            queryClient.invalidateQueries({ queryKey: ['nfc-dashboard'] });
            toast.success('Batch erstellt', `${batch.count} Codes generiert`);
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
function BatchRow({ batch, onChanged }: { batch: NfcBatch; onChanged: () => void }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  async function downloadCsv() {
    setDownloading(true);
    try {
      await nfcApi.downloadCsv(batch.id);
      toast.success('CSV heruntergeladen');
    } catch (err: any) {
      toast.error('Download fehlgeschlagen', err?.message ?? '');
    } finally { setDownloading(false); }
  }

  return (
    <tr className="border-b border-gray-100 dark:border-white/5 last:border-0">
      <td className="px-3 py-3">
        <div className="font-medium text-gray-900 dark:text-white">
          {batch.name ?? <span className="italic text-gray-400">Unbenannt</span>}
        </div>
        {batch.notes && <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[300px]">{batch.notes}</div>}
      </td>
      <td className="px-3 py-3 text-right font-semibold tabular-nums">{batch.count}</td>
      <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
        {batch.activeCount} / {batch.count}
      </td>
      <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
        {fmtDateTime(batch.createdAt)}
      </td>
      <td className="px-3 py-3 text-right">
        <button
          onClick={downloadCsv}
          disabled={downloading}
          className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          CSV
        </button>
      </td>
    </tr>
  );
}

// -----------------------------------------------------------------------------
function GenerateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (batch: NfcBatch) => void }) {
  const [count, setCount] = useState(100);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (count <= 0 || count > 10000) {
      setError('Anzahl muss zwischen 1 und 10.000 sein');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const batch = await nfcApi.createBatch({
        count,
        name: name.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onCreated(batch);
    } catch (e: any) {
      setError(e?.message ?? 'Fehler');
    } finally { setCreating(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative z-[5] w-full sm:max-w-lg bg-white dark:bg-[#0f1117] rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-200 dark:border-white/10 modal-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Neuer Code-Batch</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">6-stellige Codes (z.B. k653r). Max 10.000.</p>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Anzahl Codes *">
            <input
              type="number" min={1} max={10000} value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(10000, parseInt(e.target.value, 10) || 1)))}
              autoFocus
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2.5 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </Field>
          <Field label="Name (optional)" hint='z.B. "Bestellung März 2026"'>
            <input
              value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Charge 2026-03"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </Field>
          <Field label="Notizen (optional)">
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="z.B. NFC-Tags vom Lieferanten X"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </Field>
          {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.02] mobile-safe-bottom">
          <button onClick={onClose} disabled={creating} className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
            Abbrechen
          </button>
          <button onClick={submit} disabled={creating} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white shadow">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {creating ? 'Generiert …' : `${count} Codes erstellen`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-gray-400 mt-1">{hint}</div>}
    </label>
  );
}
