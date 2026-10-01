import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

export interface MetaAdsAuthContext {
  userId: string;
  orgId: string;
  role: string;
}

/**
 * Echtes org-scoping aus dem Bearer-Token — gleiches, bewährtes Muster wie in
 * profit-analysis. KEIN DEV_ORG_ID-Shortcut. Jede Route ruft das auf und
 * arbeitet ausschliesslich mit der zurueckgegebenen orgId.
 */
export function extractAuthContext(
  authHeader: string | undefined,
  auth: AuthService,
): MetaAdsAuthContext {
  if (!authHeader) throw new HttpException('No token', HttpStatus.UNAUTHORIZED);
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new HttpException('Invalid auth', HttpStatus.UNAUTHORIZED);
  }
  try {
    const payload = auth.validateToken(parts[1]);
    return { userId: payload.sub, orgId: payload.orgId, role: payload.role };
  } catch {
    throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
  }
}

/** Viewer duerfen keine Werte veraendern. */
export function assertCanWrite(role: string) {
  if (role === 'viewer') {
    throw new HttpException('Nur-Lese-Rolle darf keine Aenderungen vornehmen', HttpStatus.FORBIDDEN);
  }
}
