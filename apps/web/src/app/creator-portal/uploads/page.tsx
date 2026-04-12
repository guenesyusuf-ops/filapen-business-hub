'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  FolderPlus,
  Folder,
  ArrowLeft,
  Calendar,
  Tag,
  Package,
  ChevronRight,
  Image,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadToSupabase } from '@/lib/supabase';

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
  batch?: string;
  product?: string;
  category?: string;
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

/** A "folder" is a virtual grouping by batch name with metadata stored in the first upload. */
interface FolderMeta {
  name: string;
  batch: string;
  datum?: string;
  deadline?: string;
  produkte?: string;
  tags?: string;
  fileCount: number;
  createdAt: string;
}

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || ''}/api`;

const CATEGORIES = [
  { value: 'bilder', label: 'Bilder' },
  { value: 'videos', label: 'Videos' },
  { value: 'roh', label: 'Roh' },
  { value: 'auswertung', label: 'Auswertung' },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]['value'];

function categoryLabel(val: string) {
  return CATEGORIES.find((c) => c.value === val)?.label ?? val;
}

function categoryColor(val: string) {
  const map: Record<string, string> = {
    bilder: 'bg-blue-50 text-blue-700 border-blue-200',
    videos: 'bg-pink-50 text-pink-700 border-pink-200',
    roh: 'bg-amber-50 text-amber-700 border-amber-200',
    auswertung: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return map[val] ?? 'bg-gray-50 text-gray-600 border-gray-200';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PortalUploadsPage() {
  const router = useRouter();
  const [creator, setCreator] = useState<PortalCreator | null>(null);
  const [uploads, setUploads] = useState<PortalUpload[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState<PortalUpload | null>(null);
  const [comments, setComments] = useState<PortalComment[]>([]);
  const [commentText, setCommentText] = useState('');

  // Folder state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderMeta[]>([]);

  // Folder form
  const [folderName, setFolderName] = useState('');
  const [folderBatch, setFolderBatch] = useState('');
  const [folderDatum, setFolderDatum] = useState('');
  const [folderDeadline, setFolderDeadline] = useState('');
  const [folderProdukte, setFolderProdukte] = useState('');
  const [folderTags, setFolderTags] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<CategoryValue>('bilder');
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadProduct, setUploadProduct] = useState('');
  const [uploadLink, setUploadLink] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch all uploads for this creator
  const fetchUploads = useCallback(async () => {
    if (!creator) return;
    setLoadingUploads(true);
    try {
      const res = await fetch(`${API_BASE}/creator-uploads?creatorId=${creator.id}`);
      if (res.ok) {
        const data: PortalUpload[] = await res.json();
        setUploads(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingUploads(false);
    }
  }, [creator]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  // Derive folders from uploads' batch field
  useEffect(() => {
    const folderMap = new Map<string, FolderMeta>();

    for (const u of uploads) {
      const batch = u.batch || 'Unsortiert';
      if (!folderMap.has(batch)) {
        // Try to parse metadata from label if it's JSON
        let meta: Partial<FolderMeta> = {};
        if (u.label && u.label.startsWith('{')) {
          try {
            meta = JSON.parse(u.label);
          } catch {
            // not JSON, ignore
          }
        }
        folderMap.set(batch, {
          name: meta.name || batch,
          batch,
          datum: meta.datum,
          deadline: meta.deadline,
          produkte: meta.produkte,
          tags: meta.tags,
          fileCount: 0,
          createdAt: u.createdAt,
        });
      }
      const folder = folderMap.get(batch)!;
      folder.fileCount += 1;
      // Use earliest createdAt
      if (u.createdAt < folder.createdAt) {
        folder.createdAt = u.createdAt;
      }
    }

    setFolders(
      Array.from(folderMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );
  }, [uploads]);

  // Files in the active folder
  const folderFiles = activeFolder
    ? uploads.filter((u) => (u.batch || 'Unsortiert') === activeFolder)
    : [];

  // Comments
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

  // Create folder = store a metadata upload record with batch name
  const handleCreateFolder = useCallback(async () => {
    if (!creator || !folderName.trim()) return;
    setCreatingFolder(true);
    const batchName = folderBatch.trim() || folderName.trim();

    // Store folder metadata as a special upload record
    const meta = JSON.stringify({
      name: folderName.trim(),
      datum: folderDatum || undefined,
      deadline: folderDeadline || undefined,
      produkte: folderProdukte || undefined,
      tags: folderTags || undefined,
      _folderMeta: true,
    });

    try {
      await fetch(`${API_BASE}/creator-uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: creator.id,
          fileName: `__folder__${batchName}`,
          fileUrl: '',
          fileType: 'folder',
          tab: 'bilder',
          batch: batchName,
          label: meta,
        }),
      });

      setShowFolderModal(false);
      setFolderName('');
      setFolderBatch('');
      setFolderDatum('');
      setFolderDeadline('');
      setFolderProdukte('');
      setFolderTags('');
      fetchUploads();
    } catch {
      // ignore
    } finally {
      setCreatingFolder(false);
    }
  }, [
    creator,
    folderName,
    folderBatch,
    folderDatum,
    folderDeadline,
    folderProdukte,
    folderTags,
    fetchUploads,
  ]);

  // Upload file into active folder
  const [uploadError, setUploadError] = useState('');

  const handleUploadSubmit = useCallback(async () => {
    setUploadError('');
    if (!creator) { setUploadError('Creator nicht geladen'); return; }
    if (!selectedFile && !uploadLink.trim()) { setUploadError('Bitte waehle eine Datei aus oder gib einen Link ein'); return; }
    setUploading(true);

    try {
      let fileUrl = '';
      let fileName = '';
      let fileType = 'file';
      let mimeType: string | undefined;
      let fileSize: number | undefined;

      if (uploadLink.trim()) {
        fileUrl = uploadLink.trim();
        fileName = uploadLink.trim();
        fileType = 'link';
      } else if (selectedFile) {
        // Upload to Supabase Storage for persistent URLs
        const timestamp = Date.now();
        const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `uploads/${creator.id}/${timestamp}-${sanitizedName}`;
        fileUrl = await uploadToSupabase(selectedFile, storagePath, () => {});
        fileName = selectedFile.name;
        fileType = selectedFile.type.startsWith('image/')
          ? 'image'
          : selectedFile.type.startsWith('video/')
            ? 'video'
            : 'file';
        mimeType = selectedFile.type;
        fileSize = selectedFile.size;
      }

      if (!fileUrl && !uploadLink.trim()) {
        setUploading(false);
        return;
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
          tab: uploadCategory,
          batch: activeFolder || 'Allgemein',
          label: uploadLabel.trim() || selectedFile?.name || 'Upload',
          product: uploadProduct.trim() || undefined,
          category: uploadCategory,
        }),
      });

      setShowUpload(false);
      setSelectedFile(null);
      setUploadLink('');
      setUploadLabel('');
      setUploadProduct('');
      setUploadCategory('bilder');
      fetchUploads();
    } catch (error) {
      console.error('Upload fehlgeschlagen:', error);
      setUploadError(
        error instanceof Error
          ? `Upload fehlgeschlagen: ${error.message}`
          : 'Upload fehlgeschlagen. Bitte versuche es erneut.',
      );
    } finally {
      setUploading(false);
    }
  }, [
    creator,
    activeFolder,
    uploadCategory,
    uploadLabel,
    uploadProduct,
    uploadLink,
    selectedFile,
    fetchUploads,
  ]);

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  if (!creator) return null;

  // =========================================================================
  // Folder detail view
  // =========================================================================
  if (activeFolder) {
    const folderMeta = folders.find((f) => f.batch === activeFolder);
    const visibleFiles = folderFiles.filter((f) => f.fileType !== 'folder');

    return (
      <div className="space-y-6">
        {/* Back */}
        <button
          onClick={() => {
            setActiveFolder(null);
            setSelectedUpload(null);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Alle Ordner
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Folder className="h-5 w-5 text-violet-600" />
              {folderMeta?.name || activeFolder}
            </h1>
            <div className="flex flex-wrap gap-3 mt-1">
              {folderMeta?.datum && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Datum: {new Date(folderMeta.datum).toLocaleDateString('de-DE')}
                </span>
              )}
              {folderMeta?.deadline && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Deadline: {new Date(folderMeta.deadline).toLocaleDateString('de-DE')}
                </span>
              )}
              {folderMeta?.produkte && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {folderMeta.produkte}
                </span>
              )}
              {folderMeta?.tags && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {folderMeta.tags}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Datei hochladen
          </button>
        </div>

        {/* Files grid */}
        {loadingUploads ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : visibleFiles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Upload className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Noch keine Dateien in diesem Ordner</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-3 text-sm text-violet-600 hover:underline"
            >
              Erste Datei hochladen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {visibleFiles.map((upload) => (
              <button
                key={upload.id}
                onClick={() => setSelectedUpload(upload)}
                className={cn(
                  'group relative rounded-xl border overflow-hidden hover:shadow-md transition-all bg-white',
                  selectedUpload?.id === upload.id
                    ? 'border-violet-500 ring-2 ring-violet-500/30'
                    : 'border-gray-100',
                )}
              >
                <div className="aspect-square">
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
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <Link2 className="h-8 w-8 text-gray-400" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <FileText className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>
                {/* Info bar */}
                <div className="px-2 py-2 border-t border-gray-50">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {upload.label || upload.fileName}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    {upload.category && (
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                          categoryColor(upload.category),
                        )}
                      >
                        {categoryLabel(upload.category)}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {new Date(upload.createdAt).toLocaleDateString('de-DE')}
                    </span>
                  </div>
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
                Kommentare - {selectedUpload.label || selectedUpload.fileName}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-3">
              {comments.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Noch keine Kommentare</p>
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
                          {new Date(c.createdAt).toLocaleString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
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
                placeholder="Kommentar schreiben..."
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

        {/* Upload File Modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="absolute inset-0" onClick={() => setShowUpload(false)} />
            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  Datei hochladen
                </h3>
                <button
                  onClick={() => setShowUpload(false)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Kategorie
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as CategoryValue)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Label */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Bezeichnung <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadLabel}
                    onChange={(e) => setUploadLabel(e.target.value)}
                    placeholder="z.B. Produktfoto Set A"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                  />
                </div>

                {/* Product */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Produkt (optional)
                  </label>
                  <input
                    type="text"
                    value={uploadProduct}
                    onChange={(e) => setUploadProduct(e.target.value)}
                    placeholder="Produktname"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                  />
                </div>

                {/* Google Drive Link */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Google Drive Link (optional)
                  </label>
                  <input
                    type="url"
                    value={uploadLink}
                    onChange={(e) => setUploadLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                  />
                </div>

                {/* Drag-and-drop zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                    dragOver
                      ? 'border-violet-400 bg-violet-50'
                      : selectedFile
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-violet-300 bg-gray-50',
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept="image/*,video/*,.pdf,.doc,.docx"
                  />
                  {selectedFile ? (
                    <div className="text-center">
                      <p className="text-sm text-green-700 font-medium">{selectedFile.name}</p>
                      <p className="text-[10px] text-green-600 mt-0.5">
                        {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-gray-300 mb-1" />
                      <p className="text-xs text-gray-500">
                        Klicken oder Datei hierher ziehen
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Bilder &amp; Videos &middot; optional wenn Link angegeben
                      </p>
                    </>
                  )}
                </div>
              </div>
              {uploadError && (
                <div className="mx-5 mb-0 mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {uploadError}
                </div>
              )}
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
                <button
                  onClick={() => { setShowUpload(false); setUploadError(''); }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleUploadSubmit}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
                >
                  {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Hochladen &rarr;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // Folder list view (main)
  // =========================================================================
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Meine Uploads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Verwalte deine Inhalte in Ordnern
          </p>
        </div>
        <button
          onClick={() => setShowFolderModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          Ordner anlegen
        </button>
      </div>

      {/* Folder list */}
      {loadingUploads ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : folders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Folder className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Noch keine Ordner vorhanden</p>
          <button
            onClick={() => setShowFolderModal(true)}
            className="mt-3 text-sm text-violet-600 hover:underline"
          >
            Ersten Ordner anlegen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {folders.map((folder) => (
            <button
              key={folder.batch}
              onClick={() => setActiveFolder(folder.batch)}
              className="text-left rounded-xl bg-white p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Folder className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {folder.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {folder.fileCount - 1 >= 0 ? folder.fileCount - 1 : 0} Dateien
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-violet-600 transition-colors mt-1" />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {folder.datum && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Calendar className="h-2.5 w-2.5" />
                    {new Date(folder.datum).toLocaleDateString('de-DE')}
                  </span>
                )}
                {folder.deadline && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    Deadline: {new Date(folder.deadline).toLocaleDateString('de-DE')}
                  </span>
                )}
                {folder.produkte && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Package className="h-2.5 w-2.5" />
                    {folder.produkte}
                  </span>
                )}
                {folder.tags && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Tag className="h-2.5 w-2.5" />
                    {folder.tags}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="absolute inset-0" onClick={() => setShowFolderModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Ordner anlegen
              </h3>
              <button
                onClick={() => setShowFolderModal(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="z.B. Kampagne April 2026"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Batch-Name (optional)
                </label>
                <input
                  type="text"
                  value={folderBatch}
                  onChange={(e) => setFolderBatch(e.target.value)}
                  placeholder="Standard: gleich wie Name"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Datum (optional)
                  </label>
                  <input
                    type="date"
                    value={folderDatum}
                    onChange={(e) => setFolderDatum(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Deadline (optional)
                  </label>
                  <input
                    type="date"
                    value={folderDeadline}
                    onChange={(e) => setFolderDeadline(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Produkte (optional)
                </label>
                <input
                  type="text"
                  value={folderProdukte}
                  onChange={(e) => setFolderProdukte(e.target.value)}
                  placeholder="z.B. Shampoo, Conditioner"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Tags (optional, kommagetrennt)
                </label>
                <input
                  type="text"
                  value={folderTags}
                  onChange={(e) => setFolderTags(e.target.value)}
                  placeholder="z.B. premium, sommer, tiktok"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowFolderModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !folderName.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                {creatingFolder && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Ordner erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
