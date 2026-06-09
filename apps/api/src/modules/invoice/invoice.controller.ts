import {
  Controller, Get, Post, Put, Delete, Param, Body, Headers, Query,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { InvoiceService, InvoiceListQuery } from './invoice.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('invoices')
export class InvoiceController {
  constructor(
    private readonly svc: InvoiceService,
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
  async list(@Headers('authorization') authHeader: string, @Query() q: InvoiceListQuery) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.list(orgId, q);
  }

  @Get('status-counts')
  async statusCounts(@Headers('authorization') authHeader: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.statusCounts(orgId);
  }

  @Get('suppliers')
  async suppliers(@Headers('authorization') authHeader: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.suppliers(orgId);
  }

  @Get(':id')
  async getOne(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.get(orgId, id);
  }

  @Put(':id')
  async update(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.update(orgId, id, userId, body);
  }

  @Post(':id/paid')
  async markPaid(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { paidAt?: string; note?: string },
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.markPaid(orgId, id, userId, body || {});
  }

  @Post(':id/unpaid')
  async markUnpaid(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.markUnpaid(orgId, id, userId);
  }

  @Post(':id/archive')
  async archive(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.archive(orgId, id, userId);
  }

  @Post(':id/restore')
  async restore(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, userId } = await this.ctx(authHeader);
    return this.svc.restore(orgId, id, userId);
  }

  @Delete(':id')
  async remove(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId } = await this.ctx(authHeader);
    return this.svc.remove(orgId, id);
  }
}
