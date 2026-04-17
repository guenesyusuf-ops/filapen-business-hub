'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search, Sparkles, ArrowRight, Wrench, Send, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  steps?: string[];
}

export function CommandBar({ open, onClose }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check if speech recognition is available
  const hasSpeech = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setQuery(transcript);
    };

    recognition.onend = () => {
      setListening(false);
      // Auto-submit if we got text
      setTimeout(() => inputRef.current?.focus(), 50);
    };

    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  // Focus + reset on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setMessages([]);
      setError(null);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = useCallback(async () => {
    if (!query.trim() || loading) return;
    const userQuery = query.trim();
    setQuery('');
    setLoading(true);
    setError(null);

    // Add user message to chat + build history for context
    const updatedMessages = [...messages, { role: 'user' as const, content: userQuery }];
    setMessages(updatedMessages);

    // Build conversation history for the API (last 10 messages for context)
    const history = updatedMessages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch(`${API_URL}/api/ai/ask`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery, history }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Fehler: ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.answer || 'Keine Antwort.',
        steps: data.steps,
      }]);
    } catch (err: any) {
      setError(err.message || 'Anfrage fehlgeschlagen');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [query, loading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[10vh] sm:pt-[15vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-scale-in flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-500" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Ask Filapen</span>
            <span className="text-[10px] text-gray-400">24 Tools · Lesen & Aktionen</span>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[10px] text-gray-400 hover:text-primary-500 font-medium"
              >
                Neuer Chat
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Chat messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-[100px]">
          {messages.length === 0 && !loading && (
            <div className="text-center py-8">
              <Sparkles className="h-8 w-8 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Frag mich etwas — ich kann lesen UND handeln.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {['Welche Tasks sind offen?', 'Erstelle einen Task', 'Wie ist der Umsatz?', 'Schreib Peter eine Nachricht'].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/10 text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary-600 text-white px-4 py-2 text-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="space-y-0.5">
                      {msg.steps.map((step, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                          <Wrench className="h-2.5 w-2.5 flex-shrink-0" />
                          <span className="font-mono truncate">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="max-w-[95%] rounded-2xl rounded-bl-sm bg-gray-100 dark:bg-white/5 px-4 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600/30 border-t-primary-600" />
              <span>Filapen denkt nach...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Input — always visible at bottom */}
        <div className="border-t border-gray-100 dark:border-white/5 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder={messages.length > 0 ? 'Nachfrage stellen...' : 'Frag Filapen...'}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            />
            {hasSpeech && (
              <button
                onClick={toggleVoice}
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-lg transition-colors',
                  listening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-primary-500',
                )}
                title={listening ? 'Diktat stoppen' : 'Diktat starten'}
              >
                {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!query.trim() || loading}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg transition-colors',
                query.trim() && !loading
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-400',
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook: registers Cmd+K / Ctrl+K globally and manages the open state.
 */
export function useCommandBar(): [boolean, () => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  return [open, toggle];
}
