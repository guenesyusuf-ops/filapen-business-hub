import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

export interface ProfitAnalysisAuthContext {
  userId: string;
  orgId: string;
  role: string;
}

export function extractAuthContext(
  authHeader: string | undefined,
  auth: AuthService,
): ProfitAnalysisAuthContext {
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

/**
 * Nur Owner darf gesperrte Monate wieder oeffnen (Master-Prompt §42).
 * Admins duerfen normal bearbeiten, aber KEINE lock/unlock-Aktion.
 */
export function assertIsOwner(role: string) {
  if (role !== 'owner') {
    throw new HttpException('Nur der Owner der Organisation darf diese Aktion ausfuehren', HttpStatus.FORBIDDEN);
  }
}
