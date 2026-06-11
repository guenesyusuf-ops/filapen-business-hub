'use client';

import { useCallback } from 'react';

/**
 * Subtile Vibrations-Feedback fuer mobile Touch-Aktionen.
 * Wird auf iOS Safari ignoriert (Webview nutzt nur navigator.vibrate auf Android),
 * aber das ist fein — es ist eine progressive Enhancement.
 *
 * Beispiel:
 *   const haptic = useHaptic();
 *   <button onClick={() => { haptic.success(); onAction(); }}>Bezahlt</button>
 */
export function useHaptic() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try { navigator.vibrate(pattern); } catch {}
  }, []);

  return {
    /** Kurzer Tipper — fuer einfache Aktionen (Tab-Wechsel, Button-Click) */
    tap: useCallback(() => vibrate(10), [vibrate]),
    /** Erfolgs-Pattern — kurz + kurz */
    success: useCallback(() => vibrate([15, 30, 15]), [vibrate]),
    /** Warnungs-Pattern — laenger */
    warning: useCallback(() => vibrate(40), [vibrate]),
    /** Fehler-Pattern — doppelt lang */
    error: useCallback(() => vibrate([30, 50, 30]), [vibrate]),
    /** Schwer / wichtige Aktion */
    heavy: useCallback(() => vibrate(50), [vibrate]),
  };
}
