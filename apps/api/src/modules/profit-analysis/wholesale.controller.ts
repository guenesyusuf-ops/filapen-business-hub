import { Controller, Get, Post, Put, Delete, Body, Headers, Param, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { WholesaleService, WholesaleOrderInputDto } from './wholesale.service';
import { PaAuditService } from './audit.service';

@Controller('profit-analysis/wholesale')
export class WholesaleController {
  constructor(
    private readonly auth: AuthService,
    private readonly wholesale: WholesaleService,
    private readonly audit: PaAuditService,
  ) {}

  @Get()
  async list(
    @Headers('authorization') authHeader: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.wholesale.list(orgId, from, to);
  }

  @Get(':id')
  async get(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.wholesale.get(orgId, id);
  }

  @Post()
  async create(@Headers('authorization') authHeader: string, @Body() body: WholesaleOrderInputDto) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body?.orderDate) throw new BadRequestException('orderDate fehlt');
    const created = await this.wholesale.create(orgId, userId, body);
    await this.audit.log({ orgId, userId, action: 'wholesale.create', entityType: 'pa.wholesale_order', entityId: created.id, changes: { orderNumber: body.orderNumber, customer: body.customerName, itemCount: body.items.length } });
    return created;
  }

  @Put(':id')
  async update(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: Partial<WholesaleOrderInputDto>) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const updated = await this.wholesale.update(orgId, id, body);
    await this.audit.log({ orgId, userId, action: 'wholesale.update', entityType: 'pa.wholesale_order', entityId: id, changes: body });
    return updated;
  }

  @Delete(':id')
  async remove(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const result = await this.wholesale.remove(orgId, id);
    await this.audit.log({ orgId, userId, action: 'wholesale.delete', entityType: 'pa.wholesale_order', entityId: id });
    return result;
  }
}
