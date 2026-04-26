'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useProjectChat, useSendChatMessage } from '@/hooks/work-management/useWmChat';
import { cn } from '@/lib/utils';

interface ProjectChatProps {
  projectId: string;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProjectChat({ projectId }: ProjectChatProps) {
  const { data: messages = [], isLoading } = useProjectChat(projectId);
  const sendMessage = useSendChatMessage();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    // Optimistic clear — aber Text behalten und auf Fehler restore'n. Vorher
    // hat fire-and-forget die Nachricht still verloren wenn das Netz weg war.
    const previousInput = input;
    setInput('');
    try {
      await sendMessage.mutateAsync({ projectId, message: trimmed });
    } catch (err: any) {
      setInput(previousInput);
      alert(`Nachricht konnte nicht gesendet werden: ${err?.message || 'Unbekannter Fehler'}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-[400px] max-h-[600px] rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg,#1a1d2e)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-white/10">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Team Chat
        </h3>
        <span className="text-xs text-gray-400">
          {messages.length} Nachrichten
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && (
          <p className="text-xs text-gray-400 text-center py-8">Lade Nachrichten...</p>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">
            Noch keine Nachrichten. Starte die Konversation!
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2">
            <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-[11px] font-bold text-primary-700 dark:text-primary-300">
              {msg.userName.charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {msg.userName}
                </span>
                <span className="text-[10px] text-gray-400">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words mt-0.5">
                {msg.message}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-white/10 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht schreiben..."
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-lg border border-gray-200 dark:border-white/10',
              'bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white',
              'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400',
            )}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-primary-600 text-white hover:bg-primary-700',
              'disabled:opacity-40 transition-colors',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
