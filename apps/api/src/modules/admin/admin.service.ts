import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all team members for an organization.
   */
  async listTeamMembers(orgId: string) {
    return this.prisma.user.findMany({
      where: { orgId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Invite a user by email. Creates a TeamInvite record.
   */
  async inviteTeamMember(
    orgId: string,
    invitedBy: string,
    email: string,
    role: UserRole,
  ) {
    // Check for existing active user with this email
    const existingUser = await this.prisma.user.findFirst({
      where: { orgId, email },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists in the organization');
    }

    // Check for existing pending invite
    const existingInvite = await this.prisma.teamInvite.findFirst({
      where: { orgId, email, status: 'pending' },
    });

    if (existingInvite) {
      throw new ConflictException('A pending invite for this email already exists');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    return this.prisma.teamInvite.create({
      data: {
        orgId,
        email,
        role,
        invitedBy,
        status: 'pending',
        expiresAt,
      },
    });
  }

  /**
   * List pending invites for the organization.
   */
  async listPendingInvites(orgId: string) {
    return this.prisma.teamInvite.findMany({
      where: { orgId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Remove a user from the organization.
   * Cannot remove the last owner.
   */
  async removeTeamMember(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, orgId },
    });

    if (!user) {
      throw new NotFoundException('User not found in this organization');
    }

    if (user.role === 'owner') {
      const ownerCount = await this.prisma.user.count({
        where: { orgId, role: 'owner' },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException('Cannot remove the last owner of the organization');
      }
    }

    return this.prisma.user.delete({ where: { id: userId } });
  }

  /**
   * Change a user's role.
   * Cannot demote the last owner.
   */
  async changeUserRole(orgId: string, userId: string, newRole: UserRole) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, orgId },
    });

    if (!user) {
      throw new NotFoundException('User not found in this organization');
    }

    if (user.role === 'owner' && newRole !== 'owner') {
      const ownerCount = await this.prisma.user.count({
        where: { orgId, role: 'owner' },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException('Cannot demote the last owner');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });
  }

  /**
   * Get organization settings.
   */
  async getOrgSettings(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        currency: true,
        timezone: true,
        branding: true,
        settings: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  /**
   * Update organization settings.
   */
  async updateOrgSettings(
    orgId: string,
    data: {
      name?: string;
      currency?: string;
      timezone?: string;
      settings?: Record<string, unknown>;
    },
  ) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.currency && { currency: data.currency }),
        ...(data.timezone && { timezone: data.timezone }),
        ...(data.settings && { settings: data.settings as any }),
      },
    });
  }
}
