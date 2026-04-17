'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Trash2,
  Send,
  FileText,
  Image,
  Video,
  Link2,
  MessageCircle,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreatorUpload, UploadComment } from '@/hooks/creators/useUploads';
import { useUploadComments, useCreateComment, useGoLiveUpload } from '@/hooks/creators/useUploads';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LightboxProps {
  upload: CreatorUpload;
  onClose: () => void;
  onDelete?: (uploadId: string) => void;
  authorName?: string;
  authorRole?: 'admin' | 'creator';
  creatorId?: string;
}

// ---------------------------------------------------------------------------
// File Type Icon
// ---------------------------------------------------------------------------

function FileTypeIcon({ fileType }: { fileType: string }) {
  switch (fileType) {
    case 'image':
      return <Image className="h-5 w-5 text-blue-500" />;
    case 'video':
      return <Video className="h-5 w-5 text-purple-500" />;
    case 'link':
      return <Link2 className="h-5 w-5 text-green-500" />;
    default:
      return <FileText className="h-5 w-5 text-gray-500" />;
  }
}

// ---------------------------------------------------------------------------
// Format file size
// ---------------------------------------------------------------------------

function formatSize(bytes: number | undefined): string {
  if (!bytes) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Comment Item
// ---------------------------------------------------------------------------

function CommentItem({ comment }: { comment: UploadComment }) {
  const isAdmin = comment.authorRole === 'admin';
  return (
    <div className={cn('flex gap-2.5 py-2.5', isAdmin ? 'flex-row-reverse' : '')}>
      <div
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
          isAdmin
            ? 'bg-purple-100 text-purple-700'
            : 'bg-gray-100 text-gray-600',
        )}
      >
        {comment.authorName.charAt(0)}
      </div>
      <div
        className={cn(
          'max-w-[75%] rounded-xl px-3 py-2',
          isAdmin
            ? 'bg-purple-50 text-purple-900'
            : 'bg-gray-50 text-gray-800',
        )}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium">{comment.authorName}</span>
          <span className="text-[10px] text-gray-400">
            {new Date(comment.createdAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{comment.message}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightbox Component
// ---------------------------------------------------------------------------

export function Lightbox({
  upload,
  onClose,
  onDelete,
  authorName = 'Admin',
  authorRole = 'admin',
  creatorId,
}: LightboxProps) {
  const [message, setMessage] = useState('');
  const [showLivePopover, setShowLivePopover] = useState(false);
  const [liveDate, setLiveDate] = useState(
    upload.liveDate ? upload.liveDate.split('T')[0] : '',
  );
  const [notifyCreator, setNotifyCreator] = useState(true);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const livePopoverRef = useRef<HTMLDivElement>(null);

  const { data: comments = [] } = useUploadComments(upload.id);
  const createComment = useCreateComment();
  const goLive = useGoLiveUpload();

  // Close live popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        livePopoverRef.current &&
        !livePopoverRef.current.contains(e.target as Node)
      ) {
        setShowLivePopover(false);
      }
    };
    if (showLivePopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLivePopover]);

  const handleGoLive = useCallback(() => {
    if (!liveDate) return;
    goLive.mutate(
      { uploadId: upload.id, liveDate, notifyCreator },
      {
        onSuccess: () => {
          setShowLivePopover(false);
        },
      },
    );
  }, [liveDate, notifyCreator, upload.id, goLive]);

  // Scroll to bottom on new comments
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    createComment.mutate({
      uploadId: upload.id,
      creatorId: creatorId || undefined,
      authorRole,
      authorName,
      message: message.trim(),
    });
    setMessage('');
  }, [message, upload.id, creatorId, authorRole, authorName, createComment]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Overlay click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-5xl h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden mx-4">
        {/* Left: Media */}
        <div className="flex-1 flex flex-col bg-gray-900 min-w-0">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
            <div className="flex items-center gap-2 min-w-0">
              <FileTypeIcon fileType={upload.fileType} />
              <span className="text-sm text-white font-medium truncate">
                {upload.fileName}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Live Button / Badge */}
              <div className="relative" ref={livePopoverRef}>
                {upload.liveStatus === 'live' && upload.liveDate ? (
                  <button
                    onClick={() => setShowLivePopover(!showLivePopover)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-100 transition-colors"
                    title="Live-Datum ändern"
                  >
                    <Radio className="h-3.5 w-3.5" />
                    Live am{' '}
                    {new Date(upload.liveDate).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowLivePopover(!showLivePopover)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors"
                    title="Live setzen"
                  >
                    <Radio className="h-3.5 w-3.5" />
                    Live
                  </button>
                )}

                {/* Live Popover */}
                {showLivePopover && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Live-Datum
                        </label>
                        <input
                          type="date"
                          value={liveDate}
                          onChange={(e) => setLiveDate(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifyCreator}
                          onChange={(e) => setNotifyCreator(e.target.checked)}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700">
                          Creator benachrichtigen
                        </span>
                      </label>
                      <button
                        onClick={handleGoLive}
                        disabled={!liveDate || goLive.isPending}
                        className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {goLive.isPending ? 'Wird gespeichert...' : 'Speichern'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <a
                href={upload.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
              {onDelete && (
                <button
                  onClick={() => onDelete(upload.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Media content */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {upload.fileType === 'image' ? (
              <img
                src={upload.fileUrl}
                alt={upload.fileName}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : upload.fileType === 'video' ? (
              <video
                src={upload.fileUrl}
                controls
                className="max-w-full max-h-full rounded-lg"
              />
            ) : upload.fileType === 'link' ? (
              <div className="text-center">
                <Link2 className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                <a
                  href={upload.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline text-sm"
                >
                  {upload.fileUrl}
                </a>
              </div>
            ) : (
              <div className="text-center">
                <FileText className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-sm">{upload.fileName}</p>
              </div>
            )}
          </div>

          {/* File info bar */}
          <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 text-xs text-gray-400">
            <span>{upload.fileType}</span>
            {upload.mimeType && <span>{upload.mimeType}</span>}
            <span>{formatSize(upload.fileSize)}</span>
            <span>
              {new Date(upload.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {upload.label && <span className="text-purple-400">{upload.label}</span>}
          </div>
        </div>

        {/* Right: Comments */}
        <div className="w-80 flex flex-col border-l border-gray-200 bg-white">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <MessageCircle className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Comments ({comments.length})
            </span>
          </div>

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {comments.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No comments yet</p>
              </div>
            ) : (
              <>
                {comments.map((c) => (
                  <CommentItem key={c.id} comment={c} />
                ))}
                <div ref={commentsEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 resize-none"
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || createComment.isPending}
                className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
