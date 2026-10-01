/**
 * Wert-Parsing für den Meta-Ads-Import (rein, testbar).
 *
 * Locale-robuste Zahlen (deutsch/englisch, Tausendergruppen, %, Währung),
 * mehrere Datumsformate mit expliziter Ambiguitäts-Erkennung, und eine klare
 * Unterscheidung zwischen "leer / nicht geliefert" (→ undefined, NICHT anfassen)
 * und einer echten 0.
 */

/** true = Zelle war leer / nicht geliefert. */
export function isBlank(v: string | null | undefined): boolean {
  return v == null || String(v).trim() === '';
}

/**
 * Zahlenformat aus einer Importdatei normalisieren. Gibt null zurück, wenn der
 * Wert nicht eindeutig lesbar ist — der Aufrufer MUSS das als Zeilenfehler
 * melden statt still zu verwerfen. Übernimmt die erprobte Logik aus
 * profit-analysis (Tausendergruppen-Erkennung) + Strip von %, Währung, Spaces.
 *
 *   "1.234,56" -> 1234.56   deutsch, Punkt = Tausender
 *   "1,234.56" -> 1234.56   englisch, Komma = Tausender
 *   "1234,56"  -> 1234.56
 *   "12.500"   -> 12500     deutsche Tausendergruppe
 *   "1234.56"  -> 1234.56   Dezimalpunkt, keine Tausendergruppe
 *   "3,2 %"    -> 3.2
 *   "1.234,56 €" -> 1234.56
 */
export function parseImportNumber(input: string | null | undefined): number | null {
  if (isBlank(input)) return null;
  // Währungssymbole, Prozent, NBSP/Spaces entfernen.
  let s = String(input)
    .replace(/[€$£%]/g, '')
    .replace(/ /g, '')
    .replace(/\s/g, '')
    .trim();
  if (!s) return null;

  const hatKomma = s.includes(',');
  const hatPunkt = s.includes('.');
  let norm: string;

  if (hatKomma && hatPunkt) {
    norm = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')   // deutsch: Punkt=Tausender
      : s.replace(/,/g, '');                      // englisch: Komma=Tausender
  } else if (hatKomma) {
    norm = s.replace(',', '.');
  } else if (hatPunkt) {
    // Nur Punkte: saubere Tausendergruppen (1.234 / 12.500) = deutsch; sonst Dezimalpunkt.
    norm = /^-?\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  } else {
    norm = s;
  }

  if (!/^-?\d+(\.\d+)?$/.test(norm)) return null;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

export interface ParsedDate {
  iso: string | null;
  /** true = Format mehrdeutig (z. B. 01/02/2026 DD/MM vs MM/DD) — Aufrufer soll bestätigen lassen. */
  ambiguous: boolean;
}

/**
 * Datum robust parsen. Unterstützt YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY,
 * MM/DD/YYYY. Bei Slash-Formaten wird die Reihenfolge NICHT blind geraten:
 * eindeutig wenn ein Teil > 12 ist, sonst ambiguous=true mit europäischem
 * Default (DD/MM). `prefer` kann 'dmy' oder 'mdy' erzwingen (aus Schema/Bestätigung).
 */
export function parseDate(input: string | null | undefined, prefer?: 'dmy' | 'mdy'): ParsedDate {
  if (isBlank(input)) return { iso: null, ambiguous: false };
  const s = String(input).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { iso: s, ambiguous: false };

  const dot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dot) {
    const [, d, m, y] = dot;
    return { iso: iso(y, m, d), ambiguous: false };
  }

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = slash[3];
    if (prefer === 'mdy') return { iso: iso(y, String(a), String(b)), ambiguous: false };
    if (prefer === 'dmy') return { iso: iso(y, String(b), String(a)), ambiguous: false };
    if (a > 12 && b <= 12) return { iso: iso(y, String(b), String(a)), ambiguous: false }; // a=Tag
    if (b > 12 && a <= 12) return { iso: iso(y, String(a), String(b)), ambiguous: false }; // b=Tag → MM/DD
    // beide <= 12 → mehrdeutig; europäischer Default DD/MM, aber Flag setzen
    return { iso: iso(y, String(b), String(a)), ambiguous: true };
  }

  return { iso: null, ambiguous: false };
}

function iso(y: string, m: string, d: string): string | null {
  const mm = Number(m);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
