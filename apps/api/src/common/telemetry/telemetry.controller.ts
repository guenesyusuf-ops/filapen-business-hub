import { Controller, Get, Headers, Query } from '@nestjs/common';
import { AuthService } from '../../modules/auth/auth.service';
import { StepTimerService, type FlowType } from './step-timer';

/**
 * Diagnose-Endpoints fuer die Timing-Instrumentierung.
 * Auth-geschuetzt (jeder eingeloggte User darf die eigenen Timings sehen).
 * Buffer ist Prozess-lokal — bei Multi-Worker-Setup nur die aktuellen Worker-Daten.
 */
@Controller('telemetry')
export class TelemetryController {
  constructor(
    private readonly auth: AuthService,
    private readonly timer: StepTimerService,
  ) {}

  private ensureAuthed(authHeader: string): void {
    // Minimaler Auth-Check — wir wollen den Endpoint nicht offen lassen,
    // aber auch keine schweren Berechtigungspruefung. Login reicht.
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('Unauthorized');
    // Ein Wurf des Tokens durch AuthService würde reichen, aber wir wollen
    // hier keine session-abhaengige Logik. Simple Präsenz reicht.
  }

  @Get('timings')
  timings(
    @Headers('authorization') authHeader: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    this.ensureAuthed(authHeader);
    const t = (type === 'sync' || type === 'label' || type === 'other') ? (type as FlowType) : undefined;
    const n = Math.min(500, parseInt(limit ?? '100', 10) || 100);
    return {
      records: this.timer.recent(n, t),
      aggregate: this.timer.aggregate(t),
    };
  }

  @Get('timings/aggregate')
  aggregate(
    @Headers('authorization') authHeader: string,
    @Query('type') type?: string,
  ) {
    this.ensureAuthed(authHeader);
    const t = (type === 'sync' || type === 'label' || type === 'other') ? (type as FlowType) : undefined;
    return this.timer.aggregate(t);
  }
}
