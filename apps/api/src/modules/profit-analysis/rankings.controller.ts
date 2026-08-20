import { Controller, Get, Headers, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext } from './auth-context';
import { RankingsService } from './rankings.service';

@Controller('profit-analysis/rankings')
export class RankingsController {
  constructor(private readonly auth: AuthService, private readonly rankings: RankingsService) {}

  @Get()
  async lastMonths(@Headers('authorization') authHeader: string, @Query('count') count?: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const n = count ? parseInt(count, 10) : 12;
    return this.rankings.lastMonths(orgId, Math.min(24, Math.max(1, n || 12)));
  }
}
