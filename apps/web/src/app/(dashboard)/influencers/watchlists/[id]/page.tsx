'use client';

import { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Heart,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@filapen/shared/src/utils/money';
import { useWatchlist, useRemoveFromWatchlist } from '@/hooks/influencers/useWatchlists';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E4405F',
  tiktok: '#000000',
  youtube: '#FF0000',
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WatchlistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: watchlist, isLoading, isError } = useWatchlist(id);
  const removeMutation = useRemoveFromWatchlist();

  const handleRemove = useCallback(
    (influencerId: string) => {
      if (!confirm('Remove this influencer from the watchlist?')) return;
      removeMutation.mutate({ watchlistId: id, influencerProfileId: influencerId });
    },
    [id, removeMutation],
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" />
        <div className="rounded-xl bg-white p-6 shadow-card animate-pulse">
          <div className="h-5 w-48 rounded bg-gray-200 mb-2" />
          <div className="h-3 w-64 rounded bg-gray-100" />
        </div>
        <div className="rounded-xl bg-white shadow-card animate-pulse">
          <div className="h-64 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (isError || !watchlist) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Watchlist not found</h2>
        <button
          onClick={() => router.push('/influencers/watchlists')}
          className="text-sm text-pink-600 hover:text-pink-700"
        >
          Back to Watchlists
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => router.push('/influencers/watchlists')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Watchlists
      </button>

      {/* Header */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden border-t-2 border-pink-400">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">{watchlist.name}</h1>
          {watchlist.description && (
            <p className="text-sm text-gray-500">{watchlist.description}</p>
          )}
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
            <Users className="h-3 w-3" />
            <span>{watchlist.items.length} influencer{watchlist.items.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Influencer Table */}
      {watchlist.items.length === 0 ? (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">No influencers yet</h3>
          <p className="text-xs text-gray-500 mb-4">
            Add influencers from the Discovery page
          </p>
          <button
            onClick={() => router.push('/influencers/discovery')}
            className="text-sm text-pink-600 hover:text-pink-700"
          >
            Go to Discovery
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left font-medium px-5 py-3">Influencer</th>
                  <th className="text-left font-medium px-3 py-3">Platform</th>
                  <th className="text-left font-medium px-3 py-3">Niche</th>
                  <th className="text-right font-medium px-3 py-3">Followers</th>
                  <th className="text-right font-medium px-3 py-3">Engagement</th>
                  <th className="text-right font-medium px-3 py-3">Score</th>
                  <th className="text-right font-medium px-3 py-3">Added</th>
                  <th className="text-center font-medium px-3 py-3 w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {watchlist.items.map((item) => (
                  <tr key={item.id} className="hover:bg-pink-50/30 transition-colors">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => router.push(`/influencers/discovery/${item.influencer.id}`)}
                        className="flex items-center gap-3 text-left hover:text-pink-600 transition-colors"
                      >
                        <div className="h-8 w-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-semibold shrink-0">
                          {item.influencer.displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-1">
                            {item.influencer.displayName}
                            {item.influencer.isVerified && (
                              <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-blue-500 text-white text-[8px]">
                                &#10003;
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">@{item.influencer.handle}</div>
                        </div>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: PLATFORM_COLORS[item.influencer.platform] ?? '#9CA3AF' }}
                      >
                        {PLATFORM_LABELS[item.influencer.platform] ?? item.influencer.platform}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{item.influencer.niche ?? '-'}</td>
                    <td className="px-3 py-3 text-right font-medium text-gray-900">
                      {formatNumber(item.influencer.followerCount)}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      {item.influencer.engagementRate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold',
                          item.influencer.score >= 80
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.influencer.score >= 60
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {item.influencer.score}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-gray-500">
                      {new Date(item.addedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleRemove(item.influencer.id)}
                        disabled={removeMutation.isPending}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
