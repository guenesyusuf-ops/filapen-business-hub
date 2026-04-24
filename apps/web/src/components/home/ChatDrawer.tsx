'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatThread, useSendMessage, useMarkRead, type PresenceUser } from '@/hooks/useHome';
import { useAuthStore } from '@/stores/auth';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] || '?').toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

interface ChatDrawerProps {
  partner: PresenceUser;
  onClose: () => void;
}

export function ChatDrawer({ partner, onClose }: ChatDrawerProps) {
  const { user: currentUser } = useAuthStore();
  const { data: messages = [] } = useChatThread(partner.id);
  const sendMessage = useSendMessage();
  const markRead = useMarkRead();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Mark as read when opened / when new partner messages arrive
  useEffect(() => {
    markRead.mutate(partner.id);
  }, [partner.id, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    await sendMessage.mutateAsync({ partnerId: partner.id, content });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="fixed z-[80] bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col animate-slide-up inset-0 sm:inset-auto sm:bottom-0 sm:right-6 sm:w-96 sm:h-[500px] sm:max-h-[calc(100vh-2rem)] sm:rounded-t-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5 bg-gradient-to-r from-primary-50/50 to-transparent dark:from-primary-900/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            {partner.avatarUrl ? (
              <img src={partner.avatarUrl} alt={partner.name} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                <span className="text-[11px] font-bold text-white">{initials(partner.name)}</span>
              </div>
            )}
            <span
              className={cn(
                'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[var(--card-bg)]',
                partner.online ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
              )}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{partner.name}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {partner.online ? (
                <span className="text-emerald-600 dark:text-emerald-400">online</span>
              ) : (
                'offline'
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50/50 dark:bg-white/[0.01]"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
              <Send className="h-5 w-5 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Noch keine Nachrichten</p>
            <p className="text-xs text-gray-400 mt-1">Schreib die erste Nachricht an {partner.name.split(' ')[0]}</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const mine = msg.senderId === currentUser?.id;
          const prev = messages[i - 1];
          const showTime = !prev || new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60_000;
          return (
            <div key={msg.id}>
              {showTime && (
                <p className="text-center text-[10px] text-gray-400 my-2">{formatTime(msg.createdAt)}</p>
              )}
              <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap',
                    mine
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-white dark:bg-white/5 text-gray-800 dark:text-gray-200 border border-gray-200/60 dark:border-white/10 rounded-bl-sm',
                  )}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input — 16px font-size verhindert iOS Zoom-On-Focus, pb-safe schiebt
          über die Home-Indicator. */}
      <div className="border-t border-gray-100 dark:border-white/5 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Nachricht an ${partner.name.split(' ')[0]}...`}
            rows={1}
            style={{ fontSize: '16px' }}
            className="flex-1 resize-none rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 max-h-24"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sendMessage.isPending}
            className={cn(
              'flex-shrink-0 rounded-lg p-2 transition-colors',
              draft.trim() && !sendMessage.isPending
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
