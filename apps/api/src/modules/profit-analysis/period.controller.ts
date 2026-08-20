import { Controller, Post, Body, Headers } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext } from './auth-context';
import { PeriodService, PeriodInput } from './period.service';

@Controller('profit-analysis/periods')
export class PeriodController {
  constructor(private readonly auth: AuthService, private readonly periods: PeriodService) {}

  @Post('compute')
  async compute(@Headers('authorization') authHeader: string, @Body() body: PeriodInput) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.periods.compute(orgId, body);
  }

  @Post('compare')
  async compare(@Headers('authorization') authHeader: string, @Body() body: { a: PeriodInput; b: PeriodInput }) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const [a, b] = await Promise.all([
      this.periods.compute(orgId, body.a),
      this.periods.compute(orgId, body.b),
    ]);
    return { a, b };
  }
}
