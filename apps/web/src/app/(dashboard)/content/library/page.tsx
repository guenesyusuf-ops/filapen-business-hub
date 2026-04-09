'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Star,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  Wand2,
  Copy,
  Trash2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useContentList,
  useCreateContent,
  useDeleteContent,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_COLORS,
  PLATFORMS,
  PLATFORM_LABELS,
} from '@/hooks/content/useContent';
import type { ContentPiece, ContentListParams } from '@/hooks/content/useContent';

// ---------------------------------------------------------------------------
// Create Modal
// ---------------------------------------------------------------------------

function CreateContentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createMutation = useCreateContent();
  const [form, setForm] = useState({
    type: 'headline',
    title: '',
    body: '',
    platform: '',
    campaign: '',
    tags: '',
  });

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    await createMutation.mutateAsync({
      type: form.type,
      title: form.title,
      body: form.body,
      platform: form.platform || undefined,
      campaign: form.campaign || undefined,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [],
      status: 'draft',
    } as any);
    onClose();
    setForm({ type: 'headline', title: '', body: '', platform: '', campaign: '', tags: '' });
  }, [form, createMutation, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-dropdown w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Create Content</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CONTENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Give your content a title..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={5}
              placeholder="Write your content..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
              >
                <option value="">Select platform</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Campaign</label>
              <input
                type="text"
                value={form.campaign}
                onChange={(e) => setForm({ ...form, campaign: e.target.value })}
                placeholder="Campaign name"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="spring, hero, retargeting"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !form.title.trim() || !form.body.trim()}
            className="rounded-lg bg-accent-content px-4 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content Card
// ---------------------------------------------------------------------------

function ContentCard({ piece }: { piece: ContentPiece }) {
  const deleteMutation = useDeleteContent();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(piece.body);
  }, [piece.body]);

  return (
    <div className="rounded-xl bg-white p-4 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-medium',
              CONTENT_TYPE_COLORS[piece.type] ?? 'bg-gray-100 text-gray-600',
            )}
          >
            {CONTENT_TYPE_LABELS[piece.type] ?? piece.type}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-medium',
              CONTENT_STATUS_COLORS[piece.status] ?? 'bg-gray-100 text-gray-600',
            )}
          >
            {CONTENT_STATUS_LABELS[piece.status] ?? piece.status}
          </span>
          {piece.aiGenerated && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-2 py-0.5 text-xxs font-medium text-purple-600">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          )}
        </div>
        {piece.platform && (
          <span className="text-xxs text-gray-400 uppercase tracking-wider shrink-0">
            {PLATFORM_LABELS[piece.platform] ?? piece.platform}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-gray-900 mb-1.5 line-clamp-1">{piece.title}</h4>

      {/* Body preview */}
      <p className="text-xs text-gray-500 line-clamp-3 mb-3 leading-relaxed whitespace-pre-line">
        {piece.body}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Rating stars */}
          {piece.rating ? (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-3 w-3',
                    i < piece.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200',
                  )}
                />
              ))}
            </div>
          ) : (
            <span className="text-xxs text-gray-300">No rating</span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => deleteMutation.mutate(piece.id)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tags */}
      {piece.tags.length > 0 && (
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {piece.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-xxs text-gray-500"
            >
              {tag}
            </span>
          ))}
          {piece.tags.length > 3 && (
            <span className="text-xxs text-gray-400">+{piece.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Date */}
      <div className="text-xxs text-gray-400 mt-2">
        {new Date(piece.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
        {piece.campaign && (
          <>
            {' '}
            &middot; <span className="text-accent-content">{piece.campaign}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ContentLibraryPage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [params, setParams] = useState<ContentListParams>({
    page: 1,
    pageSize: 24,
  });
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ai' | 'manual'>('all');

  const contentQuery = useContentList({
    ...params,
    search: search || undefined,
    aiGenerated: sourceFilter === 'ai' ? true : sourceFilter === 'manual' ? false : undefined,
  });

  const items = contentQuery.data?.items ?? [];
  const total = contentQuery.data?.total ?? 0;
  const currentPage = contentQuery.data?.page ?? 1;
  const totalPages = contentQuery.data?.totalPages ?? 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <CreateContentModal open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Content Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} piece{total !== 1 ? 's' : ''} of content
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/content/generate')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Generate
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-content px-3 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Content
          </button>
        </div>
      </div>

      {/* Explanation */}
      <div className="flex items-start gap-2 rounded-lg bg-surface-secondary border border-border p-3">
        <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 leading-relaxed">
          Your Content Library stores all generated and manually created content pieces.
          Use the filters below to browse by type, status, or source. Click any piece to view its full content and generation context.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setParams((p) => ({ ...p, page: 1 }));
            }}
            placeholder="Search content..."
            className="w-full rounded-lg border border-border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
          />
        </div>
        <select
          value={params.type ?? 'all'}
          onChange={(e) =>
            setParams((p) => ({ ...p, type: e.target.value === 'all' ? undefined : e.target.value, page: 1 }))
          }
          className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-content/30"
        >
          <option value="all">All Types</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={params.status ?? 'all'}
          onChange={(e) =>
            setParams((p) => ({ ...p, status: e.target.value === 'all' ? undefined : e.target.value, page: 1 }))
          }
          className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-content/30"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="in_review">In Review</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={params.platform ?? 'all'}
          onChange={(e) =>
            setParams((p) => ({
              ...p,
              platform: e.target.value === 'all' ? undefined : e.target.value,
              page: 1,
            }))
          }
          className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-content/30"
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value as 'all' | 'ai' | 'manual');
            setParams((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-content/30"
        >
          <option value="all">All Sources</option>
          <option value="ai">AI Generated</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Loading */}
      {contentQuery.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-4 shadow-card animate-pulse">
              <div className="flex gap-2 mb-3">
                <div className="h-5 w-16 rounded-full bg-gray-200" />
                <div className="h-5 w-14 rounded-full bg-gray-200" />
              </div>
              <div className="h-4 w-48 rounded bg-gray-200 mb-2" />
              <div className="h-3 w-full rounded bg-gray-100 mb-1" />
              <div className="h-3 w-3/4 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      )}

      {/* Content Grid */}
      {!contentQuery.isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((piece) => (
            <ContentCard key={piece.id} piece={piece} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!contentQuery.isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-full bg-accent-content-light text-accent-content mb-4">
            <Wand2 className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No content found</h3>
          <p className="text-sm text-gray-500 mb-4">
            Try adjusting your filters or generate new content.
          </p>
          <button
            onClick={() => router.push('/content/generate')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-content px-4 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Generate Content
          </button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setParams((p) => ({ ...p, page: currentPage - 1 }))}
              className="rounded-lg border border-border p-2 text-sm disabled:opacity-40 hover:bg-surface-secondary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setParams((p) => ({ ...p, page: currentPage + 1 }))}
              className="rounded-lg border border-border p-2 text-sm disabled:opacity-40 hover:bg-surface-secondary transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
