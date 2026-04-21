import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

const ALGO = 'aes-256-gcm';
const logger = new Logger('ShippingEncryption');

function getKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a JSON-serializable payload using AES-256-GCM.
 * Returns { encrypted, iv, authTag, algorithm } as a JSONB-storable object.
 */
export function encryptCredentials(payload: any, secret: string): any {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(secret), iv);
  const raw = Buffer.from(JSON.stringify(payload), 'utf8');
  const enc = Buffer.concat([cipher.update(raw), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    algorithm: ALGO,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encrypted: enc.toString('base64'),
  };
}

export function decryptCredentials(stored: any, secret: string): any {
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
    return JSON.parse(dec.toString('utf8'));
  } catch (err: any) {
    logger.error(`Decryption failed: ${err.message}`);
    return null;
  }
}
