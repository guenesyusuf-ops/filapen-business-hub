import { Controller, Post, Body, Headers, InternalServerErrorException, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext } from './auth-context';
import { PeriodService, PeriodInput } from './period.service';

@Controller('profit-analysis/periods')
export class PeriodController {
  private readonly logger = new Logger(PeriodController.name);
  constructor(private readonly auth: AuthService, private readonly periods: PeriodService) {}

  /** TEMPORÄR-DIAGNOSE: echten Fehler + betroffene Periode sichtbar machen,
   *  weil Railway-Logs hier nicht einsehbar sind. Wird nach dem Fix entfernt. */
  private async safeCompute(orgId: string, input: PeriodInput) {
    try {
      return await this.periods.compute(orgId, input);
    } catch (e: any) {
      const where = `${input?.kind} ${input?.year}-${input?.month ?? input?.quarter ?? ''}`;
      const msg = e?.message ?? String(e);
      const stack = (e?.stack ?? '').split('\n').slice(0, 4).join(' | ');
      this.logger.error(`compute failed für ${where}: ${msg}\n${e?.stack ?? ''}`);
      throw new InternalServerErrorException(`PA compute fehlgeschlagen (${where}): ${msg} :: ${stack}`);
    }
  }

  @Post('compute')
  async compute(@Headers('authorization') authHeader: string, @Body() body: PeriodInput) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.safeCompute(orgId, body);
  }

  @Post('compare')
  async compare(@Headers('authorization') authHeader: string, @Body() body: { a: PeriodInput; b: PeriodInput }) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const [a, b] = await Promise.all([
      this.safeCompute(orgId, body.a),
      this.safeCompute(orgId, body.b),
    ]);
    return { a, b };
  }
}
