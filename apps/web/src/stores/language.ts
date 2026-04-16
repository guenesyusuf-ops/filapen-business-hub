import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LanguageState {
  locale: 'en' | 'de';
  setLocale: (locale: 'en' | 'de') => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      locale: 'de',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'filapen-language' },
  ),
);
