import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { extractAuthContext, assertCanWrite } from '../shipping/auth-context';
import { AuthService } from '../auth/auth.service';
import { PasswordService, CreateEntryInput, UpdateEntryInput } from './password.service';

function auditCtx(req?: Request) {
  const ip =
    (req?.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req?.socket?.remoteAddress ||
    null;
  const userAgent = (req?.headers['user-agent'] as string | undefined) || null;
  return { ip: ip || undefined, userAgent: userAgent || undefined };
}

@Controller('passwords')
export class PasswordController {
  constructor(
    private readonly auth: AuthService,
    private readonly service: PasswordService,
  ) {}

  // ========================================================================
  // Categories
  // ========================================================================

  @Get('categories')
  async listCategories(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.service.listCategories(orgId);
  }

  @Post('categories')
  async createCategory(
    @Headers('authorization') authHeader: string,
    @Body() body: { name: string; color?: string; icon?: string | null },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.service.createCategory(orgId, body);
  }

  @Put('categories/:id')
  async updateCategory(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string; icon?: string | null; sortOrder?: number },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.service.updateCategory(orgId, id, body);
  }

  @Delete('categories/:id')
  async deleteCategory(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.service.deleteCategory(orgId, id);
  }

  // ========================================================================
  // Entries
  // ========================================================================

  @Get()
  async listEntries(
    @Headers('authorization') authHeader: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    return this.service.listEntries(orgId, userId, role, {
      search: search?.trim() || undefined,
      categoryId: categoryId || undefined,
    });
  }

  @Post()
  async createEntry(
    @Headers('authorization') authHeader: string,
    @Body() body: CreateEntryInput,
    @Req() req: Request,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body?.title || !body?.password) {
      throw new BadRequestException('title und password erforderlich');
    }
    return this.service.createEntry(orgId, userId, body, auditCtx(req));
  }

  @Put(':id')
  async updateEntry(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: UpdateEntryInput,
    @Req() req: Request,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.service.updateEntry(orgId, userId, role, id, body, auditCtx(req));
  }

  @Delete(':id')
  async deleteEntry(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.service.deleteEntry(orgId, userId, role, id, auditCtx(req));
  }

  /**
   * Passwort im Klartext holen. Wird vollstaendig auditiert.
   * Frontend loescht die Zwischenablage nach 30s (client-seitig).
   */
  @Post(':id/reveal')
  async reveal(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    return this.service.revealPassword(orgId, userId, role, id, auditCtx(req));
  }

  @Post(':id/access')
  async setAccess(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { userIds: string[] },
    @Req() req: Request,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.service.setAccess(orgId, userId, role, id, body?.userIds ?? [], auditCtx(req));
  }

  // ========================================================================
  // Audit + Health
  // ========================================================================

  @Get('team/users')
  async listTeam(@Headers('authorization') authHeader: string) {
    const { orgId, userId } = extractAuthContext(authHeader, this.auth);
    return this.service.listOrgUsers(orgId, userId);
  }

  @Post('bulk/grant')
  async bulkGrant(
    @Headers('authorization') authHeader: string,
    @Body() body: { entryIds: string[]; userIds: string[] },
    @Req() req: Request,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.service.bulkGrantAccess(
      orgId, userId, role, body?.entryIds ?? [], body?.userIds ?? [], auditCtx(req),
    );
  }

  @Post('bulk/revoke')
  async bulkRevoke(
    @Headers('authorization') authHeader: string,
    @Body() body: { targetUserId: string; entryIds?: string[] },
    @Req() req: Request,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body?.targetUserId) throw new BadRequestException('targetUserId erforderlich');
    return this.service.bulkRevokeAccess(
      orgId, userId, role, body.targetUserId, body.entryIds, auditCtx(req),
    );
  }

  @Get('audit/list')
  async listAudit(
    @Headers('authorization') authHeader: string,
    @Query('entryId') entryId?: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.service.listAudit(orgId, {
      entryId: entryId || undefined,
      userId: userId || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('health/summary')
  async health(@Headers('authorization') authHeader: string) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    return this.service.health(orgId, userId, role);
  }
}
