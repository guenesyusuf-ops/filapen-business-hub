import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Simple password hashing using Node.js built-in crypto (no bcrypt dep needed)
// Uses PBKDF2 with 100k iterations — production-grade without native modules
// ---------------------------------------------------------------------------

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface JwtPayload {
  sub: string; // user id
  email: string;
  name: string | null;
  role: string;
  orgId: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    avatarUrl: string | null;
    role: string;
    status: string;
    orgId: string;
    menuPermissions: string[];
    mustChangePassword: boolean;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = this.config.get<string>(
      'JWT_SECRET',
      'filapen-jwt-secret-change-me',
    );
  }

  /**
   * Check if any admin users exist in the system.
   * Used to gate the registration endpoint.
   */
  async hasAnyUsers(): Promise<boolean> {
    const count = await this.prisma.user.count();
    return count > 0;
  }

  /**
   * Register a new user account.
   * - First user ever: auto-approved as owner
   * - Invite-based: auto-approved with invited role
   * - Public self-registration: pending approval
   */
  async register(params: {
    email: string;
    password: string;
    name: string;
    inviteToken?: string;
  }): Promise<AuthResponse> {
    // Ensure the dev org exists
    await this.ensureDevOrg();

    // Check for existing user with same email in org
    const existingUser = await this.prisma.user.findFirst({
      where: { orgId: DEV_ORG_ID, email: params.email },
    });
    if (existingUser) {
      throw new ConflictException(
        'An account with this email already exists.',
      );
    }

    const userCount = await this.prisma.user.count();
    const passwordHash = hashPassword(params.password);

    // First user ever → auto-approve as owner
    if (userCount === 0) {
      const user = await this.prisma.user.create({
        data: {
          orgId: DEV_ORG_ID,
          email: params.email,
          name: params.name,
          clerkUserId: `local-${crypto.randomUUID()}`,
          passwordHash,
          role: 'owner',
          status: 'active',
        },
      });
      return this.createAuthResponse(user);
    }

    // Check if registering via invite token
    if (params.inviteToken) {
      const invite = await this.prisma.teamInvite.findFirst({
        where: {
          id: params.inviteToken,
          status: 'pending',
          email: params.email,
        },
      });

      if (invite && new Date() < invite.expiresAt) {
        const user = await this.prisma.user.create({
          data: {
            orgId: invite.orgId,
            email: params.email,
            name: params.name,
            clerkUserId: `local-${crypto.randomUUID()}`,
            passwordHash,
            role: invite.role,
            status: 'active',
          },
        });

        // Mark invite as accepted
        await this.prisma.teamInvite.update({
          where: { id: invite.id },
          data: { status: 'accepted' },
        });

        return this.createAuthResponse(user);
      }
      // If invite token is invalid/expired, fall through to pending registration
      this.logger.warn(`Invalid or expired invite token for ${params.email}`);
    }

    // Public self-registration → pending status
    const user = await this.prisma.user.create({
      data: {
        orgId: DEV_ORG_ID,
        email: params.email,
        name: params.name,
        clerkUserId: `local-${crypto.randomUUID()}`,
        passwordHash,
        role: 'viewer',
        status: 'pending',
      },
    });

    return this.createAuthResponse(user);
  }

  /**
   * Login with email + password.
   * If there is a pending TeamInvite with matching email + temp password,
   * the invite is consumed and a new User is created (menuPermissions applied,
   * mustChangePassword=true).
   * Allows pending/rejected users to log in so the frontend can display their status.
   * Only suspended/deactivated users are blocked entirely.
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email },
    });

    // If user doesn't exist yet, try to consume a pending invite (temp password login)
    if (!user) {
      const invite = await this.prisma.teamInvite.findFirst({
        where: { email, status: 'pending' },
      });

      if (invite && invite.tempPasswordHash && verifyPassword(password, invite.tempPasswordHash)) {
        if (new Date() > invite.expiresAt) {
          throw new UnauthorizedException('Die Einladung ist abgelaufen. Bitte kontaktiere einen Administrator.');
        }

        const newUser = await this.prisma.user.create({
          data: {
            orgId: invite.orgId,
            email: invite.email,
            name: invite.email.split('@')[0],
            clerkUserId: `local-${crypto.randomUUID()}`,
            passwordHash: invite.tempPasswordHash,
            role: invite.role,
            status: 'active',
            menuPermissions: invite.menuPermissions ?? [],
            mustChangePassword: true,
          },
        });

        await this.prisma.teamInvite.update({
          where: { id: invite.id },
          data: { status: 'accepted' },
        });

        // If this user has Work Management access (admin or explicit permission),
        // add them to ALL existing WM projects so they show up in assignee lists.
        const hasWmAccess =
          invite.role === 'admin' ||
          invite.role === 'owner' ||
          (invite.menuPermissions ?? []).includes('work-management');
        if (hasWmAccess) {
          const projects = await this.prisma.wmProject.findMany({
            where: { orgId: invite.orgId },
            select: { id: true },
          });
          if (projects.length > 0) {
            await this.prisma.wmProjectMember.createMany({
              data: projects.map((p) => ({
                projectId: p.id,
                userId: newUser.id,
                userName: newUser.name || newUser.email.split('@')[0],
                role: 'member',
              })),
              skipDuplicates: true,
            });
          }
        }

        return this.createAuthResponse(newUser);
      }

      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Block suspended/deactivated users entirely
    if (user.status === 'suspended' || user.status === 'deactivated') {
      throw new UnauthorizedException('Your account has been suspended. Please contact the administrator.');
    }

    // Update last active only for active users
    if (user.status === 'active') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      });
    }

    return this.createAuthResponse(user);
  }

  /**
   * Validate a JWT and return the payload
   */
  validateToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Get user by ID (for /me endpoint)
   */
  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      phone: user.phone ?? null,
      role: user.role,
      status: user.status,
      orgId: user.orgId,
      avatarUrl: user.avatarUrl,
      menuPermissions: user.menuPermissions ?? [],
      mustChangePassword: user.mustChangePassword ?? false,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Update own profile (firstName, lastName, phone, avatarUrl).
   * Email and role are not self-editable.
   */
  async updateProfile(
    userId: string,
    data: {
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      avatarUrl?: string | null;
    },
  ) {
    // Validate avatar payload — accept either a remote URL or a data URL,
    // and cap size so we don't bloat the DB with enormous base64 blobs.
    if (data.avatarUrl && data.avatarUrl.length > 0) {
      const isDataUrl = data.avatarUrl.startsWith('data:image/');
      const isHttpUrl = data.avatarUrl.startsWith('http://') || data.avatarUrl.startsWith('https://');
      if (!isDataUrl && !isHttpUrl) {
        throw new ConflictException('Ungueltiges Bild-Format');
      }
      // 400KB base64 cap (~300KB actual image) — protect the DB row size
      if (data.avatarUrl.length > 400_000) {
        throw new ConflictException('Bild zu gross. Bitte ein kleineres Bild verwenden (max 300KB).');
      }
    }

    // Derive `name` from firstName + lastName so the rest of the app keeps working
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new UnauthorizedException('User not found');
    }
    const nextFirstName = data.firstName !== undefined ? data.firstName : existing.firstName;
    const nextLastName = data.lastName !== undefined ? data.lastName : existing.lastName;
    const derivedName =
      [nextFirstName, nextLastName].filter(Boolean).join(' ').trim() || existing.name;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName || null }),
        ...(data.lastName !== undefined && { lastName: data.lastName || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl || null }),
        name: derivedName,
      },
    });

    return this.getUserById(updated.id);
  }

  /**
   * Change password for authenticated user.
   * Also clears the mustChangePassword flag so the forced-change guard stops firing.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('User not found');
    }

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Aktuelles Passwort ist falsch');
    }

    if (currentPassword === newPassword) {
      throw new ConflictException('Neues Passwort muss sich vom aktuellen unterscheiden');
    }

    const passwordHash = hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private createAuthResponse(user: any): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
    };

    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        phone: user.phone ?? null,
        avatarUrl: user.avatarUrl ?? null,
        role: user.role,
        status: user.status,
        orgId: user.orgId,
        menuPermissions: user.menuPermissions ?? [],
        mustChangePassword: user.mustChangePassword ?? false,
      },
    };
  }

  private async ensureDevOrg(): Promise<void> {
    const existing = await this.prisma.organization.findUnique({
      where: { id: DEV_ORG_ID },
    });

    if (!existing) {
      await this.prisma.organization.create({
        data: {
          id: DEV_ORG_ID,
          name: 'Filapen',
          slug: 'filapen',
          plan: 'free',
        },
      });
    }
  }
}
