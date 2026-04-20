import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

export interface PurchaseAuthContext {
  userId: string;
  orgId: string;
  role: string;
}

export function extractAuthContext(
  authHeader: string | undefined,
  auth: AuthService,
): PurchaseAuthContext {
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

export const PURCHASE_PERMISSIONS = {
  view: 'purchases',
  create: 'purchases',
  payment: 'purchases',
  cancel: 'purchases',
  export: 'purchases',
};

export function assertCanWrite(role: string) {
  if (role === 'viewer') {
    throw new HttpException('Read-only role cannot perform this action', HttpStatus.FORBIDDEN);
  }
}

export function assertCanCancel(role: string) {
  if (role !== 'owner' && role !== 'admin') {
    throw new HttpException('Only admins can cancel orders', HttpStatus.FORBIDDEN);
  }
}
