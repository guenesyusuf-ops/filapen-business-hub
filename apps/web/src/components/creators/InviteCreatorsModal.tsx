'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  X,
  Loader2,
  Users,
  Filter,
  UserPlus,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreators, type Creator } from '@/hooks/creators/useCreators';
import { useBulkInviteCreators } from '@/hooks/creators/useProjects';

// ---------------------------------------------------------------------------
// Shared classes
// ---------------------------------------------------------------------------

const inputCls =
  'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator placeholder:text-gray-400 dark:placeholder:text-gray-500';
const labelCls =
  'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InviteCreatorsModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onSuccess?: (count: number) => void;
  /** Creator IDs that are already invited and should be pre-excluded */
  alreadyInvitedIds?: string[];
}

type Mode = 'all' | 'filter';

type KidsOnVideo = 'any' | 'yes' | 'no';

const KID_AGE_OPTIONS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

const NICHE_OPTIONS = [
  '',
  'Lifestyle',
  'Fitness',
  'Food',
  'Tech',
  'Beauty',
  'Travel',
  'Fashion',
  'Gaming',
  'Brand',
  'Money',
];

const PLATFORM_OPTIONS = [
  { value: '', label: 'Alle Plattformen' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InviteCreatorsModal({
  open,
  projectId,
  onClose,
  onSuccess,
  alreadyInvitedIds = [],
}: InviteCreatorsModalProps) {
  const bulkInvite = useBulkInviteCreators();
  const { data: creatorsData, isLoading: creatorsLoading } = useCreators({
    pageSize: 500,
  });

  const [mode, setMode] = useState<Mode>('all');
  const [search, setSearch] = useState('');

  // Filters
  const [kidAges, setKidAges] = useState<string[]>([]);
  const [kidsOnVideo, setKidsOnVideo] = useState<KidsOnVideo>('any');
  const [minScore, setMinScore] = useState(0);
  const [niche, setNiche] = useState('');
  const [platform, setPlatform] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode('all');
      setSearch('');
      setKidAges([]);
      setKidsOnVideo('any');
      setMinScore(0);
      setNiche('');
      setPlatform('');
      setSelectedIds(new Set());
      setMessage('');
      setError(null);
    }
  }, [open]);

  const allCreators = useMemo(
    () => creatorsData?.data ?? [],
    [creatorsData?.data],
  );
  const alreadyInvitedSet = useMemo(
    () => new Set(alreadyInvitedIds),
    [alreadyInvitedIds],
  );

  // Apply filters
  const filteredCreators = useMemo(() => {
    let items = allCreators.filter((c) => !alreadyInvitedSet.has(c.id));

    if (mode === 'all') {
      // just search
      if (search.trim()) {
        const q = search.toLowerCase();
        items = items.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.handle ?? '').toLowerCase().includes(q) ||
            (c.niche ?? '').toLowerCase().includes(q),
        );
      }
      return items;
    }

    // Filter mode
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.handle ?? '').toLowerCase().includes(q),
      );
    }
    if (niche) {
      items = items.filter((c) => c.niche === niche);
    }
    if (platform) {
      items = items.filter((c) => c.platform === platform);
    }
    if (kidAges.length > 0) {
      items = items.filter((c) => {
        const ages = (c.kidsAges ?? '').toString();
        return kidAges.some((age) => ages.includes(age));
      });
    }
    if (kidsOnVideo === 'yes') {
      items = items.filter((c) => c.kidsOnVideo === true);
    } else if (kidsOnVideo === 'no') {
      items = items.filter((c) => c.kidsOnVideo !== true);
    }
    if (minScore > 0) {
      items = items.filter((c) => (c.score ?? 0) >= minScore);
    }
    return items;
  }, [
    allCreators,
    alreadyInvitedSet,
    mode,
    search,
    niche,
    platform,
    kidAges,
    kidsOnVideo,
    minScore,
  ]);

  const allFilteredSelected =
    filteredCreators.length > 0 &&
    filteredCreators.every((c) => selectedIds.has(c.id));

  const toggleCreator = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (filteredCreators.every((c) => prev.has(c.id))) {
        const next = new Set(prev);
        filteredCreators.forEach((c) => next.delete(c.id));
        return next;
      }
      const next = new Set(prev);
      filteredCreators.forEach((c) => next.add(c.id));
      return next;
    });
  }, [filteredCreators]);

  const toggleKidAge = useCallback((age: string) => {
    setKidAges((prev) =>
      prev.includes(age) ? prev.filter((a) => a !== age) : [...prev, age],
    );
  }, []);

  const handleInvite = useCallback(async () => {
    setError(null);
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setError('Bitte wähle mindestens einen Creator aus');
      return;
    }
    try {
      await bulkInvite.mutateAsync({
        projectId,
        creatorIds: ids,
        message: message.trim() || undefined,
      });
      onSuccess?.(ids.length);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Einladungen konnten nicht versendet werden',
      );
    }
  }, [bulkInvite, projectId, selectedIds, message, onClose, onSuccess]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-[var(--card-bg)] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Creator einladen
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Wähle Creator aus und lade sie zum Projekt ein
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          {/* Mode Tabs */}
          <div className="px-5 pt-4 pb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('all')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                mode === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10',
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Alle einladen
            </button>
            <button
              type="button"
              onClick={() => setMode('filter')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                mode === 'filter'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10',
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtern
            </button>
          </div>

          {/* Filter panel */}
          {mode === 'filter' && (
            <div className="px-5 pb-4 space-y-3 border-b border-gray-100 dark:border-white/8">
              {/* Kid ages */}
              <div>
                <label className={labelCls}>Kinderalter</label>
                <div className="flex flex-wrap gap-1.5">
                  {KID_AGE_OPTIONS.map((age) => {
                    const selected = kidAges.includes(age);
                    return (
                      <button
                        key={age}
                        type="button"
                        onClick={() => toggleKidAge(age)}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                          selected
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10',
                        )}
                      >
                        {age} J.
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Kids on video */}
                <div>
                  <label className={labelCls}>Kinder im Video zeigen</label>
                  <select
                    value={kidsOnVideo}
                    onChange={(e) =>
                      setKidsOnVideo(e.target.value as KidsOnVideo)
                    }
                    className={inputCls}
                  >
                    <option value="any">Egal</option>
                    <option value="yes">Ja</option>
                    <option value="no">Nein</option>
                  </select>
                </div>

                {/* Min score */}
                <div>
                  <label className={labelCls}>
                    Performance Score (min.): {minScore}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={minScore}
                    onChange={(e) => setMinScore(parseInt(e.target.value, 10))}
                    className="w-full accent-purple-600"
                  />
                </div>

                {/* Niche */}
                <div>
                  <label className={labelCls}>Kategorie</label>
                  <select
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className={inputCls}
                  >
                    {NICHE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n || 'Alle Kategorien'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Platform */}
                <div>
                  <label className={labelCls}>Plattform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className={inputCls}
                  >
                    {PLATFORM_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Search + message */}
          <div className="px-5 py-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche nach Name oder Handle..."
                className={cn(inputCls, 'pl-9')}
              />
            </div>

            <div>
              <label className={labelCls}>
                Nachricht an Creator (optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="Hey, wir würden uns freuen, wenn du bei diesem Projekt mitmachst..."
                className={cn(inputCls, 'resize-none')}
              />
            </div>
          </div>

          {/* Select all row */}
          <div className="px-5 py-2 border-y border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/[0.02] flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                disabled={filteredCreators.length === 0}
                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {allFilteredSelected ? 'Alle abwählen' : 'Alle auswählen'}
              </span>
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {filteredCreators.length} Creator verfügbar
            </span>
          </div>

          {/* Creator list */}
          <div className="px-5 py-3">
            {creatorsLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creator werden geladen...
              </div>
            ) : filteredCreators.length === 0 ? (
              <div className="text-center py-10">
                <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Keine Creator gefunden
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredCreators.map((c) => (
                  <CreatorRow
                    key={c.id}
                    creator={c}
                    selected={selectedIds.has(c.id)}
                    onToggle={() => toggleCreator(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-white/8 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">
              {selectedIds.size}
            </span>{' '}
            ausgewählt
          </div>
          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 flex-1 text-right">
              {error}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleInvite}
              disabled={selectedIds.size === 0 || bulkInvite.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
            >
              {bulkInvite.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              Einladen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreatorRow sub-component
// ---------------------------------------------------------------------------

function CreatorRow({
  creator,
  selected,
  onToggle,
}: {
  creator: Creator;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
        selected
          ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
          : 'border-gray-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/40 hover:bg-gray-50 dark:hover:bg-white/5',
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        readOnly
        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 pointer-events-none"
      />
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
        {creator.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={creator.avatarUrl}
            alt={creator.name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="text-xs font-bold text-white">
            {creator.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {creator.name}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
          {creator.niche || creator.platform}
          {creator.kidsAges ? ` • Kids: ${creator.kidsAges}` : ''}
        </p>
      </div>
      {creator.score > 0 && (
        <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 flex-shrink-0">
          {selected && <CheckCircle2 className="h-3 w-3" />}
          {creator.score}
        </div>
      )}
    </button>
  );
}

export default InviteCreatorsModal;
