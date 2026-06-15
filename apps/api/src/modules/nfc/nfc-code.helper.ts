/**
 * Code-Generator fuer NFC-Baender.
 *
 * Format:
 *   - 6 Zeichen
 *   - Alphabet: a-z (kleinbuchstaben) + Ziffern 2-9
 *   - AUSGESCHLOSSEN: 0, O, 1, I, l (Verwechslungsgefahr)
 *
 * Permutationen: 33^6 = ~1,29 Mrd. Codes
 * Bei 10.000 Codes/Batch: Kollisions-Wahrscheinlichkeit < 0.001%
 */

import { randomBytes } from 'crypto';

const ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789'; // 33 chars (no 0,O,1,I,l)
const CODE_LENGTH = 6;

/** Generiert einen zufaelligen Code. KEIN Uniqueness-Check — Caller muss pruefen. */
export function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH * 2);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/** Generiert N Codes garantiert eindeutig innerhalb dieses Sets.
 *  Achtung: prueft NICHT gegen DB — das macht der Caller. */
export function generateUniqueCodes(count: number): string[] {
  const set = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 3;
  while (set.size < count && attempts < maxAttempts) {
    set.add(generateCode());
    attempts++;
  }
  if (set.size < count) {
    throw new Error(`Konnte nur ${set.size} eindeutige Codes generieren (von ${count} angefragt)`);
  }
  return Array.from(set);
}

/** Validiert ob ein Code dem Format entspricht. */
export function isValidCodeFormat(code: string): boolean {
  if (typeof code !== 'string') return false;
  if (code.length !== CODE_LENGTH) return false;
  for (const c of code) {
    if (!ALPHABET.includes(c)) return false;
  }
  return true;
}

/** Erlaubte Maximal-Batch-Groesse. */
export const MAX_BATCH_SIZE = 10000;
