import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

interface AuthenticatedRequest extends Request {
  userId?: string;
  orgId?: string | null;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
    const orgId = req.orgId;

    if (orgId) {
      try {
        await this.prisma.$executeRawUnsafe(
          `SET LOCAL app.current_org_id = '${orgId.replace(/'/g, "''")}'`,
        );
      } catch (error) {
        console.error('Failed to set tenant context:', error);
      }
    }

    next();
  }
}
