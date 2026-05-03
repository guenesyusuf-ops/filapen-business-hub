import {
  Controller, Get, Post, Put, Delete, Param, Body, Headers, Logger,
  HttpException, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { WhiteboardService } from './whiteboard.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000099';

@Controller('whiteboard')
export class WhiteboardController {
  private readonly logger = new Logger(WhiteboardController.name);

  constructor(
    private readonly service: WhiteboardService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private extractUserId(authHeader: string | undefined): string {
    if (!authHeader) return DEV_USER_ID;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return DEV_USER_ID;
    try { return this.auth.validateToken(parts[1]).sub; } catch { return DEV_USER_ID; }
  }

  // CRUD --------------------------------------------------------------

  @Get('boards')
  async list() {
    try {
      return await this.service.list();
    } catch (err: any) {
      this.logger.error(`list failed: ${err?.message ?? err}`);
      throw new HttpException('Whiteboards konnten nicht geladen werden', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('boards/:id')
  async get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post('boards')
  async create(
    @Headers('authorization') authHeader: string,
    @Body() body: { title: string; description?: string; template?: any },
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.create(userId, body);
  }

  @Put('boards/:id')
  async update(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { title?: string; description?: string; state?: any; thumbnailUrl?: string | null },
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.update(id, userId, body);
  }

  @Delete('boards/:id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // Snapshots --------------------------------------------------------

  @Get('boards/:id/snapshots')
  async listSnapshots(@Param('id') id: string) {
    return this.service.listSnapshots(id);
  }

  @Post('boards/:id/snapshots/:snapshotId/restore')
  async restoreSnapshot(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Param('snapshotId') snapshotId: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.restoreSnapshot(id, snapshotId, userId);
  }

  // Liveblocks Auth --------------------------------------------------

  /**
   * Frontend ruft diesen Endpoint vor Connect zum Liveblocks-Room auf.
   * Liefert ein zeitlich begrenztes Token mit room-scoped Permissions.
   * Wenn LIVEBLOCKS_SECRET_KEY nicht gesetzt → token=null, Frontend faellt
   * automatisch auf Single-User zurueck.
   */
  @Post('boards/:id/liveblocks-auth')
  async liveblocksAuth(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const userId = this.extractUserId(authHeader);
    // User-Daten holen damit andere Cursors einen Namen + Avatar sehen
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User nicht gefunden');
    const name = user.name
      || [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
      || user.email.split('@')[0];
    return this.service.createLiveblocksAuthToken(id, {
      userId,
      name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? undefined,
    });
  }
}
