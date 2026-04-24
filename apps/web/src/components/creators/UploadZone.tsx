'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, Link2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFile } from '@/lib/supabase';
import { useCreateUpload, UPLOAD_TABS, UPLOAD_TAB_LABELS } from '@/hooks/creators/useUploads';
import type { UploadTab } from '@/hooks/creators/useUploads';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UploadZoneProps {
  creatorId: string;
  defaultTab?: UploadTab;
  onClose: () => void;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UploadZone({ creatorId, defaultTab = 'bilder', onClose, onSuccess }: UploadZoneProps) {
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [tab, setTab] = useState<UploadTab>(defaultTab);
  const [label, setLabel] = useState('');
  const [product, setProduct] = useState('');
  const [batch, setBatch] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createUpload = useCreateUpload();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }, []);

  const getFileType = useCallback((file: File): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'file';
  }, []);

  const handleSubmit = useCallback(async () => {
    setUploading(true);
    setProgress(0);

    try {
      if (mode === 'link') {
        if (!linkUrl.trim()) return;
        await createUpload.mutateAsync({
          creatorId,
          fileName: linkUrl,
          fileUrl: linkUrl,
          fileType: 'link',
          tab,
          label: label || undefined,
          product: product || undefined,
          batch: batch || undefined,
        });
      } else if (selectedFile) {
        // Upload to R2 via backend with progress tracking
        const result = await uploadFile(selectedFile, setProgress);

        // Save metadata to DB
        await createUpload.mutateAsync({
          creatorId,
          fileName: selectedFile.name,
          fileUrl: result.url,
          fileType: getFileType(selectedFile),
          mimeType: selectedFile.type,
          fileSize: selectedFile.size,
          tab,
          label: label || undefined,
          product: product || undefined,
          batch: batch || undefined,
          storageKey: result.key,
        });
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Upload fehlgeschlagen:', error);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [mode, linkUrl, selectedFile, creatorId, tab, label, product, batch, createUpload, getFileType, onClose, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[var(--card-bg)] rounded-2xl shadow-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Inhalt hochladen</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('file')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors',
                mode === 'file'
                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                  : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-transparent hover:bg-gray-100 dark:hover:bg-white/10',
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              Datei hochladen
            </button>
            <button
              onClick={() => setMode('link')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors',
                mode === 'link'
                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                  : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-transparent hover:bg-gray-100 dark:hover:bg-white/10',
              )}
            >
              <Link2 className="h-3.5 w-3.5" />
              Link
            </button>
          </div>

          {/* File upload area or link input */}
          {mode === 'file' ? (
            <>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                  isDragOver
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                    : selectedFile
                      ? 'border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-white/20 bg-gray-50 dark:bg-white/5 hover:border-amber-300 dark:hover:border-amber-500',
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
                {selectedFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">{selectedFile.name}</p>
                    <p className="text-xs text-green-500 dark:text-green-500 mt-1">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="h-8 w-8 text-gray-300 dark:text-gray-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Ziehen & ablegen oder <span className="text-amber-600 dark:text-amber-400 font-medium">Datei waehlen</span>
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Bilder, Videos, Dokumente
                    </p>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {uploading && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>Wird hochgeladen...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-600 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {progress === 100 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      Upload erfolgreich! Wird gespeichert...
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          )}

          {/* Tab selection */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              Kategorie
            </label>
            <div className="flex gap-1.5">
              {UPLOAD_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                    tab === t
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20',
                  )}
                >
                  {UPLOAD_TAB_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Metadata fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="z.B. Entwurf 1"
                className="w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Produkt</label>
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="z.B. Serum"
                className="w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Batch</label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="z.B. Batch A"
                className="w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 dark:border-white/20 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || (mode === 'file' && !selectedFile) || (mode === 'link' && !linkUrl.trim())}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Hochladen
          </button>
        </div>
      </div>
    </div>
  );
}
