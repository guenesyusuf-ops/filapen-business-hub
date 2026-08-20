import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { ImportService, ImportPreviewRow } from './import.service';
import { PaAuditService } from './audit.service';

@Controller('profit-analysis/import')
export class ImportController {
  constructor(
    private readonly auth: AuthService,
    private readonly imp: ImportService,
    private readonly audit: PaAuditService,
  ) {}

  @Post('preview')
  preview(@Headers('authorization') authHeader: string, @Body() body: { csv: string }) {
    extractAuthContext(authHeader, this.auth);
    if (!body?.csv) throw new BadRequestException('csv fehlt');
    return this.imp.preview(body.csv);
  }

  @Post('confirm')
  async confirm(@Headers('authorization') authHeader: string, @Body() body: { rows: ImportPreviewRow[] }) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body?.rows) throw new BadRequestException('rows fehlt');
    const result = await this.imp.confirm(orgId, role, body.rows);
    await this.audit.log({
      orgId, userId,
      action: 'import.confirm', entityType: 'pa.import',
      entityId: new Date().toISOString(),
      changes: { rowCount: body.rows.length, ...result },
    });
    return result;
  }
}
