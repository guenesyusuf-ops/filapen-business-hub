import {
  Controller, Get, Post, Param, Body, Headers, Logger, BadRequestException,
} from '@nestjs/common';
import { ScreenShareService } from './screen-share.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000099';

@Controller('screen-share')
export class ScreenShareController {
  private readonly logger = new Logger(ScreenShareController.name);

  constructor(
    private readonly service: ScreenShareService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private extractUserId(authHeader: string | undefined): string {
    if (!authHeader) return DEV_USER_ID;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return DEV_USER_ID;
    try { return this.auth.validateToken(parts[1]).sub; } catch { return DEV_USER_ID; }
  }

  // Sessions ---------------------------------------------------------

  @Post('start')
  async start(
    @Headers('authorization') authHeader: string,
    @Body() body: {
      sessionName?: string;
      audioEnabled?: boolean;
      voiceEnabled?: boolean;
      invitedUserIds?: string[];
    },
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.startSession(userId, body);
  }

  /** Public-Endpoint — kein Auth-Header noetig.
   *  WICHTIG: muss VOR @Post(':id/join') stehen, sonst matcht NestJS
   *  /public/join gegen :id/join mit id="public" und kommt nie hier
   *  an (führt zu "User nicht gefunden", weil :id/join Auth braucht). */
  @Post('public/join')
  async joinAsGuest(
    @Body() body: { token: string; name: string; password?: string },
  ) {
    if (!body.token) throw new BadRequestException('Token fehlt');
    return this.service.joinAsGuest(body.token, body.name, body.password);
  }

  @Post(':id/end')
  async end(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.endSession(id, userId);
  }

  @Post(':id/join')
  async join(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const userId = this.extractUserId(authHeader);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User nicht gefunden');
    const name = user.name
      || [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
      || user.email.split('@')[0];
    return this.service.joinSession(id, { id: userId, name, avatarUrl: user.avatarUrl });
  }

  @Post(':id/decline')
  async decline(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.declineInvite(id, userId);
  }

  @Post(':id/leave')
  async leave(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.leaveSession(id, userId);
  }

  @Get('active')
  async listActive() {
    return this.service.listActive();
  }

  @Get('history')
  async listHistory() {
    return this.service.listHistory();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.service.getSession(id);
  }

  // Externer Link ----------------------------------------------------

  @Post(':id/public-link')
  async createPublicLink(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { password?: string },
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.createPublicLink(id, userId, body.password);
  }

  @Post(':id/public-link/revoke')
  async revokePublicLink(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.revokePublicLink(id, userId);
  }

  // Liveblocks-Auth fuer den org-presence Broadcast-Room ----------------
  @Post('liveblocks-auth')
  async liveblocksAuth(
    @Headers('authorization') authHeader: string,
  ) {
    const userId = this.extractUserId(authHeader);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User nicht gefunden');
    const name = user.name
      || [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
      || user.email.split('@')[0];
    return this.service.createOrgPresenceLiveblocksToken({
      userId,
      name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      orgId: user.orgId,
    });
  }
}
