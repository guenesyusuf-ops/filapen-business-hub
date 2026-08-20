import { Controller, Get, Headers, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext } from './auth-context';
import { TopProductsService } from './top-products.service';

@Controller('profit-analysis/top-products')
export class TopProductsController {
  constructor(
    private readonly auth: AuthService,
    private readonly top: TopProductsService,
  ) {}

  /**
   * Meist verkaufte Artikel im Zeitraum (from..to inklusiv, ISO YYYY-MM-DD).
   * limit default 50.
   */
  @Get()
  async list(
    @Headers('authorization') authHeader: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    if (!from || !to) throw new BadRequestException('from und to sind Pflicht (YYYY-MM-DD)');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException('Datumsformat muss YYYY-MM-DD sein');
    }
    return this.top.getForRange(orgId, from, to, limit ? parseInt(limit, 10) : undefined);
  }
}
