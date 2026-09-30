import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { extractAdminAuth, assertIsAdmin } from './admin-auth';
import { UserRole } from '@prisma/client';

const VALID_ROLES: UserRole[] = ['owner', 'admin', 'member', 'viewer'];

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Zentrale Absicherung fuer jede Admin-Route: authentifizieren und
   * Owner/Admin-Rolle verlangen, dann den Auth-Kontext zurueckgeben.
   *
   * orgId kommt aus dem Token, nicht mehr aus einem hartcodierten Wert —
   * damit ist die Organisation an den angemeldeten Nutzer gebunden. Da aktuell
   * nur eine Organisation existiert und alle Tokens deren orgId tragen, ist das
   * fuer bestehende Nutzer verhaltensgleich und zugleich korrekt gescoped.
   */
  private requireAdmin(authHeader: string | undefined) {
    const ctx = extractAdminAuth(authHeader, this.auth);
    assertIsAdmin(ctx.role);
    return ctx;
  }

  @Get('team')
  async listTeam(@Headers('authorization') authHeader?: string) {
    const ctx = this.requireAdmin(authHeader);
    const members = await this.adminService.listTeamMembers(ctx.orgId);
    const invites = await this.adminService.listPendingInvites(ctx.orgId);
    return { members, invites };
  }

  @Post('team/invite')
  @HttpCode(HttpStatus.CREATED)
  async inviteTeamMember(
    @Body() body: { email: string; role?: UserRole; menuPermissions?: string[] },
    @Headers('authorization') authHeader?: string,
  ) {
    const ctx = this.requireAdmin(authHeader);

    if (!body.email || !body.email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }

    const role = body.role ?? 'member';
    if (!VALID_ROLES.includes(role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    return this.adminService.inviteTeamMember(
      ctx.orgId,
      ctx.userId,
      body.email.toLowerCase().trim(),
      role,
      Array.isArray(body.menuPermissions) ? body.menuPermissions : [],
    );
  }

  @Put('team/:userId/permissions')
  async updatePermissions(
    @Param('userId') userId: string,
    @Body() body: { menuPermissions: string[] },
    @Headers('authorization') authHeader?: string,
  ) {
    const ctx = this.requireAdmin(authHeader);
    if (!Array.isArray(body.menuPermissions)) {
      throw new BadRequestException('menuPermissions must be an array');
    }
    return this.adminService.updateMenuPermissions(
      ctx.orgId,
      userId,
      body.menuPermissions,
    );
  }

  @Delete('team/invite/:inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelInvite(
    @Param('inviteId') inviteId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const ctx = this.requireAdmin(authHeader);
    await this.adminService.cancelInvite(ctx.orgId, inviteId);
  }

  @Delete('team/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTeamMember(
    @Param('userId') userId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const ctx = this.requireAdmin(authHeader);
    await this.adminService.removeTeamMember(ctx.orgId, userId);
  }

  @Put('team/:userId/role')
  async changeRole(
    @Param('userId') userId: string,
    @Body() body: { role: UserRole },
    @Headers('authorization') authHeader?: string,
  ) {
    const ctx = this.requireAdmin(authHeader);

    if (!body.role || !VALID_ROLES.includes(body.role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    return this.adminService.changeUserRole(ctx.orgId, userId, body.role);
  }

  @Get('pending-users')
  async listPendingUsers(@Headers('authorization') authHeader?: string) {
    const ctx = this.requireAdmin(authHeader);
    return this.adminService.listPendingUsers(ctx.orgId);
  }

  @Get('pending-users/count')
  async countPendingUsers(@Headers('authorization') authHeader?: string) {
    const ctx = this.requireAdmin(authHeader);
    const count = await this.adminService.countPendingUsers(ctx.orgId);
    return { count };
  }

  @Put('approve-user/:userId')
  async approveUser(
    @Param('userId') userId: string,
    @Body() body: { role?: UserRole },
    @Headers('authorization') authHeader?: string,
  ) {
    const ctx = this.requireAdmin(authHeader);
    const role = body.role;
    if (role && !VALID_ROLES.includes(role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }
    return this.adminService.approveUser(ctx.orgId, userId, role);
  }

  @Put('reject-user/:userId')
  async rejectUser(
    @Param('userId') userId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const ctx = this.requireAdmin(authHeader);
    return this.adminService.rejectUser(ctx.orgId, userId);
  }

  @Get('reviewed-users')
  async listReviewedUsers(@Headers('authorization') authHeader?: string) {
    const ctx = this.requireAdmin(authHeader);
    return this.adminService.listRecentlyReviewedUsers(ctx.orgId);
  }

  @Get('settings')
  async getSettings(@Headers('authorization') authHeader?: string) {
    const ctx = this.requireAdmin(authHeader);
    return this.adminService.getOrgSettings(ctx.orgId);
  }

  @Put('settings')
  async updateSettings(
    @Body() body: {
      name?: string;
      currency?: string;
      timezone?: string;
      settings?: Record<string, unknown>;
    },
    @Headers('authorization') authHeader?: string,
  ) {
    const ctx = this.requireAdmin(authHeader);
    return this.adminService.updateOrgSettings(ctx.orgId, body);
  }
}
