'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle2, Loader2, Save, Trash2, Archive as ArchiveIcon,
  Download, RotateCw, AlertTriangle, AlertCircle, Eye, Maximize2, Minimize2,
  FileText, ZoomIn, ZoomOut, RotateCcw, History, Receipt, Building2,
  Calendar, Banknote, CreditCard, Tag, Sparkles, X,
} from 'lucide-react';
import {
  invoicesApi, type Invoice, type InvoiceStatus, type InvoiceEvent,
  STATUS_META, DEFAULT_CATEGORIES, categoryLabel, fmtEUR, fmtDate, fmtDateTime,
} from '@/lib/invoices';

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [form, setForm] = useState<Partial<Invoice>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const invQuery = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(id),
    refetchInterval: (q) => {
      const status = q.state.data?.ocrStatus;
      return status === 'pending' || status === 'processing' ? 2500 : false;
    },
  });

  const dupQuery = useQuery({
    queryKey: ['invoice-duplicates', id],
    queryFn: () => invoicesApi.duplicates(id),
    enabled: !!invQuery.data && invQuery.data.ocrStatus !== 'pending' && invQuery.data.ocrStatus !== 'processing',
    staleTime: 60_000,
  });

  // Form aus geladener Rechnung initialisieren (nur einmal pro id, dann nicht
  // ueberschreiben — sonst wuerden Pollings die User-Eingaben verwerfen).
  const initialized = useRef<string | null>(null);
  useEffect(() => {
    // Rechnungs-ID gewechselt → neu initialisieren
    if (initialized.current !== id) {
      initialized.current = null;
      setDirty(false);
    }
  }, [id]);
  useEffect(() => {
    if (invQuery.data && initialized.current !== id) {
      initialized.current = id;
      setForm(initialFormFromInvoice(invQuery.data));
    }
  }, [invQuery.data, id]);

  // ESC → zurück
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !fullscreen) router.push('/invoices');
      if (e.key === 'Escape' && fullscreen) setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, fullscreen]);

  function setField<K extends keyof Invoice>(key: K, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function save() {
    if (!dirty || !invQuery.data) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await invoicesApi.update(id, form);
      setForm(initialFormFromInvoice(updated));
      setDirty(false);
      invQuery.refetch();
    } catch (err: any) {
      setError(err?.message ?? 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function markPaid() {
    try {
      await invoicesApi.markPaid(id, { paidAt: new Date().toISOString().slice(0, 10) });
      invQuery.refetch();
    } catch (err: any) {
      alert(err?.message ?? 'Fehler');
    }
  }

  async function markUnpaid() {
    if (!confirm('Zahlungs-Markierung zurücksetzen?')) return;
    try {
      await invoicesApi.markUnpaid(id);
      invQuery.refetch();
    } catch (err: any) {
      alert(err?.message ?? 'Fehler');
    }
  }

  async function doArchive() {
    if (!confirm('Rechnung ins Archiv verschieben?')) return;
    try {
      await invoicesApi.archive(id);
      router.push('/invoices');
    } catch (err: any) {
      alert(err?.message ?? 'Fehler');
    }
  }

  async function doDelete() {
    if (!confirm('Rechnung dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    try {
      await invoicesApi.remove(id);
      router.push('/invoices');
    } catch (err: any) {
      alert(err?.message ?? 'Fehler');
    }
  }

  async function downloadFile() {
    try {
      const { blob } = await invoicesApi.fetchFileBlob(id, true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = invQuery.data?.fileName ?? `invoice-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      alert(err?.message ?? 'Download fehlgeschlagen');
    }
  }

  if (invQuery.isLoading) {
    return (
      <div className="p-16 text-center text-sm text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Lädt Rechnung …
      </div>
    );
  }
  if (invQuery.isError || !invQuery.data) {
    return (
      <div className="p-16 text-center text-sm text-gray-500">
        Rechnung nicht gefunden.
        <button onClick={() => router.push('/invoices')} className="block mt-3 mx-auto text-amber-600 hover:underline">← Zurück zur Übersicht</button>
      </div>
    );
  }

  const inv = invQuery.data;
  const status = inv.status as InvoiceStatus;
  const meta = STATUS_META[status] ?? STATUS_META.open;
  const ocrPending = inv.ocrStatus === 'pending' || inv.ocrStatus === 'processing';
  const ocrFailed = inv.ocrStatus === 'failed';
  const isPaid = status === 'paid';

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.push('/invoices')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück
        </button>
        <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${meta.badge} ${meta.badgeDark}`}>
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate flex-1 min-w-0">
          {inv.supplierName || <span className="italic text-gray-400">Lieferant unbekannt</span>}
          {inv.invoiceNumber && <span className="text-gray-500 dark:text-gray-400 font-normal ml-2">· {inv.invoiceNumber}</span>}
        </h1>
        <div className="flex items-center gap-1.5">
          {!isPaid && (
            <button
              onClick={markPaid}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-700 px-3 py-1.5 text-xs font-medium text-white shadow shadow-emerald-500/20"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Als bezahlt markieren
            </button>
          )}
          {isPaid && (
            <button
              onClick={markUnpaid}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Zurücksetzen
            </button>
          )}
          <button onClick={downloadFile} title="Datei herunterladen" className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button onClick={doArchive} title="Archivieren" className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5">
            <ArchiveIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={doDelete} title="Löschen" className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* OCR Status Banner */}
      {ocrPending && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-900/20 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          KI liest die Rechnung aus … die Felder rechts werden gleich gefüllt.
        </div>
      )}
      {ocrFailed && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/80 dark:bg-red-900/20 px-4 py-2.5 text-xs text-red-800 dark:text-red-200 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <strong>OCR fehlgeschlagen.</strong> Bitte Felder manuell ausfüllen. {inv.ocrError && <span className="block opacity-70 mt-0.5">{inv.ocrError}</span>}
          </div>
        </div>
      )}
      {(dupQuery.data?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50/80 dark:bg-orange-900/20 px-4 py-2.5 text-xs text-orange-800 dark:text-orange-200 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <strong>{dupQuery.data!.length} mögliche Dublette(n)</strong> mit gleicher Rechnungsnummer oder gleichem Lieferant+Betrag.
            <div className="mt-1 space-y-0.5">
              {dupQuery.data!.map((d) => (
                <button
                  key={d.id}
                  onClick={() => router.push(`/invoices/${d.id}`)}
                  className="block text-left text-orange-700 dark:text-orange-300 hover:underline"
                >
                  · {d.invoiceNumber ?? '(ohne Nr)'} · {d.supplierName} · {fmtDate(d.invoiceDate)} · {fmtEUR(d.grossAmount as any)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Split-Screen Body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT — Document Viewer */}
        <DocumentViewer invoiceId={id} fileName={inv.fileName} fileMime={inv.fileMime} fullscreen={fullscreen} onFullscreen={() => setFullscreen((s) => !s)} />

        {/* RIGHT — Editable Form */}
        <div className="space-y-4">
          {/* Supplier */}
          <SectionCard icon={<Building2 className="h-3.5 w-3.5" />} title="Lieferant">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Firmenname" wide>
                <Input value={form.supplierName ?? ''} onChange={(v) => setField('supplierName', v)} />
              </Field>
              <Field label="USt-IdNr.">
                <Input value={form.supplierVatId ?? ''} onChange={(v) => setField('supplierVatId', v)} />
              </Field>
              <Field label="E-Mail">
                <Input type="email" value={form.supplierEmail ?? ''} onChange={(v) => setField('supplierEmail', v)} />
              </Field>
              <Field label="Telefon">
                <Input value={form.supplierPhone ?? ''} onChange={(v) => setField('supplierPhone', v)} />
              </Field>
              <Field label="Webseite">
                <Input value={form.supplierWebsite ?? ''} onChange={(v) => setField('supplierWebsite', v)} />
              </Field>
              <Field label="Adresse" wide>
                <Textarea value={form.supplierAddress ?? ''} onChange={(v) => setField('supplierAddress', v)} rows={2} />
              </Field>
            </div>
          </SectionCard>

          {/* Invoice Header */}
          <SectionCard icon={<Receipt className="h-3.5 w-3.5" />} title="Rechnung">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rechnungsnummer">
                <Input value={form.invoiceNumber ?? ''} onChange={(v) => setField('invoiceNumber', v)} />
              </Field>
              <Field label="Zahlungsziel">
                <Input value={form.paymentTerms ?? ''} onChange={(v) => setField('paymentTerms', v)} />
              </Field>
              <Field label="Rechnungsdatum">
                <Input type="date" value={dateOnly(form.invoiceDate)} onChange={(v) => setField('invoiceDate', v || null)} />
              </Field>
              <Field label="Leistungsdatum">
                <Input type="date" value={dateOnly(form.serviceDate)} onChange={(v) => setField('serviceDate', v || null)} />
              </Field>
              <Field label="Fälligkeitsdatum">
                <Input type="date" value={dateOnly(form.dueDate)} onChange={(v) => setField('dueDate', v || null)} />
              </Field>
              <Field label="Währung">
                <Input value={form.currency ?? 'EUR'} onChange={(v) => setField('currency', v.toUpperCase())} />
              </Field>
            </div>
          </SectionCard>

          {/* Amounts */}
          <SectionCard icon={<Banknote className="h-3.5 w-3.5" />} title="Beträge">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Netto (€)">
                <NumberField value={form.netAmount as any} onChange={(v) => setField('netAmount', v)} />
              </Field>
              <Field label="MwSt-Satz (%)">
                <NumberField value={form.taxRate as any} onChange={(v) => setField('taxRate', v)} step="0.1" />
              </Field>
              <Field label="MwSt (€)">
                <NumberField value={form.vatAmount as any} onChange={(v) => setField('vatAmount', v)} />
              </Field>
              <Field label="Skonto (€)">
                <NumberField value={form.discountAmount as any} onChange={(v) => setField('discountAmount', v)} />
              </Field>
              <Field label="Brutto (€)" wide>
                <NumberField value={form.grossAmount as any} onChange={(v) => setField('grossAmount', v)} large />
              </Field>
            </div>
          </SectionCard>

          {/* Payment */}
          <SectionCard icon={<CreditCard className="h-3.5 w-3.5" />} title="Zahlung">
            <div className="grid grid-cols-2 gap-3">
              <Field label="IBAN" wide>
                <Input value={form.iban ?? ''} onChange={(v) => setField('iban', v.toUpperCase().replace(/\s+/g, ''))} mono />
              </Field>
              <Field label="BIC">
                <Input value={form.bic ?? ''} onChange={(v) => setField('bic', v.toUpperCase())} mono />
              </Field>
              <Field label="Bank">
                <Input value={form.bankName ?? ''} onChange={(v) => setField('bankName', v)} />
              </Field>
              <Field label="Verwendungszweck" wide>
                <Input value={form.paymentReference ?? ''} onChange={(v) => setField('paymentReference', v)} />
              </Field>
            </div>
            {isPaid && (
              <div className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-3 w-3 inline-block mr-1" />
                Bezahlt am <strong>{fmtDate(inv.paidAt)}</strong>
              </div>
            )}
          </SectionCard>

          {/* Category + Notes */}
          <SectionCard icon={<Tag className="h-3.5 w-3.5" />} title="Kategorisierung & Notizen">
            <div className="space-y-3">
              <Field label="Kategorie">
                <select
                  value={form.category ?? 'other'}
                  onChange={(e) => setField('category', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                  {DEFAULT_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Notizen">
                <Textarea value={form.notes ?? ''} onChange={(v) => setField('notes', v)} rows={3} placeholder="Optional — interne Notizen, Projekt-Zuordnung, etc." />
              </Field>
              {inv.ocrConfidence != null && (
                <div className="text-[11px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  OCR-Konfidenz {(inv.ocrConfidence * 100).toFixed(0)}%
                  {!inv.reviewed && <span className="text-amber-600 dark:text-amber-400">· bitte prüfen</span>}
                </div>
              )}
            </div>
          </SectionCard>

          {/* History */}
          <HistoryPanel events={inv.events ?? []} />
        </div>
      </div>

      {/* Sticky Save Bar */}
      {(dirty || saving || error) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] shadow-2xl px-4 py-2.5">
          {error
            ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
            : <span className="text-xs text-gray-600 dark:text-gray-300">Du hast nicht gespeicherte Änderungen.</span>
          }
          <button
            onClick={() => { initialized.current = null; setForm(initialFormFromInvoice(inv)); initialized.current = id; setDirty(false); setError(null); }}
            className="text-xs text-gray-500 hover:underline"
          >Verwerfen</button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 px-3 py-1.5 text-xs font-medium text-white"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Speichern
          </button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Document Viewer (Left Side)
// -----------------------------------------------------------------------------

function DocumentViewer({ invoiceId, fileName, fileMime, fullscreen, onFullscreen }: {
  invoiceId: string;
  fileName: string;
  fileMime: string;
  fullscreen: boolean;
  onFullscreen: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let revoke: string | null = null;
    setLoading(true);
    setError(null);
    invoicesApi.fetchFileBlob(invoiceId, false)
      .then(({ blob }) => {
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      })
      .catch((err) => setError(err?.message ?? 'Datei konnte nicht geladen werden'))
      .finally(() => setLoading(false));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [invoiceId]);

  const isPdf = fileMime?.includes('pdf') || fileName?.toLowerCase().endsWith('.pdf');
  const isImage = fileMime?.startsWith('image/') || /\.(jpe?g|png)$/i.test(fileName);

  const container = (
    <div className={`flex flex-col bg-gray-50 dark:bg-black/40 ${fullscreen
      ? 'fixed inset-0 z-50 rounded-none'
      : 'rounded-2xl border border-gray-200 dark:border-white/8 h-[calc(100vh-280px)] min-h-[500px]'
    }`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] backdrop-blur">
        <FileText className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{fileName}</span>
        {isImage && (
          <>
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10">
              <ZoomOut className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <span className="text-[10px] text-gray-500 tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10">
              <ZoomIn className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <div className="h-3 w-px bg-gray-200 dark:bg-white/10 mx-1" />
          </>
        )}
        <button onClick={onFullscreen} title={fullscreen ? 'Verkleinern' : 'Vollbild'} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10">
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5 text-gray-500" /> : <Maximize2 className="h-3.5 w-3.5 text-gray-500" />}
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Lädt Dokument …
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-sm text-red-600">{error}</div>
        ) : !blobUrl ? null : isPdf ? (
          <iframe src={blobUrl} className="w-full h-full" title={fileName} />
        ) : isImage ? (
          <div className="p-3 flex items-center justify-center">
            <img src={blobUrl} alt={fileName} style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }} className="max-w-full transition-transform" />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">Vorschau nicht möglich — bitte herunterladen.</div>
        )}
      </div>
      {fullscreen && (
        <button onClick={onFullscreen} className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return container;
}

// -----------------------------------------------------------------------------
// History
// -----------------------------------------------------------------------------

function HistoryPanel({ events }: { events: InvoiceEvent[] }) {
  if (events.length === 0) {
    return (
      <SectionCard icon={<History className="h-3.5 w-3.5" />} title="Historie">
        <div className="text-xs text-gray-500 dark:text-gray-400 italic">Keine Einträge.</div>
      </SectionCard>
    );
  }
  return (
    <SectionCard icon={<History className="h-3.5 w-3.5" />} title="Historie">
      <div className="space-y-2.5">
        {events.map((ev) => (
          <div key={ev.id} className="flex items-start gap-2.5 text-xs">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-gray-800 dark:text-gray-200">
                <strong className="font-medium">{EVENT_LABELS[ev.type] ?? ev.type}</strong>
                {ev.note && <span className="text-gray-500 dark:text-gray-400"> — {ev.note}</span>}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                {fmtDateTime(ev.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

const EVENT_LABELS: Record<string, string> = {
  uploaded: 'Hochgeladen',
  ocr_started: 'OCR gestartet',
  ocr_completed: 'OCR erfolgreich',
  ocr_failed: 'OCR fehlgeschlagen',
  edited: 'Bearbeitet',
  status_changed: 'Status geändert',
  marked_paid: 'Als bezahlt markiert',
  marked_unpaid: 'Zahlung zurückgesetzt',
  archived: 'Archiviert',
  restored: 'Wiederhergestellt',
  note_added: 'Notiz hinzugefügt',
  duplicate_warning: 'Dubletten-Warnung',
};

// -----------------------------------------------------------------------------
// Form Helpers
// -----------------------------------------------------------------------------

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      {children}
    </label>
  );
}

function Input({ value, onChange, type = 'text', mono }: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${mono ? 'font-mono' : ''}`}
    />
  );
}

function Textarea({ value, onChange, rows = 2, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
    />
  );
}

function NumberField({ value, onChange, step = '0.01', large }: {
  value: number | string | null | undefined;
  onChange: (v: number | null) => void;
  step?: string;
  large?: boolean;
}) {
  // String-Buffer-Pattern damit User die 0/leeren Wert löschen kann
  const [text, setText] = useState<string>(value == null || value === '' ? '' : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value == null || value === '' ? '' : String(value));
  }, [value, focused]);
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === '') onChange(null);
        else {
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }
      }}
      onFocus={(e) => { setFocused(true); e.target.select(); }}
      onBlur={() => { setFocused(false); if (text.trim() === '') onChange(null); }}
      className={`w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${large ? 'text-base font-semibold' : ''}`}
    />
  );
}

function dateOnly(d: any): string {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const dd = new Date(d);
  if (Number.isNaN(dd.getTime())) return '';
  return dd.toISOString().slice(0, 10);
}

function initialFormFromInvoice(inv: Invoice): Partial<Invoice> {
  return {
    supplierName: inv.supplierName,
    supplierAddress: inv.supplierAddress,
    supplierEmail: inv.supplierEmail,
    supplierPhone: inv.supplierPhone,
    supplierWebsite: inv.supplierWebsite,
    supplierVatId: inv.supplierVatId,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    serviceDate: inv.serviceDate,
    dueDate: inv.dueDate,
    paymentTerms: inv.paymentTerms,
    currency: inv.currency,
    netAmount: inv.netAmount,
    vatAmount: inv.vatAmount,
    grossAmount: inv.grossAmount,
    taxRate: inv.taxRate,
    discountAmount: inv.discountAmount,
    iban: inv.iban,
    bic: inv.bic,
    bankName: inv.bankName,
    paymentReference: inv.paymentReference,
    category: inv.category,
    notes: inv.notes,
  };
}
