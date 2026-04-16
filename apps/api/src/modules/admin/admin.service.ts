import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

function generateTempPassword(): string {
  // 10-char password: mix of letters and digits, excluding ambiguous (0/O, 1/l/I)
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

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
        menuPermissions: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Invite a user by email. Creates a TeamInvite record with a temp password
   * and sends an email. When the user logs in with the temp password we create
   * the actual User record (see AuthService.loginWithInvite).
   */
  async inviteTeamMember(
    orgId: string,
    invitedBy: string,
    email: string,
    role: UserRole,
    menuPermissions: string[] = [],
  ) {
    // Check for existing active user with this email
    const existingUser = await this.prisma.user.findFirst({
      where: { orgId, email },
    });

    if (existingUser) {
      throw new ConflictException('Ein Benutzer mit dieser E-Mail-Adresse existiert bereits');
    }

    // Remove any expired/stale invite for this email so we don't collide
    await this.prisma.teamInvite.deleteMany({
      where: { orgId, email, status: 'pending' },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    // Admins get all permissions (empty array means "all" for mitarbeiter)
    const finalPermissions = role === 'admin' || role === 'owner' ? [] : menuPermissions;

    const tempPassword = generateTempPassword();
    const tempPasswordHash = hashPassword(tempPassword);

    const invite = await this.prisma.teamInvite.create({
      data: {
        orgId,
        email,
        role,
        menuPermissions: finalPermissions,
        tempPasswordHash,
        invitedBy,
        status: 'pending',
        expiresAt,
      },
    });

    // Fire-and-log the email: don't block the API call if email service fails
    const webUrl = this.config.get<string>('WEB_APP_URL', 'https://filapen.vercel.app');
    const loginLink = `${webUrl}/login?invite=${invite.id}`;
    const roleLabel = role === 'admin' || role === 'owner' ? 'Admin' : 'Mitarbeiter';
    await this.email.sendTeamInviteWithTempPassword({
      to: email,
      roleLabel,
      tempPassword,
      loginLink,
    });

    return invite;
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
   * Update a user's menu permissions.
   * Admins/owners always have full access (menuPermissions is ignored for them).
   */
  async updateMenuPermissions(
    orgId: string,
    userId: string,
    menuPermissions: string[],
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, orgId },
    });

    if (!user) {
      throw new NotFoundException('User not found in this organization');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { menuPermissions },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        menuPermissions: true,
      },
    });
  }

  /**
   * Cancel a pending invite.
   */
  async cancelInvite(orgId: string, inviteId: string) {
    const invite = await this.prisma.teamInvite.findFirst({
      where: { id: inviteId, orgId },
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    await this.prisma.teamInvite.delete({ where: { id: inviteId } });
    return { success: true };
  }

  /**
   * List users with pending status awaiting approval.
   */
  async listPendingUsers(orgId: string) {
    return this.prisma.user.findMany({
      where: { orgId, status: 'pending' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Count users with pending status.
   */
  async countPendingUsers(orgId: string): Promise<number> {
    return this.prisma.user.count({
      where: { orgId, status: 'pending' },
    });
  }

  /**
   * Approve a pending user, optionally assigning a role.
   */
  async approveUser(orgId: string, userId: string, role?: UserRole) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, orgId, status: 'pending' },
    });

    if (!user) {
      throw new NotFoundException('Pending user not found in this organization');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'active',
        ...(role && { role }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Reject a pending user.
   */
  async rejectUser(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, orgId, status: 'pending' },
    });

    if (!user) {
      throw new NotFoundException('Pending user not found in this organization');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'rejected' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * List recently approved/rejected users (last 30 days).
   */
  async listRecentlyReviewedUsers(orgId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.user.findMany({
      where: {
        orgId,
        status: { in: ['active', 'rejected'] },
        createdAt: { gte: thirtyDaysAgo },
        // Exclude the first owner (auto-approved)
        role: { not: 'owner' },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
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
