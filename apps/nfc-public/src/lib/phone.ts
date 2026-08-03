/**
 * Telefon-Vorwahl-Helfer fuer DE/AT/CH.
 * Speicherung erfolgt weiterhin als kompletter String (z.B. "+491761234567") —
 * das UI zerlegt beim Laden nur die Anzeige (Prefix-Dropdown + Rest).
 */

export interface CountryPrefix {
  code: 'DE' | 'AT' | 'CH';
  prefix: string;
  label: string;
  flag: string;
}

export const PHONE_PREFIXES: CountryPrefix[] = [
  { code: 'DE', prefix: '+49', label: 'Deutschland', flag: '🇩🇪' },
  { code: 'AT', prefix: '+43', label: 'Österreich',  flag: '🇦🇹' },
  { code: 'CH', prefix: '+41', label: 'Schweiz',     flag: '🇨🇭' },
];

export const DEFAULT_PREFIX = PHONE_PREFIXES[0]; // DE

/**
 * Zerlegt eine gespeicherte Nummer in { prefix, rest }.
 * - "+49 176 12345678" oder "+491761234567" -> DE-Prefix + Rest
 * - "0049176…" -> DE-Prefix + Rest (fuehrende 00 als + interpretieren)
 * - "017612345678" -> keine erkannte Vorwahl, Default DE, Rest bleibt "0176…"
 * - "" oder null -> Default DE + leerer Rest
 *
 * Wichtig: bestehende Nummern werden NIE veraendert wenn keine Vorwahl erkannt
 * wird — der User sieht sie beim Bearbeiten so wie er sie damals eingegeben hat.
 */
export function splitPhone(stored: string | null | undefined): {
  prefix: CountryPrefix;
  rest: string;
} {
  const raw = (stored ?? '').trim();
  if (!raw) return { prefix: DEFAULT_PREFIX, rest: '' };

  // "+" bzw. "00" als International-Prefix behandeln
  const normalized = raw.replace(/^00/, '+');

  for (const cp of PHONE_PREFIXES) {
    if (normalized.startsWith(cp.prefix)) {
      const rest = normalized.slice(cp.prefix.length).replace(/^\s+/, '');
      return { prefix: cp, rest };
    }
  }

  // Keine bekannte Vorwahl erkannt (z.B. "01761234567" ohne Ländercode).
  // Nichts zerlegen — den Rest so lassen wie er ist, Prefix auf Default.
  return { prefix: DEFAULT_PREFIX, rest: raw };
}

/**
 * Fuegt eine Nummer wieder zusammen. Leerer rest -> leerer String
 * (nicht "+49" alleine speichern).
 */
export function joinPhone(prefix: CountryPrefix, rest: string): string {
  const trimmed = rest.trim();
  if (!trimmed) return '';
  // Falls User im Feld schon "0" oder "+" tippt: zweifach vermeiden
  const cleanRest = trimmed.replace(/^\+/, '').replace(/^0+/, '');
  return `${prefix.prefix} ${cleanRest}`;
}
