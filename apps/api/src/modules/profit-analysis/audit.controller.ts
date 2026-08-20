import { Controller, Get, Headers, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext } from './auth-context';
import { PaAuditService } from './audit.service';

@Controller('profit-analysis/audit')
export class PaAuditController {
  constructor(private readonly auth: AuthService, private readonly audit: PaAuditService) {}

  @Get()
  async list(
    @Headers('authorization') authHeader: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    // Default: nur profit-analysis-Audit-Eintraege
    return this.audit.list(orgId, {
      entityType: entityType || 'pa.',
      entityId,
      action,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
