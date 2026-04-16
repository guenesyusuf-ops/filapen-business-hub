import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { HomeService } from './home.service';
import { AuthService } from '../auth/auth.service';

@Controller('home')
export class HomeController {
  private readonly logger = new Logger(HomeController.name);

  constructor(
    private readonly home: HomeService,
    private readonly auth: AuthService,
  ) {}

  private extractUserId(authHeader: string | undefined): string {
    if (!authHeader) throw new HttpException('No token', HttpStatus.UNAUTHORIZED);
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new HttpException('Invalid authorization header', HttpStatus.UNAUTHORIZED);
    }
    try {
      const payload = this.auth.validateToken(parts[1]);
      return payload.sub;
    } catch {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }

  // -------------------------------------------------------------------------
  // Notes
  // -------------------------------------------------------------------------

  @Get('notes')
  async listNotes(@Headers('authorization') authHeader: string) {
    const userId = this.extractUserId(authHeader);
    return this.home.listNotes(userId);
  }

  @Post('notes')
  async createNote(
    @Headers('authorization') authHeader: string,
    @Body() body: { content: string; color?: string },
  ) {
    const userId = this.extractUserId(authHeader);
    if (!body.content || !body.content.trim()) {
      throw new BadRequestException('Inhalt darf nicht leer sein');
    }
    return this.home.createNote(userId, body);
  }

  @Put('notes/:id')
  async updateNote(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { content?: string; pinned?: boolean; color?: string | null },
  ) {
    const userId = this.extractUserId(authHeader);
    return this.home.updateNote(userId, id, body);
  }

  @Delete('notes/:id')
  async deleteNote(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.home.deleteNote(userId, id);
  }

  // -------------------------------------------------------------------------
  // Calendar events
  // -------------------------------------------------------------------------

  @Get('calendar')
  async listEvents(
    @Headers('authorization') authHeader: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.home.listEvents(userId, from, to);
  }

  @Post('calendar')
  async createEvent(
    @Headers('authorization') authHeader: string,
    @Body() body: {
      title: string;
      description?: string;
      startsAt: string;
      endsAt?: string;
      allDay?: boolean;
      reminderAt?: string;
      color?: string;
    },
  ) {
    const userId = this.extractUserId(authHeader);
    if (!body.title || !body.title.trim()) {
      throw new BadRequestException('Titel fehlt');
    }
    if (!body.startsAt) {
      throw new BadRequestException('Startdatum fehlt');
    }
    return this.home.createEvent(userId, body);
  }

  @Put('calendar/:id')
  async updateEvent(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.home.updateEvent(userId, id, body);
  }

  @Delete('calendar/:id')
  async deleteEvent(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.home.deleteEvent(userId, id);
  }
}
