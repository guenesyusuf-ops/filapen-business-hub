import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { UserRole } from '@prisma/client';

interface AuthenticatedRequest {
  userId: string;
  orgId: string;
}

const VALID_ROLES: UserRole[] = ['owner', 'admin', 'member', 'viewer'];

@Controller('admin')
export class AdminController {
  private readonly DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

  constructor(private readonly adminService: AdminService) {}

  @Get('team')
  async listTeam() {
    const orgId = this.DEV_ORG_ID;
    const members = await this.adminService.listTeamMembers(this.DEV_ORG_ID);
    const invites = await this.adminService.listPendingInvites(this.DEV_ORG_ID);
    return { members, invites };
  }

  @Post('team/invite')
  @HttpCode(HttpStatus.CREATED)
  async inviteTeamMember(
    @Body() body: { email: string; role?: UserRole; menuPermissions?: string[] },
  ) {
    if (!body.email || !body.email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }

    const role = body.role ?? 'member';
    if (!VALID_ROLES.includes(role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    return this.adminService.inviteTeamMember(
      this.DEV_ORG_ID,
      '00000000-0000-0000-0000-000000000002',
      body.email.toLowerCase().trim(),
      role,
      Array.isArray(body.menuPermissions) ? body.menuPermissions : [],
    );
  }

  @Put('team/:userId/permissions')
  async updatePermissions(
    @Param('userId') userId: string,
    @Body() body: { menuPermissions: string[] },
  ) {
    if (!Array.isArray(body.menuPermissions)) {
      throw new BadRequestException('menuPermissions must be an array');
    }
    return this.adminService.updateMenuPermissions(
      this.DEV_ORG_ID,
      userId,
      body.menuPermissions,
    );
  }

  @Delete('team/invite/:inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelInvite(@Param('inviteId') inviteId: string) {
    await this.adminService.cancelInvite(this.DEV_ORG_ID, inviteId);
  }

  @Delete('team/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTeamMember(
    @Param('userId') userId: string,
  ) {
    await this.adminService.removeTeamMember(this.DEV_ORG_ID, userId);
  }

  @Put('team/:userId/role')
  async changeRole(
    @Param('userId') userId: string,
    @Body() body: { role: UserRole },
  ) {
    if (!body.role || !VALID_ROLES.includes(body.role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    return this.adminService.changeUserRole(this.DEV_ORG_ID, userId, body.role);
  }

  @Get('pending-users')
  async listPendingUsers() {
    return this.adminService.listPendingUsers(this.DEV_ORG_ID);
  }

  @Get('pending-users/count')
  async countPendingUsers() {
    const count = await this.adminService.countPendingUsers(this.DEV_ORG_ID);
    return { count };
  }

  @Put('approve-user/:userId')
  async approveUser(
    @Param('userId') userId: string,
    @Body() body: { role?: UserRole },
  ) {
    const role = body.role;
    if (role && !VALID_ROLES.includes(role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }
    return this.adminService.approveUser(this.DEV_ORG_ID, userId, role);
  }

  @Put('reject-user/:userId')
  async rejectUser(@Param('userId') userId: string) {
    return this.adminService.rejectUser(this.DEV_ORG_ID, userId);
  }

  @Get('reviewed-users')
  async listReviewedUsers() {
    return this.adminService.listRecentlyReviewedUsers(this.DEV_ORG_ID);
  }

  @Get('settings')
  async getSettings() {
    return this.adminService.getOrgSettings(this.DEV_ORG_ID);
  }

  @Put('settings')
  async updateSettings(
    @Body() body: {
      name?: string;
      currency?: string;
      timezone?: string;
      settings?: Record<string, unknown>;
    },
  ) {
    return this.adminService.updateOrgSettings(this.DEV_ORG_ID, body);
  }
}
