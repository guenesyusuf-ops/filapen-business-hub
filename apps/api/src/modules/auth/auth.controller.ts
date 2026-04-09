import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Login with email + password, returns JWT
   */
  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    if (!body.email || !body.password) {
      throw new HttpException(
        'Email and password are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.authService.login(body.email, body.password);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Login failed', error);
      throw new HttpException('Login failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/auth/register
   * Create the first admin account. Only works when no users exist.
   */
  @Post('register')
  async register(
    @Body() body: { email: string; password: string; name: string },
  ) {
    if (!body.email || !body.password || !body.name) {
      throw new HttpException(
        'Email, password, and name are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (body.password.length < 8) {
      throw new HttpException(
        'Password must be at least 8 characters',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.authService.register(body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Registration failed', error);
      throw new HttpException(
        'Registration failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/auth/me
   * Returns the currently authenticated user from the JWT
   */
  @Get('me')
  async me(@Headers('authorization') authHeader: string) {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new HttpException('No token provided', HttpStatus.UNAUTHORIZED);
    }

    try {
      const payload = this.authService.validateToken(token);
      return await this.authService.getUserById(payload.sub);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * POST /api/auth/change-password
   */
  @Post('change-password')
  async changePassword(
    @Headers('authorization') authHeader: string,
    @Body()
    body: { currentPassword: string; newPassword: string },
  ) {
    const token = this.extractToken(authHeader);
    if (!token) {
      throw new HttpException('No token provided', HttpStatus.UNAUTHORIZED);
    }

    if (!body.currentPassword || !body.newPassword) {
      throw new HttpException(
        'Current and new passwords are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (body.newPassword.length < 8) {
      throw new HttpException(
        'New password must be at least 8 characters',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const payload = this.authService.validateToken(token);
      return await this.authService.changePassword(
        payload.sub,
        body.currentPassword,
        body.newPassword,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Failed to change password',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/auth/status
   * Returns whether any users exist (for first-time setup detection)
   */
  @Get('status')
  async status() {
    const hasUsers = await this.authService.hasAnyUsers();
    return { hasUsers, setupRequired: !hasUsers };
  }

  // ---------------------------------------------------------------------------

  private extractToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    return parts[1];
  }
}
