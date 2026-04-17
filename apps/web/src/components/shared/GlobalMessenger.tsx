'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresence, useTotalUnread, type PresenceUser } from '@/hooks/useHome';
import { ChatDrawer } from '@/components/home/ChatDrawer';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] || '?').toUpperCase();
}

/** Plays a short notification "pop" sound via Web Audio API. */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);        // A5
    osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.08); // D6
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch { /* Audio not available */ }
}

export function GlobalMessenger() {
  const [open, setOpen] = useState(false);
  const [chatPartner, setChatPartner] = useState<PresenceUser | null>(null);
  const { data: users = [] } = usePresence();
  const { data: unread } = useTotalUnread();
  const prevUnreadRef = useRef<number>(0);

  // Play sound when new unread messages arrive
  const totalUnread = unread?.count ?? 0;
  useEffect(() => {
    if (totalUnread > prevUnreadRef.current && prevUnreadRef.current >= 0) {
      playNotificationSound();
    }
    prevUnreadRef.current = totalUnread;
  }, [totalUnread]);

  const online = users.filter((u) => u.online);

  if (chatPartner) {
    return <ChatDrawer partner={chatPartner} onClose={() => setChatPartner(null)} />;
  }

  return (
    <>
      {/* Floating button */}
      <button
        data-messenger-toggle
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 md:bottom-5 right-5 z-30 h-12 w-12 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg flex items-center justify-center transition-all active:scale-95"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-pulse">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* User list panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-30 w-72 sm:w-80 rounded-2xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden animate-scale-in">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Nachrichten</span>
              {online.length > 0 && (
                <span className="text-[10px] text-emerald-500 font-bold">{online.length} online</span>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-white/5">
            {users.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">Keine Teammitglieder</div>
            )}
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => { setChatPartner(u); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors text-left"
              >
                <div className="relative flex-shrink-0">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.name} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{initials(u.name)}</span>
                    </div>
                  )}
                  <span className={cn(
                    'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[var(--card-bg)]',
                    u.online ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.name}</p>
                  <p className="text-[10px] text-gray-500">{u.online ? 'online' : 'offline'}</p>
                </div>
                {u.unread > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {u.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
