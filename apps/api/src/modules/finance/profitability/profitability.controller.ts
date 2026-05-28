import {
  Controller, Get, Post, Put, Delete, Param, Body, Headers,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { ProfitabilityService } from './profitability.service';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('finance/profitability')
export class ProfitabilityController {
  constructor(
    private readonly svc: ProfitabilityService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private async ctx(authHeader: string | undefined): Promise<{ userId: string; orgId: string }> {
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

  @Get()
  async list(@Headers('authorization') authHeader: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.list(orgId);
  }

  @Get(':id')
  async getOne(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.get(orgId, id);
  }

  @Post()
  async create(@Headers('authorization') authHeader: string, @Body() body: any) {
    const { userId, orgId } = await this.ctx(authHeader);
    return this.svc.create(orgId, userId, body);
  }

  @Put(':id')
  async update(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: any) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.update(orgId, id, body);
  }

  @Delete(':id')
  async remove(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.remove(orgId, id);
  }
}
