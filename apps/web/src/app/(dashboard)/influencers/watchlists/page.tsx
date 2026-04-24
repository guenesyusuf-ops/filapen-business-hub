'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Plus,
  Clock,
  ListChecks,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWatchlists, useCreateWatchlist } from '@/hooks/influencers/useWatchlists';

// ---------------------------------------------------------------------------
// Create Watchlist Modal
// ---------------------------------------------------------------------------

function CreateWatchlistModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createMutation = useCreateWatchlist();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      createMutation.mutate(
        { name: name.trim(), description: description.trim() || undefined },
        { onSuccess: onClose },
      );
    },
    [name, description, createMutation, onClose],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Watchlist</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Campaign 2026"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this watchlist for?"
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Watchlist'}
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

export default function WatchlistsPage() {
  const router = useRouter();
  const { data: watchlists, isLoading, isError } = useWatchlists();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">Watchlists</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track groups of influencers for campaigns and outreach
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-2 text-sm font-medium text-white hover:bg-pink-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Watchlist
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load watchlists. Please try again.
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-5 shadow-card animate-pulse">
              <div className="h-4 w-32 rounded bg-gray-200 mb-2" />
              <div className="h-3 w-48 rounded bg-gray-100 mb-4" />
              <div className="h-3 w-20 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      )}

      {/* Watchlist cards */}
      {!isLoading && watchlists && (
        <>
          {watchlists.length === 0 ? (
            <div className="text-center py-16">
              <ListChecks className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No watchlists yet</h3>
              <p className="text-xs text-gray-500 mb-4">
                Create your first watchlist to start tracking influencers
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-2 text-sm font-medium text-white hover:bg-pink-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Watchlist
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchlists.map((wl) => (
                <button
                  key={wl.id}
                  onClick={() => router.push(`/influencers/watchlists/${wl.id}`)}
                  className="group text-left rounded-xl bg-white p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all border-t-2 border-pink-400"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-pink-600 transition-colors">
                      {wl.name}
                    </h3>
                    <Eye className="h-4 w-4 text-gray-400 group-hover:text-pink-500 transition-colors shrink-0" />
                  </div>
                  {wl.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                      {wl.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {wl.itemCount} influencer{wl.itemCount !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(wl.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreate && <CreateWatchlistModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
