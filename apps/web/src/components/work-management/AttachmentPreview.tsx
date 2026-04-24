'use client';

import { X, Download, FileText, File as FileIcon } from 'lucide-react';
import type { WmAttachment } from '@/hooks/work-management/useWm';

interface AttachmentPreviewProps {
  attachment: WmAttachment;
  onClose: () => void;
}

function detectType(att: WmAttachment): 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other' {
  const mime = (att.fileType || '').toLowerCase();
  const name = att.fileName.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/.test(name)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/.test(name)) return 'audio';
  if (mime === 'application/pdf' || /\.pdf$/.test(name)) return 'pdf';
  if (mime.startsWith('text/') || /\.(txt|md|csv|log|json|xml|html?|ya?ml)$/.test(name)) return 'text';
  return 'other';
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function AttachmentPreview({ attachment, onClose }: AttachmentPreviewProps) {
  const type = detectType(attachment);

  // Handle ESC key
  if (typeof window !== 'undefined') {
    window.onkeydown = (e) => {
      if (e.key === 'Escape') onClose();
    };
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-b from-black/60 to-transparent text-white">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-4 w-4 flex-shrink-0 opacity-70" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{attachment.fileName}</p>
            <p className="text-[11px] text-white/60">
              {formatSize(attachment.fileSize)}
              {attachment.fileType && ` · ${attachment.fileType}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <a
            href={attachment.fileUrl}
            download={attachment.fileName}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-medium transition-colors"
            title="Herunterladen"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
          <button
            onClick={onClose}
            className="rounded-lg p-2 bg-white/10 hover:bg-white/20 transition-colors"
            title="Schließen (ESC)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="relative z-[5] w-full max-w-6xl max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {type === 'image' && (
          <img
            src={attachment.fileUrl}
            alt={attachment.fileName}
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
          />
        )}

        {type === 'video' && (
          <video
            src={attachment.fileUrl}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl bg-black"
          />
        )}

        {type === 'audio' && (
          <div className="rounded-2xl bg-white dark:bg-[#1a1d2e] p-8 shadow-2xl min-w-[320px]">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <FileIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{attachment.fileName}</p>
                <p className="text-xs text-gray-500">{formatSize(attachment.fileSize)}</p>
              </div>
            </div>
            <audio src={attachment.fileUrl} controls autoPlay className="w-full" />
          </div>
        )}

        {type === 'pdf' && (
          <iframe
            src={attachment.fileUrl}
            title={attachment.fileName}
            className="w-full h-[85vh] rounded-lg shadow-2xl bg-white"
          />
        )}

        {type === 'text' && (
          <iframe
            src={attachment.fileUrl}
            title={attachment.fileName}
            className="w-full h-[85vh] rounded-lg shadow-2xl bg-white"
          />
        )}

        {type === 'other' && (
          <div className="rounded-2xl bg-white dark:bg-[#1a1d2e] p-10 shadow-2xl text-center max-w-md">
            <FileIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 break-all">
              {attachment.fileName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Dieser Dateityp kann nicht direkt angezeigt werden.
              {attachment.fileSize && <> Größe: {formatSize(attachment.fileSize)}.</>}
            </p>
            <a
              href={attachment.fileUrl}
              download={attachment.fileName}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
            >
              <Download className="h-4 w-4" />
              Herunterladen
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact clickable row used inside the task detail modal.
 * Shows a thumbnail for images, an icon otherwise. Click → preview.
 */
export function AttachmentRow({
  attachment,
  onOpen,
  onDelete,
}: {
  attachment: WmAttachment;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const type = detectType(attachment);
  const isImage = type === 'image';

  return (
    <div className="group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
      {/* Thumbnail / icon */}
      <button
        onClick={onOpen}
        className="flex-shrink-0 h-10 w-10 rounded-md overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 flex items-center justify-center hover:border-primary-400 transition-colors"
        title="Vorschau öffnen"
      >
        {isImage ? (
          <img src={attachment.fileUrl} alt={attachment.fileName} className="w-full h-full object-cover" />
        ) : type === 'video' ? (
          <FileIcon className="h-4 w-4 text-amber-500" />
        ) : type === 'pdf' ? (
          <FileText className="h-4 w-4 text-red-500" />
        ) : type === 'audio' ? (
          <FileIcon className="h-4 w-4 text-amber-500" />
        ) : (
          <FileIcon className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Name + size */}
      <button
        onClick={onOpen}
        className="flex-1 text-left min-w-0"
      >
        <p className="text-sm text-gray-700 dark:text-gray-300 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {attachment.fileName}
        </p>
        <p className="text-[10px] text-gray-400">{formatSize(attachment.fileSize)}</p>
      </button>

      {/* Actions */}
      <a
        href={attachment.fileUrl}
        download={attachment.fileName}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary-500 transition-all"
        title="Herunterladen"
      >
        <Download className="h-3.5 w-3.5" />
      </a>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
        title="Löschen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
