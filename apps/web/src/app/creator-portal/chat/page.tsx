'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
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

interface PortalCreator {
  id: string;
  name: string;
}

import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api`;

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function CreatorChatPage() {
  const [creator, setCreator] = useState<PortalCreator | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('creator_data');
    if (stored) {
      try {
        setCreator(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!creator) return;
    try {
      const res = await fetch(`${API_BASE}/chat/${creator.id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [creator]);

  useEffect(() => {
    fetchMessages();
    // Poll every 5 seconds for new messages
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  // Mark messages as read by creator
  useEffect(() => {
    if (!creator || messages.length === 0) return;
    const unread = messages.some((m) => !m.readByCreator && m.senderRole === 'admin');
    if (unread) {
      fetch(`${API_BASE}/chat/${creator.id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'creator' }),
      }).catch(() => {});
    }
  }, [creator, messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || !creator || sending) return;

      setSending(true);
      try {
        const res = await fetch(`${API_BASE}/chat/${creator.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: input.trim(),
            senderRole: 'creator',
            senderName: creator.name,
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
    [input, creator, sending],
  );

  if (!creator) {
    return (
      <div className="text-center py-16 text-gray-500">
        Please log in to access chat.
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: ChatMsg[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const date = formatDate(msg.createdAt);
    if (date !== currentDate) {
      currentDate = date;
      groupedMessages.push({ date, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="shrink-0 pb-4 border-b border-gray-200 mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Chat with Admin</h1>
        <p className="text-sm text-gray-500">
          Send messages to your team manager
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex items-center justify-center mb-3">
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-0.5">
                  {group.date}
                </span>
              </div>
              <div className="space-y-2">
                {group.messages.map((msg) => {
                  const isCreator = msg.senderRole === 'creator';
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex',
                        isCreator ? 'justify-end' : 'justify-start',
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-4 py-2.5',
                          isCreator
                            ? 'bg-violet-600 text-white rounded-br-md'
                            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md',
                        )}
                      >
                        {!isCreator && (
                          <p className="text-xs font-medium text-violet-600 mb-0.5">
                            {msg.senderName}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        <p
                          className={cn(
                            'text-[10px] mt-1',
                            isCreator ? 'text-violet-200' : 'text-gray-400',
                          )}
                        >
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="shrink-0 flex items-center gap-2 pt-3 border-t border-gray-200"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
          autoFocus
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="shrink-0 h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}
