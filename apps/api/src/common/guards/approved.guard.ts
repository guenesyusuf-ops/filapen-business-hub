import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Guard that ensures the authenticated user has an 'active' status.
 *
 * Usage: Apply to routes/controllers that should only be accessible to
 * approved (active) users. Does not replace AuthGuard — use both together.
 *
 * Note: Not applied globally to avoid breaking the DEV_ORG_ID pattern
 * for endpoints that don't yet have auth. Apply per-controller or per-route:
 *
 *   @UseGuards(AuthGuard, ApprovedGuard)
 *   @Get('protected-route')
 *   async protectedRoute() { ... }
 */
@Injectable()
export class ApprovedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user is attached (route has no auth), allow through
    if (!user) return true;

    if (user.status !== 'active') {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Account not yet approved',
        status: user.status,
      });
    }

    return true;
  }
}
