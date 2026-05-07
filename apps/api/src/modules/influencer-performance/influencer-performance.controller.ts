import {
  Controller, Get, Post, Put, Delete, Param, Body, Headers, Query, BadRequestException,
} from '@nestjs/common';
import { InfluencerPerformanceService } from './influencer-performance.service';
import { AuthService } from '../auth/auth.service';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000099';

@Controller('influencer-performance')
export class InfluencerPerformanceController {
  constructor(
    private readonly service: InfluencerPerformanceService,
    private readonly auth: AuthService,
  ) {}

  private extractUserId(authHeader: string | undefined): string {
    if (!authHeader) return DEV_USER_ID;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return DEV_USER_ID;
    try { return this.auth.validateToken(parts[1]).sub; } catch { return DEV_USER_ID; }
  }

  @Get()
  async list(
    @Query('search') search?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('campaignName') campaignName?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('whitelist') whitelist?: string,
    @Query('blacklist') blacklist?: string,
    @Query('profitableOnly') profitableOnly?: string,
    @Query('minRoas') minRoas?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.list({
      search,
      platform,
      status: (status as any) || undefined,
      campaignName,
      fromDate,
      toDate,
      whitelist: whitelist === 'true' || whitelist === '1',
      blacklist: blacklist === 'true' || blacklist === '1',
      profitableOnly: profitableOnly === 'true' || profitableOnly === '1',
      minRoas: minRoas ? Number(minRoas) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('kpis')
  async kpis(
    @Query('search') search?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('campaignName') campaignName?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('whitelist') whitelist?: string,
    @Query('blacklist') blacklist?: string,
    @Query('profitableOnly') profitableOnly?: string,
    @Query('minRoas') minRoas?: string,
  ) {
    return this.service.kpis({
      search,
      platform,
      status: (status as any) || undefined,
      campaignName,
      fromDate,
      toDate,
      whitelist: whitelist === 'true' || whitelist === '1',
      blacklist: blacklist === 'true' || blacklist === '1',
      profitableOnly: profitableOnly === 'true' || profitableOnly === '1',
      minRoas: minRoas ? Number(minRoas) : undefined,
    });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  async create(
    @Headers('authorization') authHeader: string,
    @Body() body: any,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.create(userId, body);
  }

  @Put(':id')
  async update(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.update(id, userId, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
