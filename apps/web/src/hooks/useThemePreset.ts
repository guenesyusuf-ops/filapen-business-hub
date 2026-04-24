'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';

export const THEME_PRESETS = [
  { id: 'standard', label: 'Standard', description: 'Ausgewogen & professionell',
    swatches: ['#A9C6E0', '#2C3E50', '#F2A900', '#FF8C00'] },
  { id: 'mystic', label: 'Mystic', description: 'Dunkel & geheimnisvoll',
    swatches: ['#512E7B', '#3A1F57', '#292B3C', '#1C1E2B'] },
  { id: 'sunset', label: 'Sunset', description: 'Warm & energetisch',
    swatches: ['#F1A76D', '#E88B3C', '#2980B9', '#1F5D8A'] },
  { id: 'grey', label: 'Grey', description: 'Minimal & neutral',
    swatches: ['#B3B3B3', '#999999', '#7F7F7F', '#4D4D4D'] },
  { id: 'petal', label: 'Petal', description: 'Verspielt & feminin',
    swatches: ['#8A93DB', '#9D82C4', '#D74F87', '#C960A8'] },
] as const;

export type ThemePresetId = (typeof THEME_PRESETS)[number]['id'];

/**
 * Applied das User-gewählte Theme als data-theme am <html>-Element. Läuft
 * bei jedem User-Change (Login, Theme-Wechsel in Settings). Standard-Preset
 * (unser Haupt-Palette) entfernt das Attribut — Default-Werte aus :root
 * greifen dann.
 */
export function useThemePreset() {
  const preset = useAuthStore((s) => s.user?.themePreset);

  useEffect(() => {
    const html = document.documentElement;
    if (!preset || preset === 'standard') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', preset);
    }
  }, [preset]);
}
