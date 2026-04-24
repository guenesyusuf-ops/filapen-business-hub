'use client';

import { useState, useCallback, useRef, Suspense } from 'react';
import {
  Plus,
  FileText,
  X,
  Trash2,
  Upload,
  ArrowLeft,
  Paperclip,
  Download,
  Image as ImageIcon,
  Video,
  File,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import {
  useBriefings,
  useBriefing,
  useCreateBriefing,
  useDeleteBriefing,
  useUploadBriefingAttachment,
  useDeleteBriefingAttachment,
} from '@/hooks/creators/useBriefings';
import type { Briefing, BriefingAttachment } from '@/hooks/creators/useBriefings';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Product catalog hook
// ---------------------------------------------------------------------------

interface CatalogProduct {
  id: string;
  title: string;
  imageUrl?: string;
}

function useProductCatalog() {
  return useQuery<CatalogProduct[]>({
    queryKey: ['product-catalog'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/finance/products/catalog`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.items ?? [];
    },
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// File type helpers
// ---------------------------------------------------------------------------

function fileTypeIcon(fileType: string) {
  switch (fileType) {
    case 'pdf':
      return <FileText className="h-4 w-4 text-red-500" />;
    case 'image':
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    case 'video':
      return <Video className="h-4 w-4 text-amber-500" />;
    default:
      return <File className="h-4 w-4 text-gray-400" />;
  }
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Create Briefing Modal
// ---------------------------------------------------------------------------

function CreateBriefingModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const createMutation = useCreateBriefing();
  const uploadMutation = useUploadBriefingAttachment();
  const { data: products = [] } = useProductCatalog();

  const [form, setForm] = useState({ title: '', productId: '', notes: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const briefing = await createMutation.mutateAsync({
          title: form.title,
          productId: form.productId || undefined,
          notes: form.notes || undefined,
        });

        // Upload files sequentially
        if (files.length > 0) {
          setUploading(true);
          for (const file of files) {
            try {
              await uploadMutation.mutateAsync({ briefingId: briefing.id, file });
            } catch {
              // continue uploading remaining files
            }
          }
          setUploading(false);
        }

        setForm({ title: '', productId: '', notes: '' });
        setFiles([]);
        onClose();
        onCreated(briefing.id);
      } catch {
        // error handled by mutation
      }
    },
    [createMutation, uploadMutation, form, files, onClose, onCreated],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-dropdown w-full max-w-lg mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Briefing erstellen</h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-surface-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Product Dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Produkt</label>
            <select
              value={form.productId}
              onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator"
            >
              <option value="">Kein Produkt</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Titel</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator"
              placeholder="Briefing Titel"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notiz</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator resize-none"
              placeholder="Optionale Notiz..."
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Dateien</label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-accent-creator/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 text-gray-300 mx-auto mb-1" />
              <p className="text-xs text-gray-500">
                Dateien hierher ziehen oder klicken
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                PDF, Bilder, Videos (max. 50 MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-md px-2 py-1">
                    <Paperclip className="h-3 w-3 text-gray-400" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-gray-400">{formatFileSize(f.size)}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || uploading}
              className="rounded-lg bg-accent-creator px-4 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors disabled:opacity-50"
            >
              {uploading ? 'Dateien werden hochgeladen...' : createMutation.isPending ? 'Erstelle...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail View
// ---------------------------------------------------------------------------

function BriefingDetail({
  briefingId,
  onBack,
}: {
  briefingId: string;
  onBack: () => void;
}) {
  const { data: briefing, isLoading } = useBriefing(briefingId);
  const uploadMutation = useUploadBriefingAttachment();
  const deleteAttachmentMutation = useDeleteBriefingAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable fields
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editInit, setEditInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  if (briefing && !editInit) {
    setEditTitle(briefing.title || '');
    setEditNotes(briefing.notes || '');
    setEditInit(true);
  }

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${API_URL}/api/briefings/${briefingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), notes: editNotes.trim() }),
      });
      if (res.ok) {
        setSaveMsg('Gespeichert');
        setTimeout(() => setSaveMsg(''), 2000);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      for (const file of Array.from(e.target.files)) {
        await uploadMutation.mutateAsync({ briefingId, file });
      }
      e.target.value = '';
    },
    [briefingId, uploadMutation],
  );

  if (isLoading || !briefing) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück
      </button>

      <div className="rounded-xl bg-white shadow-card p-6 space-y-4">
        {/* Product image + info */}
        <div className="flex items-start gap-4">
          {briefing.product?.imageUrl ? (
            <img
              src={briefing.product.imageUrl}
              alt={briefing.product.title}
              className="h-16 w-16 rounded-lg object-cover border border-gray-100"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center">
              <FileText className="h-6 w-6 text-gray-300" />
            </div>
          )}
          <div className="flex-1">
            {briefing.product && (
              <p className="text-xs text-gray-500 mb-1">{briefing.product.title}</p>
            )}
            <p className="text-xs text-gray-400">
              Erstellt am{' '}
              {new Date(briefing.createdAt).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Editable: Title */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Titel</label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>

        {/* Editable: Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notizen</label>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Hinweise, Anforderungen..."
            rows={4}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
          />
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Speichern...' : 'Änderungen speichern'}
          </button>
          {saveMsg && <span className="text-xs text-green-600">{saveMsg}</span>}
        </div>

        {/* Attachments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Dateien ({briefing.attachments?.length ?? 0})
            </h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs text-accent-creator hover:text-accent-creator-dark font-medium transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Hochladen
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {!briefing.attachments || briefing.attachments.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">Keine Dateien vorhanden</p>
          ) : (
            <ul className="space-y-1.5">
              {briefing.attachments.map((att) => (
                <li
                  key={att.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  {att.fileType === 'image' ? (
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="h-10 w-10 rounded object-cover border border-gray-100"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-gray-50 flex items-center justify-center">
                      {fileTypeIcon(att.fileType)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{att.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {att.fileType.toUpperCase()} {att.fileSize ? `- ${formatFileSize(att.fileSize)}` : ''}
                    </p>
                  </div>
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => deleteAttachmentMutation.mutate({ briefingId, attachmentId: att.id })}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function BriefingsPageInner() {
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: briefings, isLoading, isError } = useBriefings();
  const deleteMutation = useDeleteBriefing();

  if (selectedId) {
    return (
      <BriefingDetail
        briefingId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">Briefings / Skripte</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Briefings und Skripte fuer Creator verwalten
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-creator px-3 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Erstellen
        </button>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Fehler beim Laden der Briefings.
        </div>
      )}

      {/* Briefing Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white shadow-card p-4 animate-pulse">
                <div className="h-24 rounded-lg bg-gray-200 mb-3" />
                <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-24 bg-gray-100 rounded" />
              </div>
            ))
          : !briefings || briefings.length === 0
            ? (
              <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-card">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-900 mb-1">Noch keine Briefings</p>
                <p className="text-xs text-gray-500 mb-4">
                  Erstelle dein erstes Briefing
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent-creator px-3 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Erstellen
                </button>
              </div>
            )
            : briefings.map((briefing) => (
              <div
                key={briefing.id}
                className="rounded-xl bg-white shadow-card overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => setSelectedId(briefing.id)}
              >
                {/* Product image */}
                <div className="h-28 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {briefing.product?.imageUrl ? (
                    <img
                      src={briefing.product.imageUrl}
                      alt={briefing.product.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <FileText className="h-10 w-10 text-gray-200" />
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{briefing.title}</h3>
                  {briefing.product && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{briefing.product.title}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Paperclip className="h-3 w-3" />
                        {briefing.attachmentCount ?? 0}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(briefing.createdAt).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Briefing wirklich löschen?')) {
                          deleteMutation.mutate(briefing.id);
                        }
                      }}
                      className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>

      <CreateBriefingModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(id) => setSelectedId(id)}
      />
    </div>
  );
}

export default function BriefingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
        </div>
      }
    >
      <BriefingsPageInner />
    </Suspense>
  );
}
