'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Upload, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';

interface AdminNotification {
  id: string;
  creatorId: string;
  creatorName: string;
  fileName: string;
  label: string;
  batch: string | null;
  fileType: string;
  createdAt: string;
  seen: boolean;
}

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch unseen uploads as notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/creator-uploads/recent-for-admin?limit=15`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.items || []);
      setUnseenCount(data.unseenCount || 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = (n: AdminNotification) => {
    // Mark as seen
    fetch(`${API_URL}/api/creator-uploads/${n.id}/mark-seen`, { method: 'PATCH' }).catch(() => {});
    // Navigate to creator uploads
    router.push(`/creators/list/${n.creatorId}`);
    setOpen(false);
    // Optimistic update
    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, seen: true } : x));
    setUnseenCount((c) => Math.max(0, c - 1));
  };

  const markAllSeen = async () => {
    try {
      await fetch(`${API_URL}/api/creator-uploads/mark-all-seen`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((x) => ({ ...x, seen: true })));
      setUnseenCount(0);
    } catch { /* ignore */ }
  };

  const dateFormatter = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-150 active:scale-95"
        title="Benachrichtigungen"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Benachrichtigungen
            </span>
            {unseenCount > 0 && (
              <button
                onClick={markAllSeen}
                className="text-xs text-violet-600 hover:underline"
              >
                Alle gelesen
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="h-6 w-6 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Keine Benachrichtigungen</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-50 dark:border-white/5 last:border-b-0 ${
                    !n.seen ? 'bg-violet-50/40 dark:bg-violet-500/5' : ''
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                    <Upload className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${!n.seen ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                      <span className="font-semibold">{n.creatorName}</span> hat neuen Content hochgeladen
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                      {n.label || n.fileName}
                      {n.batch ? ` — ${n.batch}` : ''}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {dateFormatter.format(new Date(n.createdAt))}
                    </p>
                  </div>
                  {!n.seen && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
