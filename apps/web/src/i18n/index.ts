import en from './locales/en.json';
import de from './locales/de.json';

export type Locale = 'en' | 'de';
export type Translations = typeof en;

const translations: Record<Locale, Translations> = { en, de };

export function getTranslations(locale: Locale): Translations {
  return translations[locale] || translations.en;
}

/**
 * Nested key accessor: translate(translations, 'finance.grossRevenue') => 'Gross Revenue'
 * Falls back to the key string itself if not found.
 */
export function translate(translations: Translations, key: string): string {
  const keys = key.split('.');
  let result: unknown = translations;
  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = (result as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }
  return typeof result === 'string' ? result : key;
}
