'use client';

import { useLanguageStore } from '@/stores/language';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguageStore();

  return (
    <button
      onClick={() => setLocale(locale === 'en' ? 'de' : 'en')}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-surface-secondary hover:text-gray-700 transition-colors"
      title={locale === 'en' ? 'Auf Deutsch wechseln' : 'Switch to English'}
    >
      <Globe className="h-3.5 w-3.5" />
      <span>{locale === 'en' ? 'EN' : 'DE'}</span>
    </button>
  );
}
