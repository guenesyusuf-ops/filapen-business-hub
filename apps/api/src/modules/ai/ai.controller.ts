import {
  Controller,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthService } from '../auth/auth.service';

@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly ai: AiService,
    private readonly auth: AuthService,
  ) {}

  private extractUserId(authHeader: string | undefined): string {
    if (!authHeader) throw new HttpException('No token', HttpStatus.UNAUTHORIZED);
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new HttpException('Invalid auth header', HttpStatus.UNAUTHORIZED);
    }
    try {
      return this.auth.validateToken(parts[1]).sub;
    } catch {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('ask')
  async ask(
    @Headers('authorization') authHeader: string,
    @Body() body: { query: string },
  ) {
    const userId = this.extractUserId(authHeader);
    if (!body.query || !body.query.trim()) {
      throw new BadRequestException('Frage fehlt');
    }

    try {
      return await this.ai.ask(userId, body.query.trim());
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('AI ask failed', error);
      throw new HttpException(
        'KI-Anfrage fehlgeschlagen',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
