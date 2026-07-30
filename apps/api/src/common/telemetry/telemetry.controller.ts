import { Controller, Get, Query } from '@nestjs/common';
import { StepTimerService, type FlowType } from './step-timer';

/**
 * Diagnose-Endpoints fuer die Timing-Instrumentierung.
 *
 * BEWUSST OHNE Auth: der Buffer ist Prozess-lokal, enthaelt nur Step-Namen
 * + Dauer + Boolean ok. Auto-Sanitizer redigiert EKPs, Emails, Auth-Header
 * aus errorMessage + meta. Keine Business-Daten, keine PII, keine Secrets.
 *
 * Zweck rein Debugging waehrend Phase 2. Sollte nach Abschluss der
 * Performance-Analyse wieder entfernt oder Auth-geschuetzt werden.
 */
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly timer: StepTimerService) {}

  @Get('timings')
  timings(
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const t = (type === 'sync' || type === 'label' || type === 'other') ? (type as FlowType) : undefined;
    const n = Math.min(500, parseInt(limit ?? '100', 10) || 100);
    return {
      records: this.timer.recent(n, t),
      aggregate: this.timer.aggregate(t),
    };
  }

  @Get('timings/aggregate')
  aggregate(@Query('type') type?: string) {
    const t = (type === 'sync' || type === 'label' || type === 'other') ? (type as FlowType) : undefined;
    return this.timer.aggregate(t);
  }
}
