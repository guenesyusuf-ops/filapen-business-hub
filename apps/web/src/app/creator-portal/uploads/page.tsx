'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Play,
  FileText,
  Link2,
  MessageCircle,
  Send,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortalCreator {
  id: string;
  name: string;
}

interface PortalUpload {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  tab: string;
  label?: string;
  commentCount: number;
  createdAt: string;
}

interface PortalComment {
  id: string;
  authorRole: string;
  authorName: string;
  message: string;
  createdAt: string;
}

const API_BASE = '/api';

const TABS = ['bilder', 'videos', 'roh', 'auswertung'] as const;
type UploadTab = (typeof TABS)[number];
const TAB_LABELS: Record<UploadTab, string> = {
  bilder: 'Bilder',
  videos: 'Videos',
  roh: 'Roh',
  auswertung: 'Auswertung',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PortalUploadsPage() {
  const router = useRouter();
  const [creator, setCreator] = useState<PortalCreator | null>(null);
  const [tab, setTab] = useState<UploadTab>('bilder');
  const [uploads, setUploads] = useState<PortalUpload[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState<PortalUpload | null>(null);
  const [comments, setComments] = useState<PortalComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  // Upload form state
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [linkUrl, setLinkUrl] = useState('');
  const [uploadLabel, setUploadLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('creator_data');
    if (stored) {
      try {
        setCreator(JSON.parse(stored));
      } catch {
        router.push('/creator-portal');
      }
    } else {
      router.push('/creator-portal');
    }
  }, [router]);

  const fetchUploads = useCallback(async () => {
    if (!creator) return;
    setLoadingUploads(true);
    try {
      const res = await fetch(`${API_BASE}/creator-uploads?creatorId=${creator.id}&tab=${tab}`);
      if (res.ok) setUploads(await res.json());
    } catch {
      // ignore
    } finally {
      setLoadingUploads(false);
    }
  }, [creator, tab]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const fetchComments = useCallback(async (uploadId: string) => {
    try {
      const res = await fetch(`${API_BASE}/upload-comments?uploadId=${uploadId}`);
      if (res.ok) setComments(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (selectedUpload) fetchComments(selectedUpload.id);
  }, [selectedUpload, fetchComments]);

  const handleSendComment = useCallback(async () => {
    if (!selectedUpload || !commentText.trim() || !creator) return;
    try {
      await fetch(`${API_BASE}/upload-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: selectedUpload.id,
          creatorId: creator.id,
          authorRole: 'creator',
          authorName: creator.name,
          message: commentText.trim(),
        }),
      });
      setCommentText('');
      fetchComments(selectedUpload.id);
    } catch {
      // ignore
    }
  }, [selectedUpload, commentText, creator, fetchComments]);

  const handleUploadSubmit = useCallback(async () => {
    if (!creator) return;
    setUploading(true);
    try {
      let fileUrl = '';
      let fileName = '';
      let fileType = 'file';
      let mimeType: string | undefined;
      let fileSize: number | undefined;

      if (uploadMode === 'link') {
        fileUrl = linkUrl;
        fileName = linkUrl;
        fileType = 'link';
      } else if (selectedFile) {
        fileUrl = URL.createObjectURL(selectedFile);
        fileName = selectedFile.name;
        fileType = selectedFile.type.startsWith('image/')
          ? 'image'
          : selectedFile.type.startsWith('video/')
            ? 'video'
            : 'file';
        mimeType = selectedFile.type;
        fileSize = selectedFile.size;
      }

      await fetch(`${API_BASE}/creator-uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: creator.id,
          fileName,
          fileUrl,
          fileType,
          mimeType,
          fileSize,
          tab,
          label: uploadLabel || undefined,
        }),
      });

      setShowUpload(false);
      setSelectedFile(null);
      setLinkUrl('');
      setUploadLabel('');
      fetchUploads();
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  }, [uploadMode, linkUrl, selectedFile, creator, tab, uploadLabel, fetchUploads]);

  if (!creator) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My Uploads</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your content uploads</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setSelectedUpload(null);
            }}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'bg-violet-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200',
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loadingUploads ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : uploads.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Upload className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No uploads in this category yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {uploads.map((upload) => (
            <button
              key={upload.id}
              onClick={() => setSelectedUpload(upload)}
              className={cn(
                'group relative aspect-square rounded-xl border overflow-hidden hover:shadow-md transition-all bg-gray-50',
                selectedUpload?.id === upload.id
                  ? 'border-violet-500 ring-2 ring-violet-500/30'
                  : 'border-gray-100',
              )}
            >
              {upload.fileType === 'image' ? (
                <img
                  src={upload.fileUrl}
                  alt={upload.fileName}
                  className="w-full h-full object-cover"
                />
              ) : upload.fileType === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <Play className="h-8 w-8 text-white opacity-75" />
                </div>
              ) : upload.fileType === 'link' ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Link2 className="h-8 w-8 text-gray-400" />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-white truncate">{upload.fileName}</p>
              </div>
              {upload.commentCount > 0 && (
                <div className="absolute top-2 right-2 bg-violet-600 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                  <MessageCircle className="h-2.5 w-2.5 text-white" />
                  <span className="text-[10px] text-white font-medium">
                    {upload.commentCount}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Comments panel */}
      {selectedUpload && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <MessageCircle className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-medium text-gray-900">
              Comments - {selectedUpload.fileName}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-3">
            {comments.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No comments yet</p>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'flex gap-2',
                    c.authorRole === 'creator' ? 'flex-row-reverse' : '',
                  )}
                >
                  <div
                    className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      c.authorRole === 'admin'
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-gray-100 text-gray-600',
                    )}
                  >
                    {c.authorName.charAt(0)}
                  </div>
                  <div
                    className={cn(
                      'max-w-[70%] rounded-xl px-3 py-2',
                      c.authorRole === 'admin' ? 'bg-violet-50' : 'bg-gray-50',
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-gray-700">
                        {c.authorName}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(c.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{c.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendComment();
              }}
              placeholder="Write a comment..."
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
            />
            <button
              onClick={handleSendComment}
              disabled={!commentText.trim()}
              className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="absolute inset-0" onClick={() => setShowUpload(false)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Upload to {TAB_LABELS[tab]}
              </h3>
              <button
                onClick={() => setShowUpload(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setUploadMode('file')}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
                    uploadMode === 'file'
                      ? 'bg-violet-50 text-violet-700 border border-violet-200'
                      : 'bg-gray-50 text-gray-500',
                  )}
                >
                  File
                </button>
                <button
                  onClick={() => setUploadMode('link')}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
                    uploadMode === 'link'
                      ? 'bg-violet-50 text-violet-700 border border-violet-200'
                      : 'bg-gray-50 text-gray-500',
                  )}
                >
                  Link
                </button>
              </div>

              {uploadMode === 'file' ? (
                <label className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-violet-300 bg-gray-50">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept="image/*,video/*,.pdf,.doc,.docx"
                  />
                  {selectedFile ? (
                    <p className="text-sm text-green-700 font-medium">
                      {selectedFile.name}
                    </p>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-gray-300 mb-1" />
                      <p className="text-xs text-gray-500">Click to browse</p>
                    </>
                  )}
                </label>
              ) : (
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                />
              )}

              <input
                type="text"
                value={uploadLabel}
                onChange={(e) => setUploadLabel(e.target.value)}
                placeholder="Label (optional)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
              />
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowUpload(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={
                  uploading ||
                  (uploadMode === 'file' && !selectedFile) ||
                  (uploadMode === 'link' && !linkUrl.trim())
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
