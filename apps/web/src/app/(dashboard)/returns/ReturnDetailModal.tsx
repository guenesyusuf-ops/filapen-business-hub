'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, Upload, Image as ImageIcon, Loader2, CheckCircle2, XCircle, Send,
  AlertTriangle, Banknote, Trash2, RotateCcw, ChevronLeft, ChevronRight,
  History, User, Package, Tag, MessageSquare, AlertCircle,
} from 'lucide-react';
import {
  returnsApi, type Return, type ReturnStatus, type RejectionReason,
  STATUS_META, PLATFORM_META, REJECTION_REASONS, reasonLabel,
  fmtEUR, fmtDate, fmtDateTime, todayLocal,
} from '@/lib/returns';

interface Props {
  returnId: string;
  onClose: () => void;
  onChanged: () => void;
}

export function ReturnDetailModal({ returnId, onClose, onChanged }: Props) {
  const [view, setView] = useState<'main' | 'reject' | 'accept' | 'refund'>('main');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ['return', returnId],
    queryFn: () => returnsApi.get(returnId),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxIdx !== null) setLightboxIdx(null);
        else if (view !== 'main') setView('main');
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, view, lightboxIdx]);

  if (q.isLoading) {
    return (
      <Shell onClose={onClose}>
        <div className="p-16 text-center text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Lädt …
        </div>
      </Shell>
    );
  }
  if (q.isError || !q.data) {
    return (
      <Shell onClose={onClose}>
        <div className="p-16 text-center text-sm text-red-600">Retoure nicht gefunden.</div>
      </Shell>
    );
  }

  const ret = q.data;
  const status = ret.status as ReturnStatus;
  const meta = STATUS_META[status] ?? STATUS_META.open;
  const platMeta = PLATFORM_META[ret.platform];

  function reload() { q.refetch(); onChanged(); }

  async function deleteReturn() {
    if (!confirm('Retoure dauerhaft löschen? Inkl. Bilder, kann nicht rückgängig gemacht werden.')) return;
    try {
      await returnsApi.remove(returnId);
      onChanged();
      onClose();
    } catch (err: any) { alert(err?.message ?? 'Fehler'); }
  }

  return (
    <Shell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full text-white"
            style={{ background: platMeta.color }}
          >{platMeta.label}</span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${meta.badge} ${meta.badgeDark}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            #{ret.orderNumber}
          </h2>
          {ret.customerName && (
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate hidden sm:inline">
              · {ret.customerName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={deleteReturn} title="Löschen" className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {view === 'main' && (
          <MainView ret={ret} onReload={reload} onOpenLightbox={setLightboxIdx} onAcceptClick={() => setView('accept')} onRejectClick={() => setView('reject')} onRefundClick={() => setView('refund')} />
        )}
        {view === 'accept' && (
          <AcceptForm ret={ret} onClose={() => setView('main')} onDone={() => { setView('main'); reload(); }} />
        )}
        {view === 'reject' && (
          <RejectForm ret={ret} onClose={() => setView('main')} onDone={() => { setView('main'); reload(); }} />
        )}
        {view === 'refund' && (
          <RefundForm ret={ret} onClose={() => setView('main')} onDone={() => { setView('main'); reload(); }} />
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && ret.images.length > 0 && (
        <Lightbox
          images={ret.images}
          startIdx={lightboxIdx}
          returnId={returnId}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </Shell>
  );
}

// -----------------------------------------------------------------------------
// Shell
// -----------------------------------------------------------------------------
function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[5] w-full max-w-4xl max-h-[92vh] bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden"
      >
        {children}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main view — Daten + Bilder + Status-Aktionen
// -----------------------------------------------------------------------------
function MainView({ ret, onReload, onOpenLightbox, onAcceptClick, onRejectClick, onRefundClick }: {
  ret: Return;
  onReload: () => void;
  onOpenLightbox: (idx: number) => void;
  onAcceptClick: () => void;
  onRejectClick: () => void;
  onRefundClick: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const status = ret.status as ReturnStatus;

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      await returnsApi.uploadImages(ret.id, arr);
      onReload();
    } catch (err: any) {
      alert(err?.message ?? 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(imageId: string) {
    if (!confirm('Bild entfernen?')) return;
    try {
      await returnsApi.removeImage(ret.id, imageId);
      onReload();
    } catch (err: any) { alert(err?.message ?? 'Fehler'); }
  }

  async function submitForReview() {
    try {
      await returnsApi.submitForReview(ret.id);
      onReload();
    } catch (err: any) { alert(err?.message ?? 'Fehler'); }
  }

  async function revertToOpen() {
    if (!confirm('Status zurück auf Offen setzen?')) return;
    try {
      await returnsApi.revert(ret.id, 'open');
      onReload();
    } catch (err: any) { alert(err?.message ?? 'Fehler'); }
  }

  return (
    <div className="p-5 space-y-5">
      {/* Status-spezifischer Action-Block (gross + klar) */}
      <StatusActionBlock
        ret={ret}
        onSubmitReview={submitForReview}
        onAccept={onAcceptClick}
        onReject={onRejectClick}
        onRefund={onRefundClick}
        onRevert={revertToOpen}
      />

      {/* Bilder-Galerie */}
      <Section icon={<ImageIcon className="h-3.5 w-3.5" />} title={`Bilder (${ret.images.length}/10)`}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files) void uploadFiles(e.dataTransfer.files); }}
          className={`rounded-xl border-2 border-dashed p-3 transition-all ${dragging ? 'border-purple-500 bg-purple-50/40 dark:bg-purple-900/20' : 'border-gray-200 dark:border-white/10'}`}
        >
          {ret.images.length === 0 ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-8 text-center"
            >
              <Upload className="h-7 w-7 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Bilder hochladen</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Drop oder klicken · JPG/PNG/HEIC/WebP · max 10 MB</p>
            </button>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {ret.images.map((img, idx) => (
                <ImageThumb
                  key={img.id}
                  returnId={ret.id}
                  image={img}
                  onClick={() => onOpenLightbox(idx)}
                  onRemove={() => removeImage(img.id)}
                />
              ))}
              {ret.images.length < 10 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-purple-400 flex flex-col items-center justify-center text-gray-400 hover:text-purple-500"
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span className="text-[10px] mt-1">{uploading ? 'Lädt…' : '+ Bild'}</span>
                </button>
              )}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="hidden"
            onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      </Section>

      {/* Positionen */}
      <Section icon={<Package className="h-3.5 w-3.5" />} title={`Positionen (${ret.items.length})`}>
        <div className="space-y-1.5">
          {ret.items.map((it, idx) => (
            <div key={it.id} className="flex items-center gap-2 rounded-lg bg-gray-50/80 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/8 px-3 py-2">
              <span className="inline-flex h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 items-center justify-center text-[10px] font-bold flex-shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 dark:text-white truncate">
                  {it.product?.title ?? it.productFreetext ?? <span className="italic text-gray-400">Ohne Produkt</span>}
                </div>
                {it.notes && <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{it.notes}</div>}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">×{it.quantity}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Kunden-/Bestellungs-Infos */}
      <Section icon={<User className="h-3.5 w-3.5" />} title="Bestellung & Kunde">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Info label="Plattform" value={PLATFORM_META[ret.platform].label} />
          <Info label="Bestellnummer" value={ret.orderNumber} />
          <Info label="Datum der Anfrage" value={fmtDate(ret.requestDate)} />
          <Info label="Tracking-Nr." value={ret.trackingNumber ?? '—'} mono />
          <Info label="Kunde" value={ret.customerName ?? '—'} />
          <Info label="E-Mail" value={ret.customerEmail ?? '—'} />
        </div>
      </Section>

      {/* Entscheidung */}
      {(ret.status === 'accepted' || ret.status === 'rejected' || ret.status === 'refunded') && (
        <Section icon={ret.status === 'rejected' ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />} title="Entscheidung">
          <div className="space-y-2 text-xs">
            {ret.decidedBy && (
              <Info label="Entschieden von" value={`${ret.decidedBy.name} · ${fmtDateTime(ret.decidedAt)}`} />
            )}
            {ret.status === 'rejected' && (
              <>
                <Info label="Grund" value={reasonLabel(ret.rejectionReason)} />
                {ret.rejectionNote && <Info label="Notiz" value={ret.rejectionNote} />}
              </>
            )}
            {(ret.status === 'accepted' || ret.status === 'refunded') && (
              <>
                <Info label="Erstattungsbetrag" value={fmtEUR(ret.refundAmount as any)} />
                <Info label="Erstattungsdatum" value={fmtDate(ret.refundDate)} />
                {ret.damaged && <div className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 font-medium">
                  <AlertTriangle className="h-3 w-3" /> Ware ist beschädigt — nicht wiederverkäuflich
                </div>}
              </>
            )}
          </div>
        </Section>
      )}

      {/* Notizen */}
      {ret.notes && (
        <Section icon={<MessageSquare className="h-3.5 w-3.5" />} title="Notizen">
          <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ret.notes}</div>
        </Section>
      )}

      {/* Historie */}
      <Section icon={<History className="h-3.5 w-3.5" />} title="Historie">
        {(ret.events?.length ?? 0) === 0 ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">Keine Einträge.</div>
        ) : (
          <div className="space-y-2.5">
            {ret.events!.map((ev) => {
              const actor = ev.actor?.name;
              return (
                <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                  {actor ? (
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-white">{actor.charAt(0).toUpperCase()}</span>
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-gray-400">S</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-800 dark:text-gray-200">
                      <strong className="font-semibold">{actor ?? 'System'}</strong>
                      {ev.note && <span className="text-gray-500 dark:text-gray-400"> · {ev.note}</span>}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{fmtDateTime(ev.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Status-Action Block — zeigt nur relevante Workflow-Buttons
// -----------------------------------------------------------------------------
function StatusActionBlock({ ret, onSubmitReview, onAccept, onReject, onRefund, onRevert }: {
  ret: Return;
  onSubmitReview: () => void;
  onAccept: () => void;
  onReject: () => void;
  onRefund: () => void;
  onRevert: () => void;
}) {
  const status = ret.status;

  if (status === 'open') {
    return (
      <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-900/20 p-4">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-medium mb-2">
          <AlertCircle className="h-4 w-4" /> Wartet auf Bilder vom Lager
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
          Wenn das Lager die Bilder hochgeladen hat — diese Retoure ans Backoffice weitergeben.
        </p>
        <button
          onClick={onSubmitReview}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white"
        >
          <Send className="h-3.5 w-3.5" /> Zur Prüfung weitergeben
        </button>
      </div>
    );
  }

  if (status === 'in_review') {
    return (
      <div className="rounded-2xl border-2 border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-900/20 p-4">
        <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-sm font-medium mb-3">
          <AlertCircle className="h-4 w-4" /> Entscheidung erforderlich
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onAccept}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-700 px-4 py-2 text-sm font-medium text-white shadow shadow-emerald-500/20"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Akzeptieren
          </button>
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-700 px-4 py-2 text-sm font-medium text-white shadow shadow-red-500/20"
          >
            <XCircle className="h-3.5 w-3.5" /> Ablehnen
          </button>
        </div>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-4">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-sm font-medium mb-3">
          <CheckCircle2 className="h-4 w-4" /> Akzeptiert — bereit zur Erstattung
        </div>
        <button
          onClick={onRefund}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 hover:from-teal-600 hover:to-teal-700 px-4 py-2 text-sm font-medium text-white shadow shadow-teal-500/20"
        >
          <Banknote className="h-3.5 w-3.5" /> Als erstattet markieren
        </button>
      </div>
    );
  }

  if (status === 'rejected' || status === 'refunded') {
    return (
      <div className={`rounded-2xl border-2 p-3 flex items-center justify-between gap-3 ${
        status === 'rejected'
          ? 'border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-900/20'
          : 'border-teal-200 dark:border-teal-500/30 bg-teal-50/60 dark:bg-teal-900/20'
      }`}>
        <div className={`flex items-center gap-2 text-sm font-medium ${
          status === 'rejected' ? 'text-red-800 dark:text-red-200' : 'text-teal-800 dark:text-teal-200'
        }`}>
          {status === 'rejected' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {status === 'rejected' ? 'Abgelehnt' : 'Vollständig abgeschlossen — Geld zurück'}
        </div>
        <button
          onClick={onRevert}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50"
        >
          <RotateCcw className="h-3 w-3" /> Zurücksetzen
        </button>
      </div>
    );
  }

  return null;
}

// -----------------------------------------------------------------------------
// Sub-Forms (Accept / Reject / Refund)
// -----------------------------------------------------------------------------
function AcceptForm({ ret, onClose, onDone }: { ret: Return; onClose: () => void; onDone: () => void }) {
  const [refundAmount, setRefundAmount] = useState<string>(ret.refundAmount ? String(ret.refundAmount) : '');
  const [refundDate, setRefundDate] = useState<string>('');
  const [damaged, setDamaged] = useState(ret.damaged);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await returnsApi.accept(ret.id, {
        refundAmount: refundAmount ? Number(refundAmount) : undefined,
        refundDate: refundDate || undefined,
        damaged,
        note: note.trim() || undefined,
      });
      onDone();
    } catch (err: any) { setError(err?.message ?? 'Fehler'); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
        <CheckCircle2 className="h-4 w-4" /> Retoure akzeptieren
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldL label="Erstattungsbetrag (optional)">
          <input
            type="number" step="0.01" inputMode="decimal" value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder="z.B. 49.99"
            className={inputCls + ' tabular-nums'}
          />
        </FieldL>
        <FieldL label="Erstattungsdatum (optional)">
          <input
            type="date" max={todayLocal()} value={refundDate}
            onChange={(e) => setRefundDate(e.target.value)}
            className={inputCls + ' tabular-nums'}
          />
        </FieldL>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={damaged} onChange={(e) => setDamaged(e.target.checked)} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
        Ware ist beschädigt — nicht wiederverkäuflich
      </label>
      <FieldL label="Notiz (optional)">
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="z.B. Wegen Treue-Kunde voller Betrag erstattet"
          className={inputCls}
        />
      </FieldL>
      {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Wenn ein Erstattungsdatum eingetragen ist, wird die Retoure direkt auf <strong>„Erstattet"</strong> gesetzt. Sonst <strong>„Akzeptiert"</strong>.
      </p>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} disabled={saving} className="rounded-lg px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">Abbrechen</button>
        <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Bestätigen
        </button>
      </div>
    </div>
  );
}

function RejectForm({ ret, onClose, onDone }: { ret: Return; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<RejectionReason | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) { setError('Bitte einen Grund auswählen'); return; }
    if (reason === 'other' && !note.trim()) { setError('Bei „Anderer Grund" Beschreibung erforderlich'); return; }
    setSaving(true);
    setError(null);
    try {
      await returnsApi.reject(ret.id, { reason, note: note.trim() || undefined });
      onDone();
    } catch (err: any) { setError(err?.message ?? 'Fehler'); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold">
        <XCircle className="h-4 w-4" /> Retoure ablehnen
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-2">Grund auswählen</div>
        <div className="space-y-1.5">
          {REJECTION_REASONS.map((r) => (
            <label
              key={r.key}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                reason === r.key
                  ? 'border-red-500 bg-red-50/60 dark:bg-red-900/20'
                  : 'border-gray-200 dark:border-white/10 hover:border-gray-300'
              }`}
            >
              <input type="radio" name="reason" checked={reason === r.key} onChange={() => setReason(r.key)} className="text-red-600 focus:ring-red-500" />
              <span className="text-sm text-gray-800 dark:text-gray-200">{r.label}</span>
            </label>
          ))}
        </div>
      </div>
      <FieldL label={`Notiz ${reason === 'other' ? '*' : '(optional)'}`}>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder={reason === 'other' ? 'Beschreibe den Grund' : 'z.B. Reißverschluss intakt, Etiketten entfernt'}
          className={inputCls}
        />
      </FieldL>
      {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} disabled={saving} className="rounded-lg px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">Abbrechen</button>
        <button onClick={submit} disabled={saving || !reason} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Bestätigen
        </button>
      </div>
    </div>
  );
}

function RefundForm({ ret, onClose, onDone }: { ret: Return; onClose: () => void; onDone: () => void }) {
  const [refundAmount, setRefundAmount] = useState<string>(ret.refundAmount ? String(ret.refundAmount) : '');
  const [refundDate, setRefundDate] = useState<string>(ret.refundDate ? String(ret.refundDate).slice(0, 10) : todayLocal());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await returnsApi.refund(ret.id, {
        refundAmount: refundAmount ? Number(refundAmount) : undefined,
        refundDate: refundDate || undefined,
      });
      onDone();
    } catch (err: any) { setError(err?.message ?? 'Fehler'); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300 font-semibold">
        <Banknote className="h-4 w-4" /> Erstattung markieren
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldL label="Betrag (optional)">
          <input
            type="number" step="0.01" inputMode="decimal" value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)} placeholder="49.99"
            className={inputCls + ' tabular-nums'}
          />
        </FieldL>
        <FieldL label="Datum *">
          <input
            type="date" max={todayLocal()} value={refundDate}
            onChange={(e) => setRefundDate(e.target.value)}
            className={inputCls + ' tabular-nums'}
          />
        </FieldL>
      </div>
      {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} disabled={saving} className="rounded-lg px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">Abbrechen</button>
        <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
          Bestätigen
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ImageThumb + Lightbox
// -----------------------------------------------------------------------------
function ImageThumb({ returnId, image, onClick, onRemove }: {
  returnId: string;
  image: { id: string; fileName: string };
  onClick: () => void;
  onRemove: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    returnsApi.fetchImageBlob(returnId, image.id)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      })
      .catch(() => {});
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [returnId, image.id]);

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-white/[0.04] group">
      <button onClick={onClick} className="w-full h-full">
        {blobUrl ? (
          <img src={blobUrl} alt={image.fileName} className="w-full h-full object-cover hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function Lightbox({ images, startIdx, returnId, onClose }: {
  images: Array<{ id: string; fileName: string }>;
  startIdx: number;
  returnId: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    setBlobUrl(null);
    returnsApi.fetchImageBlob(returnId, images[idx].id)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      })
      .catch(() => {});
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [idx, returnId, images]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
      {idx > 0 && (
        <button onClick={(e) => { e.stopPropagation(); setIdx((i) => i - 1); }} className="absolute left-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20">
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {idx < images.length - 1 && (
        <button onClick={(e) => { e.stopPropagation(); setIdx((i) => i + 1); }} className="absolute right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20">
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm tabular-nums opacity-70">
        {idx + 1} / {images.length}
      </div>
      <div onClick={(e) => e.stopPropagation()} className="max-w-[90vw] max-h-[90vh]">
        {blobUrl ? (
          <img src={blobUrl} alt={images[idx].fileName} className="max-w-full max-h-[90vh] object-contain" />
        ) : (
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subs
// -----------------------------------------------------------------------------
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-gray-800 dark:text-gray-200 font-medium text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function FieldL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      {children}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30';
