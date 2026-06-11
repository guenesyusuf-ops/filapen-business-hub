'use client';

import { useEffect, useState, createContext, useContext, useCallback, useRef } from 'react';
import { X, AlertTriangle, Info, CheckCircle2, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Standalone <ConfirmDialog /> component
// ---------------------------------------------------------------------------

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  /** Eingabewert wenn Prompt-Modus — wenn gesetzt, wird ein Textfeld angezeigt */
  inputLabel?: string;
  inputDefault?: string;
  inputPlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" = roter Button (Loeschen etc), "primary" = blau, "success" = gruen */
  variant?: 'primary' | 'danger' | 'success' | 'warning';
  /** wenn true: Cancel-Button wird ausgeblendet (nur "OK") — fuer Info-Alerts */
  alertOnly?: boolean;
  onClose: () => void;
  onConfirm: (input?: string) => void | Promise<void>;
}

export function ConfirmDialog({
  open, title, message, inputLabel, inputDefault, inputPlaceholder,
  confirmLabel = 'Bestätigen', cancelLabel = 'Abbrechen',
  variant = 'primary', alertOnly = false,
  onClose, onConfirm,
}: ConfirmDialogProps) {
  const [input, setInput] = useState(inputDefault ?? '');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setInput(inputDefault ?? '');
      setBusy(false);
      // Focus input or confirm button after mount
      setTimeout(() => {
        if (inputLabel) inputRef.current?.focus();
      }, 60);
    }
  }, [open, inputDefault, inputLabel]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
      if (e.key === 'Enter' && !inputLabel && !busy) handleConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy, inputLabel]);

  // Body-Scroll-Lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm(inputLabel ? input : undefined);
      onClose();
    } catch (err: any) {
      // Caller is expected to surface errors via their own UI;
      // dialog stays open + busy off so user can retry.
      console.error('[ConfirmDialog] confirm error:', err);
      alert(err?.message ?? 'Fehler');
      setBusy(false);
    }
  }

  if (!open) return null;

  const tone = TONES[variant];
  const Icon = tone.icon;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay"
      onClick={() => !busy && onClose()}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[5] w-full sm:max-w-md bg-white dark:bg-[#0f1117] rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-200 dark:border-white/10 overflow-hidden modal-panel"
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className={`inline-flex h-10 w-10 rounded-xl items-center justify-center flex-shrink-0 ${tone.iconBg}`}>
            <Icon className={`h-5 w-5 ${tone.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            {message && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">{message}</p>
            )}
          </div>
          {!busy && (
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 -mt-1 -mr-1" aria-label="Schließen">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Optional Input (Prompt-Modus) */}
        {inputLabel && (
          <div className="px-5 pb-3">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">
              {inputLabel}
            </label>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy) handleConfirm(); }}
              placeholder={inputPlaceholder}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 dark:border-white/8 bg-gray-50/40 dark:bg-white/[0.02] mobile-safe-bottom">
          {!alertOnly && (
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-lg px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-md disabled:opacity-60 ${tone.btn}`}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const TONES = {
  primary: {
    icon: Info,
    iconBg: 'bg-primary-50 dark:bg-primary-900/30',
    iconColor: 'text-primary-600 dark:text-primary-300',
    btn: 'bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-700',
  },
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-red-50 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    btn: 'bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-700',
  },
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    btn: 'bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-700',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    btn: 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700',
  },
} as const;

// ---------------------------------------------------------------------------
// useConfirm() Hook — Promise-based API zum Ersetzen von confirm()/alert()
// ---------------------------------------------------------------------------

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger' | 'success' | 'warning';
  inputLabel?: string;
  inputDefault?: string;
  inputPlaceholder?: string;
  alertOnly?: boolean;
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<string | boolean>;
  alert: (title: string, message?: string, variant?: 'primary' | 'danger' | 'success' | 'warning') => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

interface PendingDialog extends ConfirmOptions {
  resolve: (v: string | boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<string | boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const alert = useCallback((title: string, message?: string, variant: 'primary' | 'danger' | 'success' | 'warning' = 'primary') => {
    return new Promise<void>((resolve) => {
      setPending({
        title, message, variant,
        alertOnly: true,
        confirmLabel: 'OK',
        resolve: () => resolve(),
      });
    });
  }, []);

  const value: ConfirmContextValue = { confirm, alert };

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <ConfirmDialog
          open={true}
          title={pending.title}
          message={pending.message}
          confirmLabel={pending.confirmLabel}
          cancelLabel={pending.cancelLabel}
          variant={pending.variant}
          inputLabel={pending.inputLabel}
          inputDefault={pending.inputDefault}
          inputPlaceholder={pending.inputPlaceholder}
          alertOnly={pending.alertOnly}
          onClose={() => {
            pending.resolve(pending.inputLabel ? '' : false);
            setPending(null);
          }}
          onConfirm={(value) => {
            pending.resolve(pending.inputLabel ? (value ?? '') : true);
            setPending(null);
          }}
        />
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * Hook fuer Promise-basierte Dialoge — ersetzt window.confirm/alert.
 *
 * Beispiel:
 *   const { confirm, alert } = useConfirm();
 *   const ok = await confirm({ title: 'Wirklich löschen?', variant: 'danger', confirmLabel: 'Löschen' });
 *   if (ok) await api.delete(id);
 *   await alert('Erfolg', 'Datei wurde gelöscht', 'success');
 *
 * Prompt-Modus:
 *   const name = await confirm({ title: 'Neuer Name', inputLabel: 'Ordnername', inputDefault: oldName });
 *   if (name) await api.rename(id, name);
 */
export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback fuer Komponenten ausserhalb des Providers — nutzt native APIs
    return {
      confirm: async (opts) => {
        if (opts.inputLabel) {
          const r = window.prompt(`${opts.title}\n${opts.message ?? ''}`, opts.inputDefault ?? '');
          return r ?? '';
        }
        return window.confirm(`${opts.title}${opts.message ? `\n${opts.message}` : ''}`);
      },
      alert: async (title, message) => { window.alert(`${title}${message ? `\n${message}` : ''}`); },
    };
  }
  return ctx;
}
