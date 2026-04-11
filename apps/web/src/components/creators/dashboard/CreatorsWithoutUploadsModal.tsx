'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload } from 'lucide-react';
import { useCreatorsWithoutUploads } from '@/hooks/creators/useCreatorDashboard';

// ---------------------------------------------------------------------------
// CreatorsWithoutUploadsModal
// Drawer-style modal listing creators that have no uploads yet.
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreatorsWithoutUploadsModal({ open, onClose }: Props) {
  const router = useRouter();
  const { data, isLoading } = useCreatorsWithoutUploads(open);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleClick = (creatorId: string) => {
    onClose();
    router.push(`/creators/list/${creatorId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)]">
        <header className="flex items-center justify-between border-b border-gray-200 dark:border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/70">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Creator ohne Uploads</h2>
              <p className="text-xs text-gray-500 dark:text-white/50">
                {data ? `${data.length} Creator` : 'Wird geladen...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
            aria-label="Schliessen"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-500 dark:text-white/40">
              Alle Creator haben bereits Uploads. Gut gemacht.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-white/8">
              {data.map((creator) => (
                <li key={creator.id}>
                  <button
                    onClick={() => handleClick(creator.id)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-sm font-semibold text-gray-900 dark:text-white">
                      {creator.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-white">{creator.name}</div>
                      <div className="truncate text-xs text-gray-500 dark:text-white/40">
                        {creator.niche || creator.platform || creator.email || 'Kein Profil-Detail'}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-white/30">&rarr;</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
