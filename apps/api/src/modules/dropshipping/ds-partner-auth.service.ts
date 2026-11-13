import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

export interface DsPartnerContext {
  partnerId: string;
  orgId: string;
}

/**
 * Eigenständige Authentifizierung für externe Dropship-Partner.
 * Getrennt vom Hub-Login (eigener Token-Typ 'ds_partner', eigener Guard).
 * Passwort-Hash via scrypt (keine zusätzliche Abhängigkeit).
 */
@Injectable()
export class DsPartnerAuthService {
  private readonly secret: string;
  private readonly expiry = '30d';

  constructor(private readonly config: ConfigService) {
    this.secret = this.config.get<string>('JWT_SECRET') || 'filapen-jwt-secret-change-me';
  }

  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password: string, stored: string | null | undefined): boolean {
    if (!stored) return false;
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const calc = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(calc, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  signToken(partnerId: string, orgId: string): string {
    return jwt.sign({ sub: partnerId, orgId, kind: 'ds_partner' }, this.secret, {
      expiresIn: this.expiry,
    } as jwt.SignOptions);
  }

  verifyToken(token: string): DsPartnerContext {
    const payload = jwt.verify(token, this.secret) as any;
    if (payload?.kind !== 'ds_partner') throw new Error('wrong token kind');
    return { partnerId: payload.sub, orgId: payload.orgId };
  }

  /** Aus dem Authorization-Header den Partner-Kontext ziehen. */
  extractContext(authHeader: string | undefined): DsPartnerContext {
    if (!authHeader) throw new HttpException('No token', HttpStatus.UNAUTHORIZED);
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new HttpException('Invalid auth', HttpStatus.UNAUTHORIZED);
    }
    try {
      return this.verifyToken(parts[1]);
    } catch {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }
}
