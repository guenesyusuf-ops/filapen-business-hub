import { Controller, Get, Post, Put, Delete, Body, Headers, Param, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { WholesaleService, WholesaleOrderInputDto } from './wholesale.service';

@Controller('profit-analysis/wholesale')
export class WholesaleController {
  constructor(
    private readonly auth: AuthService,
    private readonly wholesale: WholesaleService,
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
    return this.wholesale.create(orgId, userId, body);
  }

  @Put(':id')
  async update(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: Partial<WholesaleOrderInputDto>) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.wholesale.update(orgId, id, body);
  }

  @Delete(':id')
  async remove(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.wholesale.remove(orgId, id);
  }
}
