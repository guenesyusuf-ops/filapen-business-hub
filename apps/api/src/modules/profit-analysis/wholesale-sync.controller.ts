import { Controller, Get, Headers, Param, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext } from './auth-context';
import { WholesaleSyncService } from './wholesale-sync.service';

@Controller('profit-analysis/wholesale-sync')
export class WholesaleSyncController {
  constructor(
    private readonly auth: AuthService,
    private readonly sync: WholesaleSyncService,
  ) {}

  /** Automatisch aggregierte Grosshandelsaufraege eines Monats aus /sales. */
  @Get('months/:year/:month')
  async listForMonth(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.sync.listForMonth(orgId, this.n(y), this.n(m));
  }

  /** Alle nicht-gematchten Positionen im Monat (fuer die Match-Warnung). */
  @Get('months/:year/:month/unmatched')
  async listUnmatched(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return { items: await this.sync.listUnmatched(orgId, this.n(y), this.n(m)) };
  }

  private n(s: string) {
    const v = parseInt(s, 10);
    if (!Number.isInteger(v)) throw new BadRequestException('Ungueltig');
    return v;
  }
}
