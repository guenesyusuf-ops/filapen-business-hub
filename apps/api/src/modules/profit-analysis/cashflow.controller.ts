import { Controller, Get, Headers, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext } from './auth-context';
import { CashflowService } from './cashflow.service';

@Controller('profit-analysis/cashflow')
export class CashflowController {
  constructor(
    private readonly auth: AuthService,
    private readonly cashflow: CashflowService,
  ) {}

  /**
   * Payments im gewaehlten Zeitraum, gefiltert nach paymentDate.
   * ?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  @Get('payments')
  async listPayments(
    @Headers('authorization') authHeader: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new BadRequestException('from muss YYYY-MM-DD sein');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new BadRequestException('to muss YYYY-MM-DD sein');
    if (from > to) throw new BadRequestException('from muss <= to sein');
    return this.cashflow.listPayments(orgId, from, to);
  }
}
