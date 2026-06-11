'use client';

import { useEffect, useState, createContext, useContext, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Toast-System — kurze Feedback-Bubbles am unteren Bildschirmrand.
// Mobile-first: erscheinen ueber BottomNav, dismiss durch Tap oder timeout.
// ---------------------------------------------------------------------------

export type ToastVariant = 'success' | 'error' | 'info' | 'loading';

interface ToastMsg {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  show: (msg: Omit<ToastMsg, 'id'>) => string;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  loading: (title: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_META: Record<ToastVariant, {
  icon: any;
  bg: string;
  border: string;
  iconColor: string;
}> = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-50 dark:bg-red-900/30',
    border: 'border-red-200 dark:border-red-500/30',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-200 dark:border-blue-500/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  loading: {
    icon: Loader2,
    bg: 'bg-gray-50 dark:bg-white/[0.05]',
    border: 'border-gray-200 dark:border-white/10',
    iconColor: 'text-gray-600 dark:text-gray-300',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const show = useCallback((msg: Omit<ToastMsg, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const duration = msg.duration ?? (msg.variant === 'error' ? 5000 : msg.variant === 'loading' ? 0 : 3000);
    setToasts((prev) => [...prev, { ...msg, id }]);
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const success = useCallback((title: string, message?: string) => show({ title, message, variant: 'success' }), [show]);
  const error = useCallback((title: string, message?: string) => show({ title, message, variant: 'error' }), [show]);
  const info = useCallback((title: string, message?: string) => show({ title, message, variant: 'info' }), [show]);
  const loading = useCallback((title: string) => show({ title, variant: 'loading' }), [show]);

  const value: ToastContextValue = { show, success, error, info, loading, dismiss };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Container */}
      <div
        className="fixed left-0 right-0 z-[95] flex flex-col items-center gap-2 px-3 pointer-events-none"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {toasts.map((t) => {
          const meta = VARIANT_META[t.variant];
          const Icon = meta.icon;
          return (
            <button
              key={t.id}
              onClick={() => dismiss(t.id)}
              className={cn(
                'pointer-events-auto w-full max-w-sm flex items-start gap-3 rounded-xl shadow-lg backdrop-blur',
                'border px-4 py-3 text-sm',
                'bg-white/95 dark:bg-[#0f1117]/95',
                meta.border,
                'animate-slide-up',
              )}
            >
              <div className={cn('flex-shrink-0 mt-0.5', meta.iconColor)}>
                <Icon className={cn('h-5 w-5', t.variant === 'loading' && 'animate-spin')} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium text-gray-900 dark:text-white">{t.title}</div>
                {t.message && <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{t.message}</div>}
              </div>
              {t.variant !== 'loading' && (
                <span className="flex-shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mt-0.5">
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback ohne Provider
    return {
      show: (m) => { console.log('[toast]', m); return ''; },
      success: (t) => { console.log('[toast/success]', t); return ''; },
      error: (t, m) => { console.error('[toast/error]', t, m); return ''; },
      info: (t) => { console.log('[toast/info]', t); return ''; },
      loading: (t) => { console.log('[toast/loading]', t); return ''; },
      dismiss: () => {},
    };
  }
  return ctx;
}
