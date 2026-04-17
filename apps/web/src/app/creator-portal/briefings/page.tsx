'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  ArrowLeft,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Video,
  File,
  Paperclip,
} from 'lucide-react';
import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BriefingAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  createdAt: string;
}

interface BriefingProduct {
  id: string;
  title: string;
  imageUrl?: string;
}

interface PortalBriefing {
  id: string;
  title: string;
  notes?: string;
  content?: string;
  product?: BriefingProduct | null;
  attachmentCount?: number;
  attachments?: BriefingAttachment[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileTypeIcon(fileType: string) {
  switch (fileType) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-red-500" />;
    case 'image':
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    case 'video':
      return <Video className="h-5 w-5 text-purple-500" />;
    default:
      return <File className="h-5 w-5 text-gray-400" />;
  }
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Folder Detail View
// ---------------------------------------------------------------------------

function BriefingFolder({
  briefing,
  onBack,
}: {
  briefing: PortalBriefing;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<PortalBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/briefings/${briefing.id}`);
        if (res.ok) {
          const data = await res.json();
          setDetail(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [briefing.id]);

  const attachments = detail?.attachments ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zu Briefings
      </button>

      {/* Header */}
      <div className="rounded-xl bg-white border border-gray-100 p-5">
        <div className="flex items-start gap-4">
          {briefing.product?.imageUrl ? (
            <img
              src={briefing.product.imageUrl}
              alt={briefing.product.title}
              className="h-16 w-16 rounded-lg object-cover border border-gray-100"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-violet-50 flex items-center justify-center">
              <FolderOpen className="h-6 w-6 text-violet-400" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{briefing.title}</h2>
            {briefing.product && (
              <p className="text-sm text-gray-500">{briefing.product.title}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(briefing.createdAt).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {(detail?.notes || detail?.content) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {detail.notes || detail.content}
            </p>
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="rounded-xl bg-white border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/50">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Dateien ({loading ? '...' : attachments.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-12">
            <Paperclip className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Keine Dateien vorhanden</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                {/* Thumbnail or icon */}
                {att.fileType === 'image' ? (
                  <button
                    onClick={() => setLightboxUrl(att.fileUrl)}
                    className="h-12 w-12 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-violet-300 transition-all"
                  >
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : att.fileType === 'video' ? (
                  <div className="h-12 w-12 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Video className="h-5 w-5 text-purple-500" />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                    {fileTypeIcon(att.fileType)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{att.fileName}</p>
                  <p className="text-xs text-gray-400">
                    {att.fileType.toUpperCase()}
                    {att.fileSize ? ` - ${formatFileSize(att.fileSize)}` : ''}
                  </p>
                </div>

                {/* Video inline player */}
                {att.fileType === 'video' && (
                  <video
                    src={att.fileUrl}
                    controls
                    className="h-20 rounded-lg"
                    preload="metadata"
                  />
                )}

                <a
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex-shrink-0"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Image Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-full max-h-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page (Folder Grid)
// ---------------------------------------------------------------------------

export default function PortalBriefingsPage() {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [briefings, setBriefings] = useState<PortalBriefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBriefing, setSelectedBriefing] = useState<PortalBriefing | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('creator_data');
    if (stored) {
      try {
        const c = JSON.parse(stored);
        setCreatorId(c.id);
      } catch {
        router.push('/creator-portal');
      }
    } else {
      router.push('/creator-portal');
    }
  }, [router]);

  useEffect(() => {
    if (!creatorId) return;
    async function fetchBriefings() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/briefings/for-creator`);
        if (res.ok) {
          const data = await res.json();
          setBriefings(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchBriefings();
  }, [creatorId]);

  if (!creatorId) return null;

  // Detail view
  if (selectedBriefing) {
    return (
      <BriefingFolder
        briefing={selectedBriefing}
        onBack={() => setSelectedBriefing(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Briefings / Skripte</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Briefings und Dateien fuer deine Projekte
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-4 border border-gray-100 animate-pulse">
              <div className="h-28 bg-gray-200 rounded-lg mb-3" />
              <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : briefings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">Noch keine Briefings</p>
          <p className="text-xs text-gray-500">
            Briefings werden hier erscheinen, sobald sie erstellt werden
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {briefings.map((briefing) => (
            <button
              key={briefing.id}
              onClick={() => setSelectedBriefing(briefing)}
              className="rounded-xl bg-white border border-gray-100 overflow-hidden text-left hover:shadow-md hover:border-violet-200 transition-all group"
            >
              {/* Product image as folder preview */}
              <div className="h-32 bg-gray-50 flex items-center justify-center overflow-hidden">
                {briefing.product?.imageUrl ? (
                  <img
                    src={briefing.product.imageUrl}
                    alt={briefing.product?.title ?? ''}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <FolderOpen className="h-10 w-10 text-gray-200 group-hover:text-violet-300 transition-colors" />
                )}
              </div>

              {/* Folder info */}
              <div className="p-4">
                {briefing.product && (
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide truncate">
                    {briefing.product.title}
                  </p>
                )}
                <h3 className="text-sm font-medium text-gray-900 mt-0.5 truncate">
                  {briefing.title}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <Paperclip className="h-3 w-3" />
                    {briefing.attachmentCount ?? 0} Dateien
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(briefing.createdAt).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
