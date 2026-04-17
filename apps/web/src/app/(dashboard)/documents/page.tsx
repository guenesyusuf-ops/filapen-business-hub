'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Folder, FolderPlus, Upload, Search, Grid3X3, List, Star, Trash2,
  ChevronRight, MoreVertical, Lock, Unlock, FileText, Image, Video,
  File as FileIcon, ArrowLeft, X, Plus, Download, Eye, Edit3,
} from 'lucide-react';
import {
  useDocFolders, useDocFiles, useCreateDocFolder, useUploadDocFile,
  useTrashDocFolder, useTrashDocFile, useToggleFavorite,
  useLockDocFolder, useUnlockDocFolder, useDocSearch,
  type DocFolder, type DocFile,
} from '@/hooks/useDocuments';
import { useAuthStore } from '@/stores/auth';

type ViewMode = 'grid' | 'list';

function getFileIcon(fileType: string | null) {
  switch (fileType) {
    case 'image': return <Image className="h-5 w-5 text-pink-500" />;
    case 'video': return <Video className="h-5 w-5 text-purple-500" />;
    case 'pdf': return <FileText className="h-5 w-5 text-red-500" />;
    case 'document': return <FileText className="h-5 w-5 text-blue-500" />;
    case 'spreadsheet': return <FileText className="h-5 w-5 text-emerald-500" />;
    default: return <FileIcon className="h-5 w-5 text-gray-400" />;
  }
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ---------- Main Page ----------

export default function DocumentsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Dokumente' }]);
  const currentFolderId = folderPath[folderPath.length - 1].id;

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const { data: folders = [], isLoading: foldersLoading } = useDocFolders(currentFolderId);
  const { data: files = [], isLoading: filesLoading } = useDocFiles(currentFolderId, searchQuery || undefined);
  const { data: searchResults } = useDocSearch(searchQuery);

  const createFolder = useCreateDocFolder();
  const uploadFile = useUploadDocFile();
  const trashFolder = useTrashDocFolder();
  const trashFile = useTrashDocFile();
  const toggleFav = useToggleFavorite();
  const lockFolder = useLockDocFolder();
  const unlockFolder = useUnlockDocFolder();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);

  function navigateToFolder(id: string | null, name: string) {
    if (id === currentFolderId) return;
    const existingIdx = folderPath.findIndex((p) => p.id === id);
    if (existingIdx >= 0) {
      setFolderPath(folderPath.slice(0, existingIdx + 1));
    } else {
      setFolderPath([...folderPath, { id, name }]);
    }
    setSearchQuery('');
  }

  function goUp() {
    if (folderPath.length > 1) {
      setFolderPath(folderPath.slice(0, -1));
    }
  }

  async function handleFileUpload(fileList: FileList) {
    setUploading(true);
    setUploadProgress(0);
    try {
      const files = Array.from(fileList);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadFileName(`${file.name} (${i + 1}/${files.length})`);
        setUploadProgress(0);
        await uploadFile.mutateAsync({
          folderId: currentFolderId || undefined,
          file,
          onProgress: (pct) => setUploadProgress(pct),
        });
        setUploadProgress(100);
      }
      // Show "fertig" briefly
      setUploadFileName('Alle Dateien hochgeladen ✓');
      setUploadProgress(100);
      await new Promise((r) => setTimeout(r, 1200));
    } catch { /* handled by mutation */ }
    setUploading(false);
    setUploadProgress(0);
    setUploadFileName('');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
  }

  function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    createFolder.mutate({ name: newFolderName.trim(), parentId: currentFolderId || undefined });
    setNewFolderName('');
    setShowCreateFolder(false);
  }

  const isLoading = foldersLoading || filesLoading;
  const isSearching = searchQuery.length >= 2;
  const displayFolders = isSearching ? (searchResults?.folders ?? []) : folders;
  const displayFiles = isSearching ? (searchResults?.files ?? []) : files;

  return (
    <div
      className="space-y-4 sm:space-y-5 animate-fade-in"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 bg-primary-500/10 border-4 border-dashed border-primary-500 flex items-center justify-center pointer-events-none">
          <div className="rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl px-8 py-6 text-center">
            <Upload className="h-12 w-12 text-primary-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-gray-900 dark:text-white">Dateien hier ablegen</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Dokumente</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 hidden sm:block">
            Dateien, Ordner und Medien verwalten
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateFolder(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <FolderPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Ordner</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Lädt...' : <span className="hidden sm:inline">Hochladen</span>}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Breadcrumbs + Search + View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm min-w-0 flex-1 overflow-x-auto">
          {folderPath.length > 1 && (
            <button onClick={goUp} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          {folderPath.map((crumb, i) => (
            <span key={crumb.id ?? 'root'} className="flex items-center gap-1 flex-shrink-0">
              {i > 0 && <ChevronRight className="h-3 w-3 text-gray-300" />}
              <button
                onClick={() => navigateToFolder(crumb.id, crumb.name)}
                className={cn(
                  'font-medium transition-colors whitespace-nowrap',
                  i === folderPath.length - 1
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                )}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0 w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Suchen..."
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-white/[0.06] p-0.5 flex-shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={cn('p-1.5 rounded-md transition-all', viewMode === 'grid' ? 'bg-white dark:bg-[#1a1d2e] shadow-sm' : 'text-gray-400')}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn('p-1.5 rounded-md transition-all', viewMode === 'list' ? 'bg-white dark:bg-[#1a1d2e] shadow-sm' : 'text-gray-400')}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="rounded-lg border border-primary-200 dark:border-primary-900/30 bg-primary-50/50 dark:bg-primary-900/10 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-primary-700 dark:text-primary-400 truncate">{uploadFileName || 'Lade hoch...'}</span>
            <span className="text-xs font-bold text-primary-600">{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-primary-200 dark:bg-primary-900/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Create folder inline */}
      {showCreateFolder && (
        <div className="flex items-center gap-2 rounded-lg border border-primary-300 dark:border-primary-700 bg-primary-50/30 dark:bg-primary-900/10 px-3 py-2">
          <FolderPlus className="h-4 w-4 text-primary-500 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowCreateFolder(false); setNewFolderName(''); } }}
            placeholder="Ordnername..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button onClick={handleCreateFolder} className="text-xs font-semibold text-primary-600">Erstellen</button>
          <button onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }} className="text-gray-400 hover:text-red-500">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayFolders.length === 0 && displayFiles.length === 0 && (
        <div className="py-16 text-center">
          <Folder className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            {isSearching ? 'Keine Ergebnisse' : 'Ordner ist leer'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSearching ? 'Versuche einen anderen Suchbegriff' : 'Erstelle einen Ordner oder lade Dateien hoch'}
          </p>
        </div>
      )}

      {/* GRID VIEW */}
      {!isLoading && viewMode === 'grid' && (
        <div className="space-y-4">
          {/* Folders */}
          {displayFolders.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Ordner</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                {displayFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => navigateToFolder(folder.id, folder.name)}
                    className="group relative flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] hover:shadow-md hover:border-primary-300 dark:hover:border-primary-500/40 transition-all text-center"
                  >
                    {folder.locked && (
                      <Lock className="absolute top-2 right-2 h-3 w-3 text-amber-500" />
                    )}
                    <Folder
                      className="h-10 w-10"
                      style={{ color: folder.color || '#6366f1' }}
                      fill={folder.color || '#6366f1'}
                      fillOpacity={0.15}
                    />
                    <span className="text-xs font-medium text-gray-900 dark:text-white truncate w-full">{folder.name}</span>
                    <span className="text-[10px] text-gray-400">{folder.childCount} Ordner · {folder.fileCount} Dateien</span>

                    {/* Quick actions on hover */}
                    <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFav.mutate({ folderId: folder.id }); }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-amber-500"
                      >
                        <Star className="h-3 w-3" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            folder.locked ? unlockFolder.mutate(folder.id) : lockFolder.mutate(folder.id);
                          }}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-amber-500"
                        >
                          {folder.locked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm(`"${folder.name}" in Papierkorb?`)) trashFolder.mutate(folder.id); }}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {displayFiles.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Dateien</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                {displayFiles.map((file) => (
                  <div
                    key={file.id}
                    className="group relative flex flex-col rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] hover:shadow-md hover:border-primary-300 dark:hover:border-primary-500/40 transition-all overflow-hidden"
                  >
                    {/* Preview / Icon */}
                    <div className="h-28 sm:h-36 bg-gray-50 dark:bg-white/[0.03] flex items-center justify-center overflow-hidden">
                      {file.fileType === 'image' ? (
                        <img src={file.fileUrl} alt={file.fileName} className="w-full h-full object-cover" />
                      ) : (
                        getFileIcon(file.fileType)
                      )}
                    </div>
                    <div className="p-2 sm:p-3 space-y-1">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{file.fileName}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        <span>{formatSize(file.fileSize)}</span>
                        <span>{formatDate(file.createdAt)}</span>
                      </div>
                      {file.status !== 'draft' && (
                        <span className={cn(
                          'inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                          file.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-500',
                        )}>
                          {file.status === 'approved' ? 'Freigegeben' : 'Archiviert'}
                        </span>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                      <a href={file.fileUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 rounded bg-black/40 text-white hover:bg-black/60">
                        <Eye className="h-3 w-3" />
                      </a>
                      <a href={file.fileUrl} download={file.fileName} onClick={(e) => e.stopPropagation()} className="p-1 rounded bg-black/40 text-white hover:bg-black/60">
                        <Download className="h-3 w-3" />
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm(`"${file.fileName}" in Papierkorb?`)) trashFile.mutate(file.id); }}
                        className="p-1 rounded bg-black/40 text-white hover:bg-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* LIST VIEW */}
      {!isLoading && viewMode === 'list' && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[1fr_6rem_6rem_6rem] gap-2 px-4 py-2 border-b border-gray-100 dark:border-white/5 text-[10px] font-bold text-gray-400 uppercase">
            <span>Name</span>
            <span>Größe</span>
            <span>Datum</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {displayFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => navigateToFolder(folder.id, folder.name)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors text-left"
              >
                <Folder className="h-5 w-5 flex-shrink-0" style={{ color: folder.color || '#6366f1' }} />
                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{folder.name}</span>
                {folder.locked && <Lock className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                <span className="text-xs text-gray-400 hidden sm:block w-24">{folder.childCount + folder.fileCount} Eintraege</span>
                <span className="text-xs text-gray-400 hidden sm:block w-24">{formatDate(folder.createdAt)}</span>
                <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
              </button>
            ))}
            {displayFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex-shrink-0">{getFileIcon(file.fileType)}</div>
                <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">{file.fileName}</span>
                <span className="text-xs text-gray-400 hidden sm:block w-24">{formatSize(file.fileSize)}</span>
                <span className="text-xs text-gray-400 hidden sm:block w-24">{formatDate(file.createdAt)}</span>
                <span className="text-xs text-gray-400 hidden sm:block w-24">{file.createdByName}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a href={file.fileUrl} target="_blank" rel="noreferrer" className="p-1 rounded text-gray-400 hover:text-primary-500">
                    <Eye className="h-3.5 w-3.5" />
                  </a>
                  <a href={file.fileUrl} download={file.fileName} className="p-1 rounded text-gray-400 hover:text-primary-500">
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => { if (confirm(`"${file.fileName}" in Papierkorb?`)) trashFile.mutate(file.id); }}
                    className="p-1 rounded text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
