import {
  Controller, Get, Post, Put, Delete, Param, Body, Headers, Query, Req, Res,
  HttpException, HttpStatus, BadRequestException, ForbiddenException, StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { NfcService } from './nfc.service';
import { NfcPublicService } from './nfc-public.service';
import { NfcCustomerDataService } from './nfc-customer-data.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Permission-Keys:
 *  - 'nfc' → Batches, Bands, CSV-Export, Audit-Log
 *  - 'nfc-customer-data' → Kundendaten (DSGVO-relevant, eigene Permission)
 */
function userHasPermission(role: string | undefined, perms: string[] | undefined, key: string): boolean {
  if (role === 'owner' || role === 'admin') return true;
  return (perms ?? []).includes(key);
}

@Controller('nfc')
export class NfcController {
  constructor(
    private readonly nfc: NfcService,
    private readonly pub: NfcPublicService,
    private readonly customers: NfcCustomerDataService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private async ctx(authHeader: string | undefined): Promise<{ userId: string; orgId: string; role: string; perms: string[] }> {
    if (!authHeader) throw new HttpException('No token', HttpStatus.UNAUTHORIZED);
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new HttpException('Invalid auth header', HttpStatus.UNAUTHORIZED);
    }
    let payload: any;
    try { payload = this.auth.validateToken(parts[1]); } catch {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
    return {
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
      perms: (user.menuPermissions as string[] | null) ?? [],
    };
  }

  // -------------------------------------------------------------------
  // DASHBOARD
  // -------------------------------------------------------------------

  @Get('dashboard')
  async dashboard(@Headers('authorization') authHeader: string) {
    const { orgId, role, perms } = await this.ctx(authHeader);
    if (!userHasPermission(role, perms, 'nfc')) throw new ForbiddenException();
    return this.nfc.dashboard(orgId);
  }

  // -------------------------------------------------------------------
  // BATCHES
  // -------------------------------------------------------------------

  @Get('batches')
  async listBatches(@Headers('authorization') authHeader: string) {
    const { orgId, role, perms } = await this.ctx(authHeader);
    if (!userHasPermission(role, perms, 'nfc')) throw new ForbiddenException();
    return this.nfc.listBatches(orgId);
  }

  @Post('batches')
  async createBatch(
    @Headers('authorization') authHeader: string,
    @Body() body: { count: number; name?: string; notes?: string },
  ) {
    const { orgId, userId, role, perms } = await this.ctx(authHeader);
    if (!userHasPermission(role, perms, 'nfc')) throw new ForbiddenException();
    return this.nfc.createBatch(orgId, userId, body);
  }

  @Get('batches/:id')
  async getBatch(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, role, perms } = await this.ctx(authHeader);
    if (!userHasPermission(role, perms, 'nfc')) throw new ForbiddenException();
    return this.nfc.getBatch(orgId, id);
  }

  // -------------------------------------------------------------------
  // BANDS
  // -------------------------------------------------------------------

  @Get('bands')
  async listBands(
    @Headers('authorization') authHeader: string,
    @Query() q: any,
  ) {
    const { orgId, role, perms } = await this.ctx(authHeader);
    if (!userHasPermission(role, perms, 'nfc')) throw new ForbiddenException();
    return this.nfc.listBands(orgId, q);
  }

  @Get('bands/export')
  async exportCsv(
    @Headers('authorization') authHeader: string,
    @Query('batchId') batchId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { orgId, role, perms } = await this.ctx(authHeader);
    if (!userHasPermission(role, perms, 'nfc')) throw new ForbiddenException();
    const csv = await this.nfc.exportCsv(orgId, batchId);
    const filename = `nfc-bands-${batchId ?? 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(Buffer.from('\ufeff' + csv, 'utf-8'));
  }

  // -------------------------------------------------------------------
  // CUSTOMER DATA (extra Permission)
  // -------------------------------------------------------------------

  @Get('customer-data')
  async listCustomers(
    @Headers('authorization') authHeader: string,
    @Query() q: any,
  ) {
    const { orgId, userId, role, perms } = await this.ctx(authHeader);
    if (!userHasPermission(role, perms, 'nfc-customer-data')) {
      throw new ForbiddenException('Du hast keinen Zugriff auf NFC-Kundendaten');
    }
    return this.customers.list(orgId, userId, q);
  }

  @Get('customer-data/:id')
  async getCustomer(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, userId, role, perms } = await this.ctx(authHeader);
    if (!userHasPermission(role, perms, 'nfc-customer-data')) {
      throw new ForbiddenException();
    }
    return this.customers.get(orgId, userId, id);
  }

  @Delete('customer-data/:id')
  async deleteCustomer(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const { orgId, userId, role, perms } = await this.ctx(authHeader);
    if (!userHasPermission(role, perms, 'nfc-customer-data')) {
      throw new ForbiddenException();
    }
    return this.customers.deleteByAdmin(orgId, userId, id, body?.reason);
  }

  // -------------------------------------------------------------------
  // AUDIT-LOG
  // -------------------------------------------------------------------

  @Get('audit-log')
  async auditLog(
    @Headers('authorization') authHeader: string,
    @Query('limit') limit?: string,
  ) {
    const { orgId, role, perms } = await this.ctx(authHeader);
    if (!userHasPermission(role, perms, 'nfc')) throw new ForbiddenException();
    return this.nfc.listAuditLog(orgId, limit ? parseInt(limit, 10) : 100);
  }

  // -------------------------------------------------------------------
  // PUBLIC ENDPOINTS (KEINE Auth — werden von nfc4you.de aufgerufen)
  // -------------------------------------------------------------------

  @Get('public/:code')
  async publicStatus(@Param('code') code: string, @Req() req: Request) {
    return this.pub.getPublicStatus(code, getIp(req), req.get('user-agent'));
  }

  @Post('public/:code/activate')
  async publicActivate(
    @Param('code') code: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.pub.activate(code, body, getIp(req), req.get('user-agent'));
  }

  @Post('public/:code/auth')
  async publicAuth(
    @Param('code') code: string,
    @Body() body: { pin: string },
    @Req() req: Request,
  ) {
    if (!body?.pin) throw new BadRequestException('PIN fehlt');
    return this.pub.authenticate(code, body.pin, getIp(req), req.get('user-agent'));
  }

  @Put('public/:code/edit')
  async publicEdit(
    @Param('code') code: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const pin = body?.pin;
    if (!pin) throw new BadRequestException('PIN fehlt');
    return this.pub.updateData(code, pin, body, getIp(req), req.get('user-agent'));
  }

  @Delete('public/:code/edit')
  async publicDelete(
    @Param('code') code: string,
    @Body() body: { pin: string },
    @Req() req: Request,
  ) {
    if (!body?.pin) throw new BadRequestException('PIN fehlt');
    return this.pub.deleteData(code, body.pin, getIp(req), req.get('user-agent'));
  }
}

function getIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip;
}
