'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Image,
  Video,
  FileText,
  Link2,
  Play,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAllUploads,
  UPLOAD_TABS,
  UPLOAD_TAB_LABELS,
} from '@/hooks/creators/useUploads';
import type { UploadTab, CreatorUpload } from '@/hooks/creators/useUploads';
import { Lightbox } from '@/components/creators/Lightbox';

// ---------------------------------------------------------------------------
// All Uploads Page
// ---------------------------------------------------------------------------

export default function AllUploadsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<UploadTab | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [lightboxUpload, setLightboxUpload] = useState<CreatorUpload | null>(null);

  const { data, isLoading } = useAllUploads({ tab, page, pageSize: 24 });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">All Uploads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Browse uploads from all creators
          </p>
        </div>
      </div>

      {/* Tab filter */}
      <div className="flex gap-2">
        <button
          onClick={() => { setTab(undefined); setPage(1); }}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            !tab
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          All
        </button>
        {UPLOAD_TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {UPLOAD_TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Grid */}
      {!isLoading && data && (
        <>
          {data.items.length === 0 ? (
            <div className="text-center py-16">
              <Upload className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No uploads found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {data.items.map((upload) => (
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
                    <p className="text-[10px] text-white/90 truncate">{upload.fileName}</p>
                    {upload.creator && (
                      <p className="text-[10px] text-white/70 truncate">{upload.creator.name}</p>
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
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                disabled={page === data.totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next
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
