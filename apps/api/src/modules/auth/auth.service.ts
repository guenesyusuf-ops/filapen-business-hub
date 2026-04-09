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
    role: string;
    orgId: string;
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
   * Register the first admin account. Only works if no users exist yet.
   */
  async register(params: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthResponse> {
    const hasUsers = await this.hasAnyUsers();
    if (hasUsers) {
      throw new ConflictException(
        'Admin account already exists. Use login instead.',
      );
    }

    // Ensure the dev org exists
    await this.ensureDevOrg();

    const passwordHash = hashPassword(params.password);

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

  /**
   * Login with email + password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email, status: 'active' },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last active
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

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
      role: user.role,
      orgId: user.orgId,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Change password for authenticated user
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
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
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
        role: user.role,
        orgId: user.orgId,
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
