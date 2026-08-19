'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Debounced-Autosave-Hook fuer Formularfelder.
 *
 * Verwendung:
 *   const { status, error, trigger, lastSavedAt } = useAutosave({
 *     debounceMs: 800,
 *     save: async (value) => api.updateFoo(key, value),
 *   });
 *   <input onChange={e => trigger(e.target.value)} />
 *   <SaveStatus status={status} />
 *
 * Details:
 * - Bei jedem trigger() startet ein neues Timeout, alte werden gecancelt.
 * - Wenn die save-Promise scheitert, bleibt der Wert im UI (nicht rueckgesetzt),
 *   status wird 'error' + error-Objekt. Nutzer kann korrigieren + neu triggern.
 * - Unmount cancelt den Save nicht — der Server-State soll dem UI-State folgen.
 *   Aber setState wird geschuetzt via mountedRef.
 */
export function useAutosave<T>({
  debounceMs = 800,
  save,
}: {
  debounceMs?: number;
  save: (value: T) => Promise<unknown>;
}) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const trigger = useCallback(
    (value: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setStatus('saving');
      setError(null);
      timerRef.current = setTimeout(async () => {
        try {
          await save(value);
          if (mountedRef.current) {
            setStatus('saved');
            setLastSavedAt(new Date());
          }
        } catch (e: any) {
          if (mountedRef.current) {
            setStatus('error');
            setError(e instanceof Error ? e : new Error(String(e)));
          }
        }
      }, debounceMs);
    },
    [save, debounceMs],
  );

  /** Force-flush: sofort speichern (z.B. auf Blur oder Enter). */
  const flush = useCallback(
    async (value: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setStatus('saving');
      setError(null);
      try {
        await save(value);
        if (mountedRef.current) {
          setStatus('saved');
          setLastSavedAt(new Date());
        }
      } catch (e: any) {
        if (mountedRef.current) {
          setStatus('error');
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      }
    },
    [save],
  );

  return { status, error, lastSavedAt, trigger, flush };
}
