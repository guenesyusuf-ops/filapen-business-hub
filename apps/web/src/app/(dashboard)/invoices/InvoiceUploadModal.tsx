'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { invoicesApi } from '@/lib/invoices';

interface Props {
  onClose: () => void;
  /** Wird gerufen, wenn der User ein hochgeladenes Item anklickt (öffnet Detailansicht). */
  onOpenInvoice?: (invoiceId: string) => void;
  /** Wird gerufen, sobald mindestens eine Datei erfolgreich angelegt wurde, damit die Liste refreshed. */
  onUploaded?: () => void;
}

type ItemStatus = 'queued' | 'uploading' | 'success' | 'error';

interface QueueItem {
  id: string;            // local UUID (nicht DB-id)
  file: File;
  status: ItemStatus;
  progress: number;      // 0..100 — wir setzen 50 nach Send, 100 wenn Server antwortet
  invoiceId?: string;
  error?: string;
}

const ACCEPTED_MIMES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_BYTES = 25 * 1024 * 1024;

export function InvoiceUploadModal({ onClose, onOpenInvoice, onUploaded }: Props) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const successFiredRef = useRef(false);

  // ESC schließen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const newItems: QueueItem[] = [];
    for (const f of arr) {
      const id = Math.random().toString(36).slice(2);
      if (!ACCEPTED_MIMES.includes(f.type)) {
        newItems.push({ id, file: f, status: 'error', progress: 0, error: 'Dateityp nicht erlaubt (PDF/JPG/PNG)' });
        continue;
      }
      if (f.size > MAX_BYTES) {
        newItems.push({ id, file: f, status: 'error', progress: 0, error: `Datei zu groß (max ${MAX_BYTES / 1024 / 1024} MB)` });
        continue;
      }
      newItems.push({ id, file: f, status: 'queued', progress: 0 });
    }
    setItems((prev) => [...prev, ...newItems]);
    // Sofort hochladen — pro Datei separat (parallel, max 3 gleichzeitig wäre noch besser, hier reicht's)
    newItems.forEach((it) => {
      if (it.status === 'queued') void uploadOne(it.id, it.file);
    });
  }

  async function uploadOne(localId: string, file: File) {
    setItems((prev) => prev.map((x) => x.id === localId ? { ...x, status: 'uploading', progress: 30 } : x));
    try {
      const res = await invoicesApi.upload(file);
      setItems((prev) => prev.map((x) =>
        x.id === localId
          ? { ...x, status: 'success', progress: 100, invoiceId: res.id }
          : x,
      ));
      if (!successFiredRef.current) {
        successFiredRef.current = true;
        onUploaded?.();
      } else {
        onUploaded?.();
      }
    } catch (err: any) {
      setItems((prev) => prev.map((x) =>
        x.id === localId
          ? { ...x, status: 'error', progress: 0, error: err?.message ?? 'Upload fehlgeschlagen' }
          : x,
      ));
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, []);

  const successCount = items.filter((x) => x.status === 'success').length;
  const errorCount = items.filter((x) => x.status === 'error').length;
  const inFlight = items.filter((x) => x.status === 'uploading' || x.status === 'queued').length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[5] w-full max-w-2xl max-h-[92vh] bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 items-center justify-center">
              <Upload className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Rechnung{items.length > 1 ? 'en' : ''} hochladen
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PDF, JPG oder PNG bis 25 MB · KI extrahiert die Daten automatisch
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Drop-Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-5 sm:p-8 text-center cursor-pointer transition-all ${
              dragging
                ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-900/20'
                : 'border-gray-300 dark:border-white/15 hover:border-amber-400 hover:bg-gray-50/60 dark:hover:bg-white/[0.03]'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
            />
            <div className="inline-flex h-12 w-12 rounded-full bg-gradient-to-br from-amber-100 to-orange-50 dark:from-amber-900/40 dark:to-orange-950/40 items-center justify-center mb-3">
              <Upload className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              Datei{items.length > 1 ? 'en' : ''} hier ablegen
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              oder klicken zum Auswählen · Mehrere Dateien gleichzeitig möglich
            </div>
          </div>

          {/* Queue */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((it) => (
                <UploadRow
                  key={it.id}
                  item={it}
                  onRemove={() => removeItem(it.id)}
                  onOpen={() => it.invoiceId && onOpenInvoice?.(it.invoiceId)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.02]">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {items.length === 0 ? (
              'Noch keine Datei ausgewählt'
            ) : (
              <span className="flex items-center gap-3">
                {successCount > 0 && <span className="text-emerald-600 dark:text-emerald-400">{successCount} hochgeladen</span>}
                {inFlight > 0 && <span className="text-amber-600 dark:text-amber-400">{inFlight} läuft …</span>}
                {errorCount > 0 && <span className="text-red-600 dark:text-red-400">{errorCount} Fehler</span>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
            >
              <Plus className="h-3.5 w-3.5" /> Mehr hinzufügen
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-medium text-white"
            >
              {inFlight > 0 ? 'Im Hintergrund weiter' : 'Fertig'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadRow({ item, onRemove, onOpen }: { item: QueueItem; onRemove: () => void; onOpen: () => void }) {
  const isImage = item.file.type.startsWith('image/');
  const sizeKb = (item.file.size / 1024).toFixed(0);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2.5">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        item.status === 'success'
          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300'
          : item.status === 'error'
            ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300'
            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300'
      }`}>
        {item.status === 'success' ? <CheckCircle2 className="h-4 w-4" />
          : item.status === 'error' ? <AlertCircle className="h-4 w-4" />
          : item.status === 'uploading' ? <Loader2 className="h-4 w-4 animate-spin" />
          : isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {item.file.name}
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span>{sizeKb} KB</span>
          {item.status === 'queued' && <span>· In Warteschlange</span>}
          {item.status === 'uploading' && <span>· Wird hochgeladen …</span>}
          {item.status === 'success' && (
            <button onClick={onOpen} className="text-emerald-600 dark:text-emerald-400 hover:underline">
              · Erstellt — öffnen
            </button>
          )}
          {item.status === 'error' && <span className="text-red-600 dark:text-red-400">· {item.error}</span>}
        </div>
        {item.status === 'uploading' && (
          <div className="mt-1.5 h-1 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${item.progress}%` }} />
          </div>
        )}
      </div>

      <button onClick={onRemove} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 flex-shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
