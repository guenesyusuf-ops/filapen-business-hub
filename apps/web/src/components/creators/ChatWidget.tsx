'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMsg {
  id: string;
  senderRole: string;
  senderName: string;
  message: string;
  readByAdmin: boolean;
  readByCreator: boolean;
  createdAt: string;
}

interface ChatWidgetProps {
  creatorId: string;
  creatorName: string;
  role: 'creator' | 'admin';
}

import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api`;

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function ChatWidget({ creatorId, creatorName, role }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!creatorId) return;
    try {
      const res = await fetch(`${API_BASE}/chat/${creatorId}`);
      if (res.ok) {
        const data: ChatMsg[] = await res.json();
        setMessages(data);
        // Count unread from the other role
        const unread = data.filter((m) => {
          if (role === 'creator') return !m.readByCreator && m.senderRole === 'admin';
          return !m.readByAdmin && m.senderRole === 'creator';
        }).length;
        setUnreadCount(unread);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [creatorId, role]);

  // Poll for messages
  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  // Mark as read when widget is open
  useEffect(() => {
    if (!open || !creatorId || messages.length === 0) return;
    const readField = role === 'creator' ? 'readByCreator' : 'readByAdmin';
    const otherRole = role === 'creator' ? 'admin' : 'creator';
    const hasUnread = messages.some(
      (m) => !m[readField] && m.senderRole === otherRole,
    );
    if (hasUnread) {
      fetch(`${API_BASE}/chat/${creatorId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
        .then(() => {
          setUnreadCount(0);
        })
        .catch(() => {});
    }
  }, [open, creatorId, messages, role]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || sending || !creatorId) return;

      setSending(true);
      try {
        const res = await fetch(`${API_BASE}/chat/${creatorId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: input.trim(),
            senderRole: role,
            senderName: role === 'admin' ? 'Admin' : creatorName,
          }),
        });
        if (res.ok) {
          const msg = await res.json();
          setMessages((prev) => [...prev, msg]);
          setInput('');
        }
      } catch {
        // ignore
      } finally {
        setSending(false);
      }
    },
    [input, sending, creatorId, role, creatorName],
  );

  const isMyMessage = (msg: ChatMsg) => msg.senderRole === role;

  return (
    <>
      {/* Floating chat bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 transition-all hover:scale-105 flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[350px] h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-violet-600 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">
                {role === 'creator' ? 'Chat with Admin' : `Chat with ${creatorName}`}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md hover:bg-violet-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-gray-400">
                  No messages yet. Start the conversation!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const mine = isMyMessage(msg);
                return (
                  <div
                    key={msg.id}
                    className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3 py-2',
                        mine
                          ? 'bg-violet-600 text-white rounded-br-md'
                          : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md',
                      )}
                    >
                      {!mine && (
                        <p className="text-[10px] font-medium text-violet-600 mb-0.5">
                          {msg.senderName}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.message}
                      </p>
                      <p
                        className={cn(
                          'text-[10px] mt-0.5',
                          mine ? 'text-violet-200' : 'text-gray-400',
                        )}
                      >
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="shrink-0 flex items-center gap-2 p-3 border-t border-gray-200 bg-white"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nachricht schreiben..."
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="shrink-0 h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
