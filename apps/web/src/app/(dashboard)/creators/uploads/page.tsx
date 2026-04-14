'use client';

import { useState } from 'react';
import {
  Upload,
  Image,
  Video,
  FileText,
  Link2,
  Play,
  MessageCircle,
  Folder,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAllUploads,
  useUploadFolders,
  UPLOAD_TABS,
  UPLOAD_TAB_LABELS,
} from '@/hooks/creators/useUploads';
import type { UploadTab, CreatorUpload, UploadFolder } from '@/hooks/creators/useUploads';
import { Lightbox } from '@/components/creators/Lightbox';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Folder Card
// ---------------------------------------------------------------------------

function FolderCard({
  folder,
  onClick,
}: {
  folder: UploadFolder;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all bg-white"
    >
      {/* Preview */}
      <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
        {folder.previewUrl ? (
          <img
            src={folder.previewUrl}
            alt={folder.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <Folder className="h-12 w-12 text-gray-300" />
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 text-left">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Folder className="h-3.5 w-3.5 text-purple-500 shrink-0" />
          <p className="text-sm font-medium text-gray-900 truncate">
            {folder.name}
          </p>
        </div>
        <p className="text-xs text-gray-500">
          {folder.fileCount} {folder.fileCount === 1 ? 'Datei' : 'Dateien'}
        </p>
        <p className="text-xs text-gray-400">{formatDate(folder.createdAt)}</p>
        {folder.creatorName && (
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {folder.creatorName}
          </p>
        )}
      </div>

      {/* Unseen badge */}
      {folder.unseenCount > 0 && (
        <div className="absolute top-2 right-2 flex items-center justify-center min-w-[20px] h-5 rounded-full bg-purple-500 px-1.5">
          <span className="text-[10px] font-bold text-white">
            {folder.unseenCount}
          </span>
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// All Uploads Page
// ---------------------------------------------------------------------------

export default function AllUploadsPage() {
  const [tab, setTab] = useState<UploadTab | undefined>(undefined);
  const [activeBatch, setActiveBatch] = useState<string | null>(null);
  const [activeBatchName, setActiveBatchName] = useState<string>('');
  const [page, setPage] = useState(1);
  const [lightboxUpload, setLightboxUpload] = useState<CreatorUpload | null>(
    null,
  );

  // Folder list (first level)
  const { data: foldersData, isLoading: foldersLoading } = useUploadFolders({
    tab,
  });
  const folders = foldersData?.folders;
  const tabCounts = foldersData?.tabCounts;
  const totalUploads = foldersData?.total ?? 0;

  // Files inside a batch (second level)
  const { data: filesData, isLoading: filesLoading } = useAllUploads({
    tab,
    batch: activeBatch ?? undefined,
    page,
    pageSize: 24,
  });

  const showFolders = activeBatch === null;
  const isLoading = showFolders ? foldersLoading : filesLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {showFolders ? (
            <>
              <h1 className="text-xl font-semibold text-gray-900">
                Alle Uploads
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Ordner aller Creator durchsuchen
              </p>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveBatch(null);
                  setActiveBatchName('');
                  setPage(1);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Zurueck
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {activeBatchName}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {filesData?.total ?? 0} Dateien in diesem Ordner
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab filter with counts */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            setTab(undefined);
            setPage(1);
            setActiveBatch(null);
          }}
          className={cn(
            'relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            !tab
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10',
          )}
        >
          Alle
          {totalUploads > 0 && (
            <span className={cn(
              'ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold min-w-[18px]',
              !tab ? 'bg-white/20 text-white' : 'bg-red-500 text-white',
            )}>
              {totalUploads}
            </span>
          )}
        </button>
        {UPLOAD_TABS.map((t) => {
          const count = tabCounts?.[t] ?? 0;
          return (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setPage(1);
                setActiveBatch(null);
              }}
              className={cn(
                'relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10',
              )}
            >
              {UPLOAD_TAB_LABELS[t]}
              {count > 0 && (
                <span className={cn(
                  'ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold min-w-[18px]',
                  tab === t ? 'bg-white/20 text-white' : 'bg-red-500 text-white',
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ============================================================= */}
      {/* FOLDER VIEW (first level) */}
      {/* ============================================================= */}
      {!isLoading && showFolders && folders && (
        <>
          {folders.length === 0 ? (
            <div className="text-center py-16">
              <Upload className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Keine Uploads vorhanden</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {folders.map((folder) => (
                <FolderCard
                  key={folder.batch}
                  folder={folder}
                  onClick={() => {
                    setActiveBatch(folder.batch);
                    setActiveBatchName(folder.name);
                    setPage(1);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ============================================================= */}
      {/* FILE VIEW (second level — inside a folder) */}
      {/* ============================================================= */}
      {!isLoading && !showFolders && filesData && (
        <>
          {filesData.items.length === 0 ? (
            <div className="text-center py-16">
              <Upload className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Keine Dateien in diesem Ordner
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filesData.items.map((upload) => (
                <button
                  key={upload.id}
                  onClick={() => setLightboxUpload(upload)}
                  className="group relative aspect-square rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all bg-gray-50"
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

                  {/* Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white/90 truncate">
                      {upload.fileName}
                    </p>
                    {upload.creator && (
                      <p className="text-[10px] text-white/70 truncate">
                        {upload.creator.name}
                      </p>
                    )}
                    {upload.commentCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-white/80 mt-0.5">
                        <MessageCircle className="h-2.5 w-2.5" />
                        {upload.commentCount}
                      </span>
                    )}
                  </div>

                  {/* Unseen badge */}
                  {!upload.seenByAdmin && (
                    <div className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-purple-500" />
                  )}

                  {/* Tab badge */}
                  <div className="absolute top-2 left-2">
                    <span className="rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white uppercase">
                      {upload.tab}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {filesData.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Zurueck
              </button>
              <span className="text-sm text-gray-500">
                Seite {page} von {filesData.totalPages}
              </span>
              <button
                onClick={() =>
                  setPage(Math.min(filesData.totalPages, page + 1))
                }
                disabled={page === filesData.totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Weiter
              </button>
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightboxUpload && (
        <Lightbox
          upload={lightboxUpload}
          onClose={() => setLightboxUpload(null)}
          authorName="Admin"
          authorRole="admin"
        />
      )}
    </div>
  );
}
