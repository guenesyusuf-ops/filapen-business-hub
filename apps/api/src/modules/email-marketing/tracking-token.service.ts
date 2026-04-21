import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * HMAC-signed tokens for email tracking URLs. Prevents tampering
 * (e.g. user trying to forge unsubscribe for another contact).
 */
@Injectable()
export class TrackingTokenService {
  /**
   * Sign a payload. Returns base64url(payload).base64url(hmac).
   */
  sign(payload: Record<string, any>, secret: string): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  /**
   * Verify a signed token and return its payload, or null if invalid.
   */
  verify<T = any>(token: string, secret: string): T | null {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    let ok = false;
    try {
      ok = crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch {
      return null;
    }
    if (!ok) return null;
    try {
      return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
    } catch {
      return null;
    }
  }
}
