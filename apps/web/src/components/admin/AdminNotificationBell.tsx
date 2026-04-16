'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Upload, ShieldCheck, ClipboardList, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';
import { cn } from '@/lib/utils';

interface UnifiedNotification {
  id: string;
  type: 'upload' | 'approval' | 'task' | 'comment';
  title: string;
  message: string;
  link?: string;
  seen: boolean;
  createdAt: string;
  // Upload-specific
  creatorId?: string;
  // WM-specific
  taskId?: string;
  projectId?: string;
}

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    const results: UnifiedNotification[] = [];
    const headers = getAuthHeaders();

    // 1. Upload notifications (existing endpoint)
    try {
      const res = await fetch(`${API_URL}/api/creator-uploads/recent-for-admin?limit=10`);
      if (res.ok) {
        const data = await res.json();
        for (const item of data.items ?? []) {
          results.push({
            id: `upload-${item.id}`,
            type: 'upload',
            title: item.creatorName,
            message: `Neuer Upload: ${item.fileName}`,
            link: `/creators/list/${item.creatorId}`,
            seen: item.seen ?? item.seenByAdmin ?? false,
            createdAt: item.createdAt,
            creatorId: item.creatorId,
          });
        }
      }
    } catch { /* ignore */ }

    // 2. WM notifications (for current user)
    try {
      const res = await fetch(`${API_URL}/api/wm/notifications?limit=15`, { headers });
      if (res.ok) {
        const items = await res.json();
        for (const n of items) {
          results.push({
            id: `wm-${n.id}`,
            type: n.type === 'approval' ? 'approval' : n.type === 'comment' ? 'comment' : 'task',
            title: n.title,
            message: n.message,
            link: n.projectId ? `/work-management/${n.projectId}` : undefined,
            seen: n.read ?? false,
            createdAt: n.created_at ?? n.createdAt,
            taskId: n.taskId,
            projectId: n.projectId,
          });
        }
      }
    } catch { /* ignore */ }

    // Sort by date desc
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setNotifications(results.slice(0, 20));
    setUnseenCount(results.filter((n) => !n.seen).length);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleClick(n: UnifiedNotification) {
    // Mark as seen
    if (n.id.startsWith('upload-')) {
      const realId = n.id.replace('upload-', '');
      fetch(`${API_URL}/api/creator-uploads/${realId}/mark-seen`, { method: 'PATCH' }).catch(() => {});
    } else if (n.id.startsWith('wm-')) {
      const realId = n.id.replace('wm-', '');
      fetch(`${API_URL}/api/wm/notifications/${realId}/read`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      }).catch(() => {});
    }

    if (n.link) router.push(n.link);
    setOpen(false);
    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, seen: true } : x));
    setUnseenCount((c) => Math.max(0, c - 1));
  }

  function markAllSeen() {
    // Mark uploads
    fetch(`${API_URL}/api/creator-uploads/mark-all-seen`, { method: 'PATCH' }).catch(() => {});
    // Mark WM notifications
    fetch(`${API_URL}/api/wm/notifications/read-all`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    }).catch(() => {});

    setNotifications((prev) => prev.map((x) => ({ ...x, seen: true })));
    setUnseenCount(0);
  }

  const typeIcon = (type: string) => {
    if (type === 'upload') return <Upload className="h-3.5 w-3.5" />;
    if (type === 'approval') return <ShieldCheck className="h-3.5 w-3.5" />;
    if (type === 'comment') return <MessageSquare className="h-3.5 w-3.5" />;
    return <ClipboardList className="h-3.5 w-3.5" />;
  };

  const typeColor = (type: string) => {
    if (type === 'upload') return 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400';
    if (type === 'approval') return 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400';
    if (type === 'comment') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400';
    return 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400';
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'gerade eben';
    if (mins < 60) return `vor ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-150 active:scale-95"
        title="Benachrichtigungen"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-pulse">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Benachrichtigungen
              {unseenCount > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">({unseenCount} neu)</span>
              )}
            </span>
            {unseenCount > 0 && (
              <button onClick={markAllSeen} className="text-xs text-primary-600 hover:underline">
                Alle gelesen
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-white/5">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="h-8 w-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Keine Benachrichtigungen</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors',
                    !n.seen && 'bg-primary-50/30 dark:bg-primary-500/5',
                  )}
                >
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', typeColor(n.type))}>
                    {typeIcon(n.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{formatDate(n.createdAt)}</p>
                  </div>
                  {!n.seen && (
                    <div className="h-2 w-2 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
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
