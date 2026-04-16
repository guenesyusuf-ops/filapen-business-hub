'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search, Sparkles, ArrowRight, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
}

export function CommandBar({ open, onClose }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setAnswer(null);
      setSteps([]);
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

  const handleSubmit = useCallback(async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setAnswer(null);
    setSteps([]);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/ai/ask`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Fehler: ${res.status}`);
      }

      const data = await res.json();
      setAnswer(data.answer);
      setSteps(data.steps ?? []);
    } catch (err: any) {
      setError(err.message || 'Anfrage fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [query, loading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-white/5">
          <Sparkles className="h-5 w-5 text-primary-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            placeholder="Frag Filapen..."
            className="flex-1 bg-transparent text-base text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
          />
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600/30 border-t-primary-600 flex-shrink-0" />
          ) : query.trim() ? (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors"
            >
              Fragen
              <ArrowRight className="h-3 w-3" />
            </button>
          ) : (
            <kbd className="hidden sm:inline text-xs font-mono text-gray-400 px-2 py-0.5 rounded border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
              ESC
            </kbd>
          )}
        </div>

        {/* Response area */}
        {(loading || answer || error) && (
          <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
            {/* Tool steps (while loading or after) */}
            {steps.length > 0 && (
              <div className="mb-3 space-y-1">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    <Wrench className="h-3 w-3 flex-shrink-0" />
                    <span className="font-mono truncate">{step}</span>
                  </div>
                ))}
              </div>
            )}

            {loading && !answer && (
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600/30 border-t-primary-600" />
                <span>Filapen denkt nach...</span>
              </div>
            )}

            {answer && (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                {answer}
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Bottom hint */}
        {!loading && !answer && !error && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-white/5 flex items-center gap-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Aufgaben, Projekte, Team, Umsatz abfragen</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>Powered by Claude</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook: registers Cmd+K / Ctrl+K globally and manages the open state.
 * Use in the DashboardLayout. Returns [isOpen, toggle] pair.
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
