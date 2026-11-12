import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

export interface DsAuthContext {
  userId: string;
  orgId: string;
  role: string;
}

/** Hub-interner Zugang (Owner/Admin/Mitarbeiter) — identisch zum pa-Muster. */
export function extractAuthContext(
  authHeader: string | undefined,
  auth: AuthService,
): DsAuthContext {
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

/** Nur-Lese-Rolle darf nichts verändern. */
export function assertCanWrite(role: string) {
  if (role === 'viewer') {
    throw new HttpException('Nur-Lese-Rolle darf keine Aenderungen vornehmen', HttpStatus.FORBIDDEN);
  }
}
