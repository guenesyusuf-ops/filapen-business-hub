import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

/**
 * Auth-Kontext fuer Admin-Routen.
 *
 * Bewusst dasselbe Muster wie die bereits etablierten auth-context.ts in
 * profit-analysis, shipping, purchase, sales und email-marketing — keine neue
 * Guard-Architektur, sondern die im Projekt vorhandene, funktionierende
 * JWT-Pruefung ueber AuthService.validateToken.
 *
 * WICHTIG, warum NICHT der vorhandene common/guards/auth.guard.ts verwendet
 * wird: der prueft Tokens gegen Clerk (@clerk/backend, CLERK_SECRET_KEY). Die
 * App authentifiziert aber ueber ein eigenes JWT (JWT_SECRET). Der Clerk-Guard
 * wuerde jeden echten Token ablehnen und ist deshalb toter Code — er wird
 * nirgends angewendet.
 */
export interface AdminAuthContext {
  userId: string;
  orgId: string;
  role: string;
}

export function extractAdminAuth(
  authHeader: string | undefined,
  auth: AuthService,
): AdminAuthContext {
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

/**
 * Team- und Organisationsverwaltung ist Owner/Admin vorbehalten — exakt die
 * Regel, die das Frontend bereits durchsetzt (settings/team/page.tsx:52:
 * `isAdmin = role === 'owner' || role === 'admin'`). Member und Viewer werden
 * abgelehnt.
 */
export function assertIsAdmin(role: string) {
  if (role !== 'owner' && role !== 'admin') {
    throw new HttpException(
      'Nur Owner oder Admin duerfen die Teamverwaltung nutzen',
      HttpStatus.FORBIDDEN,
    );
  }
}
