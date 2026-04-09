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
    @Body() body: { email: string; role?: UserRole },
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
    );
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
