import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'light' | 'dark' | 'system';
// Schriftart-Präferenz: 'system' = neue Apple-System-Typografie (Standard),
// 'classic' = bisherige Inter-Typografie. Reine UI-Einstellung (kein Backend).
type FontPref = 'system' | 'classic';

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  font: FontPref;
  setTheme: (theme: ThemeMode) => void;
  setFont: (font: FontPref) => void;
}

function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'light';
}

function applyTheme(resolved: 'light' | 'dark') {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }
}

function applyFont(font: FontPref) {
  if (typeof document !== 'undefined') {
    // 'system' = Standard (kein Attribut nötig); 'classic' schaltet auf Inter.
    if (font === 'classic') {
      document.documentElement.setAttribute('data-font', 'classic');
    } else {
      document.documentElement.removeAttribute('data-font');
    }
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      resolvedTheme: 'light',
      font: 'system',
      setTheme: (theme) => {
        const resolved = resolveTheme(theme);
        applyTheme(resolved);
        set({ theme, resolvedTheme: resolved });
      },
      setFont: (font) => {
        applyFont(font);
        set({ font });
      },
    }),
    {
      name: 'filapen-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.theme);
          applyTheme(resolved);
          state.resolvedTheme = resolved;
          applyFont(state.font ?? 'system');
        }
      },
    },
  ),
);
