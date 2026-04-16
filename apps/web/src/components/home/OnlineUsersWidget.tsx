'use client';

import { useState } from 'react';
import { Users, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresence, type PresenceUser } from '@/hooks/useHome';
import { ChatDrawer } from './ChatDrawer';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] || '?').toUpperCase();
}

function lastActiveLabel(iso: string | null): string {
  if (!iso) return 'noch nie';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}

export function OnlineUsersWidget() {
  const { data: users = [], isLoading } = usePresence();
  const [chatPartner, setChatPartner] = useState<PresenceUser | null>(null);

  const online = users.filter((u) => u.online);
  const offline = users.filter((u) => !u.online);

  return (
    <>
      <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Team</h2>
            {online.length > 0 && (
              <span className="inline-flex items-center gap-1 ml-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {online.length} online
              </span>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
          {isLoading && (
            <div className="py-8 flex justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          )}
          {!isLoading && users.length === 0 && (
            <div className="py-8 px-5 text-center">
              <Users className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Noch keine Teammitglieder</p>
            </div>
          )}
          {[...online, ...offline].map((u) => (
            <button
              key={u.id}
              onClick={() => setChatPartner(u)}
              className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="relative flex-shrink-0">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt={u.name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{initials(u.name)}</span>
                  </div>
                )}
                <span
                  className={cn(
                    'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[var(--card-bg)]',
                    u.online ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.name}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  {u.online ? (
                    <span className="text-emerald-600 dark:text-emerald-400">online</span>
                  ) : (
                    `zuletzt ${lastActiveLabel(u.lastActiveAt)}`
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {u.unread > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {u.unread}
                  </span>
                )}
                <MessageSquare className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {chatPartner && (
        <ChatDrawer partner={chatPartner} onClose={() => setChatPartner(null)} />
      )}
    </>
  );
}
