'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Mail, Loader2, CheckCircle2, AlertCircle, Hash, ChevronRight } from 'lucide-react';
import { nfcApi, fmtDateTime, type NfcBatch } from '@/lib/nfc';
import { useToast } from '@/components/shared/Toast';

export default function NfcPreActivatePage() {
  const toast = useToast();
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [count, setCount] = useState(1);
  const [batchId, setBatchId] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ codes: string[]; emailSent: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statsQuery = useQuery({
    queryKey: ['nfc-pre-activation-stats'],
    queryFn: () => nfcApi.preActivationStats(),
    refetchInterval: 30_000,
  });

  const batchesQuery = useQuery({
    queryKey: ['nfc-batches'],
    queryFn: () => nfcApi.listBatches(),
  });

  async function submit() {
    setError(null);
    setResult(null);
    if (!customerEmail.trim()) { setError('Kunden-E-Mail erforderlich'); return; }
    if (count <= 0 || count > 1000) { setError('Anzahl 1–1000'); return; }
    setSending(true);
    try {
      const res = await nfcApi.preActivationAssign({
        customerEmail: customerEmail.trim(),
        customerName: customerName.trim() || undefined,
        count,
        batchId: batchId || undefined,
        note: note.trim() || undefined,
      });
      setResult({ codes: res.codes, emailSent: res.emailSent });
      statsQuery.refetch();
      toast.success(`${res.assignedCount} Codes zugewiesen`, res.emailSent ? 'Mail wurde versendet' : 'Mail-Versand fehlgeschlagen (siehe Log)');
      // Form zurücksetzen aber Email behalten falls Wiederholung
      setNote('');
    } catch (e: any) {
      setError(e?.message ?? 'Fehler');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 items-center justify-center shadow-md">
          <Send className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
            An Käufer senden
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Codes einem Kunden per E-Mail zuweisen — mit Aktivierungs-Links pro Code
          </p>
        </div>
      </div>

      {/* Stats */}
      {statsQuery.data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat label="Verfügbar (frei)" value={statsQuery.data.unassigned} accent="text-emerald-600 dark:text-emerald-400" />
          <Stat label="Zugewiesen (offen)" value={statsQuery.data.assigned} accent="text-amber-600 dark:text-amber-400" />
          <Stat label="Letzte Mails" value={statsQuery.data.recentAssignments.length} accent="text-cyan-600 dark:text-cyan-400" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Neuer Versand</h2>

          <Field label="Kunden-E-Mail *">
            <input
              type="email" value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="kunde@email.de"
              autoFocus
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </Field>

          <Field label="Kunden-Name (optional)" hint="Für die Anrede in der Mail">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="z.B. Anna Müller"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Anzahl Bänder *">
              <input
                type="number" min={1} max={1000} value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 1)))}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2.5 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              />
            </Field>
            <Field label="Aus Batch (optional)" hint="Sonst beliebige freie Codes">
              <select
                value={batchId} onChange={(e) => setBatchId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              >
                <option value="">Egal — beliebige freie</option>
                {batchesQuery.data?.map((b: NfcBatch) => (
                  <option key={b.id} value={b.id}>
                    {b.name ?? 'Unbenannt'} · {b.count - b.activeCount} frei
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Interne Notiz (optional)">
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. Bestellung #1234"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </Field>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-500/30 px-3 py-3 text-sm text-emerald-800 dark:text-emerald-200 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                {result.codes.length} Codes zugewiesen {result.emailSent ? '+ Mail versendet' : '· Mail-Versand fehlgeschlagen'}
              </div>
              <div className="text-xs font-mono break-all opacity-75">{result.codes.join(', ')}</div>
            </div>
          )}

          <button
            onClick={submit}
            disabled={sending || !customerEmail}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 px-5 py-3 text-sm font-semibold text-white shadow"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Wird gesendet …' : `${count} Code${count === 1 ? '' : 's'} zuweisen + Mail senden`}
          </button>
        </div>

        {/* Recent Assignments */}
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
            <Mail className="h-4 w-4" /> Letzte Versände
          </h3>
          {statsQuery.data?.recentAssignments && statsQuery.data.recentAssignments.length > 0 ? (
            <div className="space-y-2">
              {statsQuery.data.recentAssignments.map((a, i) => (
                <div key={i} className="text-xs space-y-0.5 pb-2 border-b border-gray-100 dark:border-white/5 last:border-0 last:pb-0">
                  <div className="font-medium text-gray-800 dark:text-gray-200 truncate">{a.email}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Hash className="h-2.5 w-2.5" /> {a.count} Codes
                    {a.assignedAt && <><span>·</span><span>{fmtDateTime(a.assignedAt)}</span></>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic">Noch keine Versände.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${accent ?? 'text-gray-900 dark:text-white'}`}>{value}</div>
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
