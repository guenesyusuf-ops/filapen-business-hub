'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Camera,
  Music,
  Play,
  X,
  UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDollars, formatNumber } from '@filapen/shared/src/utils/money';
import { useCreators, useCreateCreator } from '@/hooks/creators/useCreators';
import type { Creator, CreatorsListParams } from '@/hooks/creators/useCreators';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ['all', 'active', 'prospect', 'outreach', 'inactive'] as const;
const NICHE_OPTIONS = ['all', 'Lifestyle', 'Fitness', 'Food', 'Tech', 'Beauty', 'Travel', 'Fashion', 'Gaming'] as const;
const PLATFORM_OPTIONS = ['all', 'instagram', 'tiktok', 'youtube', 'twitter'] as const;

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  prospect: 'bg-blue-50 text-blue-700 border-blue-200',
  outreach: 'bg-purple-50 text-purple-700 border-purple-200',
  inactive: 'bg-gray-50 text-gray-500 border-gray-200',
};

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case 'instagram':
      return <Camera className="h-3.5 w-3.5 text-pink-500" />;
    case 'tiktok':
      return <Music className="h-3.5 w-3.5 text-gray-800" />;
    case 'youtube':
      return <Play className="h-3.5 w-3.5 text-red-500" />;
    default:
      return <UserCircle className="h-3.5 w-3.5 text-blue-400" />;
  }
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Add Creator Modal
// ---------------------------------------------------------------------------

