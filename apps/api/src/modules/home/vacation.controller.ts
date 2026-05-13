import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Headers,
  HttpException, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { VacationService } from './vacation.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('home/vacations')
export class VacationController {
  constructor(
    private readonly vacation: VacationService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private async extractContext(authHeader: string | undefined): Promise<{ userId: string; orgId: string }> {
    if (!authHeader) throw new HttpException('No token', HttpStatus.UNAUTHORIZED);
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new HttpException('Invalid authorization header', HttpStatus.UNAUTHORIZED);
    }
    let payload;
    try { payload = this.auth.validateToken(parts[1]); } catch {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
    return { userId: user.id, orgId: user.orgId };
  }

  /** Eigene Antraege */
  @Get('mine')
  async listMine(@Headers('authorization') authHeader: string) {
    const { userId, orgId } = await this.extractContext(authHeader);
    return this.vacation.myRequests(orgId, userId);
  }

  /** Pending — nur Owner/Admin */
  @Get('pending')
  async listPending(@Headers('authorization') authHeader: string) {
    const { userId, orgId } = await this.extractContext(authHeader);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    return this.vacation.pendingRequests(orgId);
  }

  /** Genehmigte im Datums-Range — fuer Kalender-Overlay */
  @Get('approved')
  async listApproved(
    @Headers('authorization') authHeader: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { orgId } = await this.extractContext(authHeader);
    if (!from || !to) throw new BadRequestException('from + to YYYY-MM-DD erforderlich');
    return this.vacation.approvedInRange(orgId, new Date(from), new Date(to));
  }

  @Post()
  async create(
    @Headers('authorization') authHeader: string,
    @Body() body: { startDate: string; endDate: string; reason?: string },
  ) {
    const { userId, orgId } = await this.extractContext(authHeader);
    return this.vacation.create(orgId, userId, body);
  }

  @Patch(':id/approve')
  async approve(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { note?: string } = {},
  ) {
    const { userId, orgId } = await this.extractContext(authHeader);
    return this.vacation.approve(orgId, userId, id, body);
  }

  @Patch(':id/reject')
  async reject(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { note?: string } = {},
  ) {
    const { userId, orgId } = await this.extractContext(authHeader);
    return this.vacation.reject(orgId, userId, id, body);
  }

  @Delete(':id')
  async cancel(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { userId, orgId } = await this.extractContext(authHeader);
    return this.vacation.cancel(orgId, userId, id);
  }
}
