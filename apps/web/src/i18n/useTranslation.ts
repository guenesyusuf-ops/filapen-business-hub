'use client';

import { useCallback } from 'react';
import { useLanguageStore } from '@/stores/language';
import { getTranslations, translate } from './index';

export function useTranslation() {
  const { locale, setLocale } = useLanguageStore();
  const translations = getTranslations(locale);

  const t = useCallback(
    (key: string) => translate(translations, key),
    [translations],
  );

  return { t, locale, setLocale };
}
