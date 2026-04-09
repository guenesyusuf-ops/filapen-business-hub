'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, Link2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
        // For MVP: create a placeholder URL. In production, upload to Supabase Storage first.
        // This creates the metadata record. The actual file URL should come from Supabase Storage upload.
        const fileUrl = URL.createObjectURL(selectedFile);
        await createUpload.mutateAsync({
          creatorId,
          fileName: selectedFile.name,
          fileUrl,
          fileType: getFileType(selectedFile),
          mimeType: selectedFile.type,
          fileSize: selectedFile.size,
          tab,
          label: label || undefined,
          product: product || undefined,
          batch: batch || undefined,
        });
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }, [mode, linkUrl, selectedFile, creatorId, tab, label, product, batch, createUpload, getFileType, onClose, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Upload Content</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : 'bg-gray-50 text-gray-500 border border-transparent hover:bg-gray-100',
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              File Upload
            </button>
            <button
              onClick={() => setMode('link')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors',
                mode === 'link'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : 'bg-gray-50 text-gray-500 border border-transparent hover:bg-gray-100',
              )}
            >
              <Link2 className="h-3.5 w-3.5" />
              Link
            </button>
          </div>

          {/* File upload area or link input */}
          {mode === 'file' ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                isDragOver
                  ? 'border-purple-400 bg-purple-50'
                  : selectedFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50 hover:border-purple-300',
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
                  <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                  <p className="text-xs text-green-500 mt-1">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    Drag & drop or <span className="text-purple-600 font-medium">browse</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Images, Videos, Documents
                  </p>
                </div>
              )}
            </div>
          ) : (
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
            />
          )}

          {/* Tab selection */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
              Category
            </label>
            <div className="flex gap-1.5">
              {UPLOAD_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                    tab === t
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Draft 1"
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="e.g. Serum"
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Batch</label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. Batch A"
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || (mode === 'file' && !selectedFile) || (mode === 'link' && !linkUrl.trim())}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
