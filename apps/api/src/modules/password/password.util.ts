import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

/**
 * AES-256-GCM Verschluesselung fuer Passwort-Manager-Secrets.
 * Identische Struktur wie apps/api/src/modules/shipping/encryption.util.ts,
 * aber mit eigenem Logger-Kontext + auf Strings statt beliebiger Payloads
 * spezialisiert.
 *
 * Ausgabe-Format:
 *   { algorithm, iv, authTag, encrypted } als JSONB-Struktur
 *
 * Key-Ableitung: SHA-256 vom Master-Secret. Master-Secret kommt aus der
 * Env-Variable SHIPPING_ENCRYPTION_SECRET (Reuse — kein neuer Env-Slot).
 */

const ALGO = 'aes-256-gcm';
const logger = new Logger('PasswordEncryption');

function getKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string, secret: string): any {
  if (typeof plain !== 'string') {
    throw new Error('encryptSecret: plain must be a string');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(secret), iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    algorithm: ALGO,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encrypted: enc.toString('base64'),
  };
}

export function decryptSecret(stored: any, secret: string): string | null {
  try {
    if (!stored || typeof stored !== 'object') return null;
    const { iv, authTag, encrypted, algorithm } = stored;
    if (!iv || !authTag || !encrypted) return null;
    const decipher = crypto.createDecipheriv(
      algorithm || ALGO,
      getKey(secret),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch (err: any) {
    logger.error(`Decrypt failed: ${err.message}`);
    return null;
  }
}

/**
 * Passwort-Staerke-Score 0-100 (grobe Heuristik ohne externe Lib).
 * Keine Bewertung ob wiederverwendet — das entscheidet Health-Dashboard.
 */
export function scorePasswordStrength(password: string): number {
  if (!password) return 0;
  const len = password.length;
  let score = 0;
  if (len >= 8) score += 20;
  if (len >= 12) score += 15;
  if (len >= 16) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  // Bonus fuer hohe Char-Vielfalt
  const unique = new Set(password).size;
  if (unique / len > 0.6) score += 10;
  return Math.min(100, score);
}
