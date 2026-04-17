'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Inbox, AtSign, MessageSquare, ShieldCheck, ClipboardList, ChevronRight, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';
import { useQuery } from '@tanstack/react-query';
import { useTotalUnread, usePresence } from '@/hooks/useHome';

interface InboxItem {
  id: string;
  type: 'notification' | 'dm' | 'mention';
  icon: 'approval' | 'task' | 'comment' | 'dm' | 'mention';
  title: string;
  subtitle: string;
  link?: string;
  time: string;
  unread: boolean;
}

function useWmNotificationsRaw() {
  return useQuery<any[]>({
    queryKey: ['home', 'inbox-notifications'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/wm/notifications?limit=10`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'jetzt';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const ICON_MAP = {
  approval: { icon: ShieldCheck, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' },
  task: { icon: ClipboardList, color: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' },
  comment: { icon: MessageSquare, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' },
  dm: { icon: MessageSquare, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' },
  mention: { icon: AtSign, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' },
};

export function ShortcutInbox() {
  const { data: wmNotifications = [] } = useWmNotificationsRaw();
  const { data: presence = [] } = usePresence();
  const { data: dmUnread } = useTotalUnread();

  const items = useMemo<InboxItem[]>(() => {
    const result: InboxItem[] = [];

    // WM notifications → inbox items
    for (const n of wmNotifications) {
      const isApproval = (n.type === 'approval');
      const isMention = n.message?.includes('@');
      result.push({
        id: `wm-${n.id}`,
        type: 'notification',
        icon: isApproval ? 'approval' : isMention ? 'mention' : n.type === 'comment' ? 'comment' : 'task',
        title: n.title,
        subtitle: n.message,
        link: n.project_id ? `/work-management/${n.project_id}` : undefined,
        time: relativeTime(n.created_at ?? n.createdAt),
        unread: !n.read,
      });
    }

    // DM unread → grouped per sender
    for (const user of presence) {
      if (user.unread > 0) {
        result.push({
          id: `dm-${user.id}`,
          type: 'dm',
          icon: 'dm',
          title: user.name,
          subtitle: `${user.unread} ungelesene ${user.unread === 1 ? 'Nachricht' : 'Nachrichten'}`,
          link: '/home',
          time: '',
          unread: true,
        });
      }
    }

    // Sort: unread first, then by time
    result.sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return 0;
    });

    return result.slice(0, 8);
  }, [wmNotifications, presence]);

  const unreadCount = items.filter((i) => i.unread).length + (dmUnread?.count ?? 0);

  return (
    <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Posteingang</h2>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-white/5 max-h-80 overflow-y-auto">
        {items.length === 0 && (
          <div className="py-10 px-5 text-center">
            <Bell className="h-8 w-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Alles aufgeraeumt</p>
          </div>
        )}
        {items.map((item) => {
          const iconDef = ICON_MAP[item.icon];
          const Icon = iconDef.icon;
          const inner = (
            <div className={cn(
              'flex items-start gap-3 px-4 sm:px-5 py-3 transition-colors',
              item.link ? 'hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer' : '',
              item.unread && 'bg-primary-50/30 dark:bg-primary-900/5',
            )}>
              <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0', iconDef.color)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                  {item.time && <span className="text-[10px] text-gray-400 flex-shrink-0">{item.time}</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{item.subtitle}</p>
              </div>
              {item.unread && <div className="h-2 w-2 rounded-full bg-primary-500 mt-2 flex-shrink-0" />}
              {item.link && <ChevronRight className="h-3.5 w-3.5 text-gray-300 mt-2 flex-shrink-0" />}
            </div>
          );

          return item.link ? (
            <Link key={item.id} href={item.link}>{inner}</Link>
          ) : (
            <div key={item.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