function AddCreatorModal({ open, onClose }: { open: boolean; onClose: () => void; }) {
  const router = useRouter();
  const createMutation = useCreateCreator();
  const [form, setForm] = useState({
    name: '',
    firstContact: '' as string,
    email: '',
    platform: 'instagram' as Creator['platform'],
    niche: '',
    status: 'prospect' as Creator['status'],
    // New fields
    age: '',
    gender: '',
    country: '',
    instagramHandle: '',
    tiktokHandle: '',
    youtubeHandle: '',
    compensation: 'Commission',
    commissionRate: '',
    fixAmount: '',
    kids: false,
    kidsAges: '',
    kidsOnVideo: false,
    notes: '',
    creatorNotes: '',
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const payload: any = {
        name: form.name,
        firstContact: form.firstContact || undefined,
        email: form.email,
        platform: form.platform,
        niche: form.niche,
        status: form.status,
        compensation: form.compensation,
        provision: form.commissionRate || undefined,
        fixAmount: form.fixAmount ? parseFloat(form.fixAmount) : undefined,
        kids: form.kids,
        kidsAges: form.kids ? form.kidsAges : undefined,
        kidsOnVideo: form.kids ? form.kidsOnVideo : undefined,
        notes: form.notes || undefined,
        creatorNotes: form.creatorNotes || undefined,
        location: form.country || undefined,
        contracts: {
          age: form.age || undefined,
          gender: form.gender || undefined,
          instagramHandle: form.instagramHandle || undefined,
          tiktokHandle: form.tiktokHandle || undefined,
          youtubeHandle: form.youtubeHandle || undefined,
        },
      };
      createMutation.mutate(payload, {
        onSuccess: (newCreator: any) => {
          onClose();
          setForm({
            name: '', firstContact: '', email: '', platform: 'instagram', niche: '', status: 'prospect',
            age: '', gender: '', country: '', instagramHandle: '', tiktokHandle: '', youtubeHandle: '',
            compensation: 'Commission', commissionRate: '', fixAmount: '',
            kids: false, kidsAges: '', kidsOnVideo: false, notes: '', creatorNotes: '',
          });
          // Navigate to the new creator's profile page
          if (newCreator?.id) {
            router.push(`/creators/list/${newCreator.id}`);
          }
        },
      });
    },
    [createMutation, form, onClose],
  );

  if (!open) return null;

  const inputCls = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator';
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1';
  const sectionCls = 'text-xxs font-semibold text-gray-400 uppercase tracking-wider pt-3 pb-1 border-t border-border';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-dropdown w-full max-w-lg mx-4 animate-slide-up max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Add Creator</h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-surface-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3 overflow-y-auto flex-1">
          {/* Basic Info */}
          <div>
            <label className={labelCls}>Name</label>
            <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Creator name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Erstkontakt</label>
              <select value={form.firstContact} onChange={(e) => setForm((f) => ({ ...f, firstContact: e.target.value }))} className={inputCls}>
                <option value="">Bitte ausw&auml;hlen</option>
                <option value="Email">Email</option>
                <option value="Meta Ads">Meta Ads</option>
                <option value="Empfehlung">Empfehlung</option>
                <option value="Sonstige">Sonstige</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Primary Platform</label>
              <select value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as Creator['platform'] }))} className={inputCls}>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="twitter">Twitter</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="creator@email.com" />
          </div>

          {/* Demographics */}
          <p className={sectionCls}>Demographics</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Age</label>
              <input type="text" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} className={inputCls} placeholder="e.g. 28" />
            </div>
            <div>
              <label className={labelCls}>Gender</label>
              <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} className={inputCls}>
                <option value="">Select</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-Binary">Non-Binary</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input type="text" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={inputCls} placeholder="e.g. Germany" />
            </div>
          </div>

          {/* Social Handles */}
          <p className={sectionCls}>Social Handles</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Instagram</label>
              <input type="text" value={form.instagramHandle} onChange={(e) => setForm((f) => ({ ...f, instagramHandle: e.target.value }))} className={inputCls} placeholder="@handle" />
            </div>
            <div>
              <label className={labelCls}>TikTok</label>
              <input type="text" value={form.tiktokHandle} onChange={(e) => setForm((f) => ({ ...f, tiktokHandle: e.target.value }))} className={inputCls} placeholder="@handle" />
            </div>
            <div>
              <label className={labelCls}>YouTube</label>
              <input type="text" value={form.youtubeHandle} onChange={(e) => setForm((f) => ({ ...f, youtubeHandle: e.target.value }))} className={inputCls} placeholder="@channel" />
            </div>
          </div>

          {/* Content & Status */}
          <p className={sectionCls}>Content & Status</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Content Niche</label>
              <select value={form.niche} onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))} className={inputCls}>
                <option value="">Select niche</option>
                <option value="Beauty">Beauty</option>
                <option value="Fitness">Fitness</option>
                <option value="Tech">Tech</option>
                <option value="Fashion">Fashion</option>
                <option value="Food">Food</option>
                <option value="Travel">Travel</option>
                <option value="Gaming">Gaming</option>
                <option value="Lifestyle">Lifestyle</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Creator['status'] }))} className={inputCls}>
                <option value="prospect">Prospect</option>
                <option value="outreach">Outreach</option>
                <option value="active">Active</option>
              </select>
            </div>
          </div>

          {/* Compensation */}
          <p className={sectionCls}>Compensation</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Model</label>
              <select value={form.compensation} onChange={(e) => setForm((f) => ({ ...f, compensation: e.target.value }))} className={inputCls}>
                <option value="Commission">Commission</option>
                <option value="Fixed">Fixed</option>
                <option value="Both">Both</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Commission (%)</label>
              <input type="text" value={form.commissionRate} onChange={(e) => setForm((f) => ({ ...f, commissionRate: e.target.value }))} className={inputCls} placeholder="e.g. 15" disabled={form.compensation === 'Fixed'} />
            </div>
            <div>
              <label className={labelCls}>Fixed Amount</label>
              <input type="number" value={form.fixAmount} onChange={(e) => setForm((f) => ({ ...f, fixAmount: e.target.value }))} className={inputCls} placeholder="e.g. 500" disabled={form.compensation === 'Commission'} />
            </div>
          </div>

          {/* Kids */}
          <p className={sectionCls}>Family</p>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.kids} onChange={(e) => setForm((f) => ({ ...f, kids: e.target.checked }))} className="rounded border-border text-accent-creator focus:ring-accent-creator/30" />
              Has Kids
            </label>
            {form.kids && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.kidsOnVideo} onChange={(e) => setForm((f) => ({ ...f, kidsOnVideo: e.target.checked }))} className="rounded border-border text-accent-creator focus:ring-accent-creator/30" />
                Kids on Video
              </label>
            )}
          </div>
          {form.kids && (
            <div>
              <label className={labelCls}>Kids Ages</label>
              <input type="text" value={form.kidsAges} onChange={(e) => setForm((f) => ({ ...f, kidsAges: e.target.value }))} className={inputCls} placeholder="e.g. 3, 7" />
            </div>
          )}

          {/* Notes */}
          <p className={sectionCls}>Notes</p>
          <div>
            <label className={labelCls}>Admin Notes (internal only)</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls + ' resize-none'} placeholder="Internal notes about this creator..." />
          </div>
          <div>
            <label className={labelCls}>Creator Notes (visible to creator)</label>
            <textarea value={form.creatorNotes} onChange={(e) => setForm((f) => ({ ...f, creatorNotes: e.target.value }))} rows={2} className={inputCls + ' resize-none'} placeholder="Notes visible to the creator..." />
          </div>

          <div className="flex justify-end gap-2 pt-3">
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
              {createMutation.isPending ? 'Adding...' : 'Add Creator'}
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
// InviteCreatorModal removed — invite functionality moved to creator detail page

function CreatorListPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [niche, setNiche] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(searchParams.get('action') === 'add');

  const params: CreatorsListParams = useMemo(
    () => ({ search, status, niche, platform, sortBy, sortOrder, page, pageSize: 25 }),
    [search, status, niche, platform, sortBy, sortOrder, page],
  );

  const { data, isLoading, isError } = useCreators(params);

  const handleSort = useCallback(
    (col: string) => {
      if (sortBy === col) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(col);
        setSortOrder('asc');
      }
    },
    [sortBy],
  );

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  const creators = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Creators</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} creator${data.total !== 1 ? 's' : ''}` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-creator px-3 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Creator
          </button>
        </div>
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
              setPage(1);
            }}
            placeholder="Search by name, handle, or email..."
            className="w-full rounded-lg border border-border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-creator/30"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={niche}
          onChange={(e) => {
            setNiche(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-creator/30"
        >
          {NICHE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n === 'all' ? 'All Niches' : n}
            </option>
          ))}
        </select>
        <select
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-creator/30"
        >
          {PLATFORM_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Error banner */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load creators. Showing cached data.
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-gray-200" />
                  <div className="h-2.5 w-20 rounded bg-gray-100" />
                </div>
                <div className="h-3 w-16 rounded bg-gray-200" />
                <div className="h-3 w-12 rounded bg-gray-200" />
                <div className="h-3 w-16 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : creators.length === 0 ? (
          <div className="text-center py-16">
            <UserCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900 mb-1">No creators found</p>
            <p className="text-xs text-gray-500 mb-4">
              {search || status !== 'all' || niche !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by adding your first creator'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-creator px-3 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Creator
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-secondary">
                    <th
                      className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('name')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Creator <SortIcon col="name" />
                      </span>
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
                    </th>
                    <th
                      className="text-right px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('followers')}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Followers <SortIcon col="followers" />
                      </span>
                    </th>
                    <th
                      className="text-right px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('engagementRate')}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Engagement <SortIcon col="engagementRate" />
                      </span>
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Niche
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th
                      className="text-right px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('totalDeals')}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Deals <SortIcon col="totalDeals" />
                      </span>
                    </th>
                    <th
                      className="text-right px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('totalSpend')}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Spend <SortIcon col="totalSpend" />
                      </span>
                    </th>
                    <th
                      className="text-right px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('score')}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Score <SortIcon col="score" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {creators.map((creator) => (
                    <tr
                      key={creator.id}
                      onClick={() => router.push(`/creators/list/${creator.id}`)}
                      className="cursor-pointer hover:bg-surface-secondary transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-accent-creator-light flex items-center justify-center text-accent-creator font-medium text-sm shrink-0">
                            {creator.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{creator.name}</p>
                            <p className="text-xs text-gray-500">{creator.handle}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <PlatformIcon platform={creator.platform} />
                          <span className="text-xs text-gray-600 capitalize">{creator.platform}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">
                        {formatFollowers(creator.followers)}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-700">
                        {creator.engagementRate.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-gray-600">{creator.niche}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
                            STATUS_BADGE_STYLES[creator.status] ?? STATUS_BADGE_STYLES.inactive,
                          )}
                        >
                          {creator.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">
                        {creator.totalDeals}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">
                        {formatDollars(creator.totalSpend)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center h-6 w-8 rounded text-xs font-bold',
                            creator.score >= 90
                              ? 'bg-emerald-50 text-emerald-700'
                              : creator.score >= 80
                                ? 'bg-blue-50 text-blue-700'
                                : creator.score >= 70
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-gray-50 text-gray-600',
                          )}
                        >
                          {creator.score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages} ({data?.total ?? 0} total)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-surface-secondary disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-surface-secondary disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Creator Modal */}
      <AddCreatorModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}

export default function CreatorListPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" /></div>}>
      <CreatorListPageInner />
    </Suspense>
  );
}
