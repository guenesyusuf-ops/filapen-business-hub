'use client';

import { useEffect } from 'react';
import { useToast } from './Toast';

/**
 * Bruecke zwischen QueryClient-Error-Events (providers.tsx) und
 * dem Toast-System. Ohne diese sieht der User immer noch keine Errors —
 * der Logger schreibt nur in die Browser-Console.
 *
 * Muss INSIDE ToastProvider gerendert werden.
 */
export function GlobalErrorBridge() {
  const toast = useToast();

  useEffect(() => {
    const handler = (event: Event) => {
      const ev = event as CustomEvent<{ scope: string; message: string; ctx?: string }>;
      const { scope, message, ctx } = ev.detail || ({} as any);
      // Filter: Queries die nur Hintergrund-Refetches sind nicht stoeren —
      // nur "echte" User-Aktionen (Mutations) zeigen wir lautstark.
      if (scope === 'mutation') {
        toast.error(
          'Aktion fehlgeschlagen',
          message || 'Bitte erneut versuchen oder Seite neu laden',
        );
      }
      // Query-Fehler nur in Console — verhindert dass im Hintergrund laufende
      // Refetches den User mit Toast-Spam bombardieren.
    };
    window.addEventListener('filapen:error', handler as EventListener);
    return () => window.removeEventListener('filapen:error', handler as EventListener);
  }, [toast]);

  return null;
}
