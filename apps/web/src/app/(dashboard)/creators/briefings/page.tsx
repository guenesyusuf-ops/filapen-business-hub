'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  FileText,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBriefings, useCreateBriefing } from '@/hooks/creators/useBriefings';
import type { Briefing } from '@/hooks/creators/useBriefings';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRIEFING_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-50 text-gray-600 border-gray-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  revision: 'bg-amber-50 text-amber-700 border-amber-200',
};

// ---------------------------------------------------------------------------
// Create Briefing Modal
// ---------------------------------------------------------------------------

function CreateBriefingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createMutation = useCreateBriefing();
  const [form, setForm] = useState({
    title: '',
    dealId: '',
    content: '',
    objectives: '',
    keyMessages: '',
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      createMutation.mutate(
        {
          title: form.title,
          dealId: form.dealId,
          content: form.content,
          objectives: form.objectives
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          keyMessages: form.keyMessages
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          status: 'draft',
        },
        {
          onSuccess: () => {
            onClose();
            setForm({ title: '', dealId: '', content: '', objectives: '', keyMessages: '' });
          },
        },
      );
    },
    [createMutation, form, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-dropdown w-full max-w-lg mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-gray-900">Create Briefing</h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-surface-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator"
              placeholder="Briefing title"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Content / Overview</label>
            <textarea
              required
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator resize-none"
              placeholder="Describe the campaign brief..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Objectives <span className="text-gray-400 font-normal">(one per line)</span>
            </label>
            <textarea
              value={form.objectives}
              onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator resize-none"
              placeholder="Drive brand awareness&#10;Generate 50K impressions"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Key Messages <span className="text-gray-400 font-normal">(one per line)</span>
            </label>
            <textarea
              value={form.keyMessages}
              onChange={(e) => setForm((f) => ({ ...f, keyMessages: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator resize-none"
              placeholder="Sustainable materials&#10;Limited edition"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-accent-creator px-4 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Briefing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function BriefingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dealId = searchParams.get('dealId') ?? undefined;
  const [showModal, setShowModal] = useState(false);

  const { data: briefings, isLoading, isError } = useBriefings(dealId);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Briefings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Campaign briefs and content guidelines
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-creator px-3 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Briefing
        </button>
      </div>

      {/* Error banner */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load briefings. Showing cached data.
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="h-8 w-8 rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 rounded bg-gray-200" />
                  <div className="h-2.5 w-32 rounded bg-gray-100" />
                </div>
                <div className="h-5 w-16 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : !briefings || briefings.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900 mb-1">No briefings yet</p>
            <p className="text-xs text-gray-500 mb-4">
              Create your first campaign briefing
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-creator px-3 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Briefing
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deal
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Creator
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {briefings.map((briefing) => (
                  <tr
                    key={briefing.id}
                    className="hover:bg-surface-secondary transition-colors cursor-pointer"
                    onClick={() => {
                      /* Future: navigate to briefing detail */
                    }}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-accent-creator-light text-accent-creator shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-gray-900">{briefing.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{briefing.dealTitle}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{briefing.creatorName}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
                          BRIEFING_STATUS_STYLES[briefing.status] ?? BRIEFING_STATUS_STYLES.draft,
                        )}
                      >
                        {briefing.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">
                      {new Date(briefing.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Briefing Modal */}
      <CreateBriefingModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
