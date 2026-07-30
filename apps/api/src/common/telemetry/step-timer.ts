import { Injectable, Logger } from '@nestjs/common';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';

/**
 * Leichtgewichtige Step-Timing-Instrumentierung.
 *
 * Zweck: fuer Sync + Label-Erstellung pro Sub-Schritt die Dauer messen,
 * damit wir aus echten Prod-Daten sagen koennen wo die Zeit hin geht.
 *
 * Design:
 *  - Monotone Zeit via performance.now() (nicht Date.now, weil das bei
 *    Zeitzonen-/Systemzeit-Aenderungen springt)
 *  - Strukturierte JSON-Logs (grep-bar mit jq)
 *  - In-Memory Ring-Buffer der letzten 200 Steps → Diagnose ohne Log-Zugriff
 *  - Auto-Redigierung: keine EKPs, keine Emails, keine Auth-Header
 *  - Korrelations-ID pro "Flow" (z.B. ein Sync-Klick oder ein Label-Job)
 *
 * KEIN Eingriff in bestehende Logik. Nur Messung + Logging.
 */

export type FlowType = 'sync' | 'label' | 'other';

export interface StepRecord {
  flowType: FlowType;
  flowId: string;
  step: string;
  startedAt: string; // ISO
  durationMs: number;
  ok: boolean;
  errorMessage?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class StepTimerService {
  private readonly logger = new Logger('Timing');
  private readonly buffer: StepRecord[] = [];
  private readonly MAX_BUFFER = 200;

  /** Startet einen neuen Flow (z.B. ein Klick auf "Aus Shopify nachladen"). */
  newFlow(flowType: FlowType): string {
    const id = randomUUID();
    this.logger.log(`flow_start ${flowType} id=${id}`);
    return id;
  }

  /** Wrapper: misst die Laufzeit einer async Funktion und loggt strukturiert. */
  async time<T>(
    flowType: FlowType,
    flowId: string,
    step: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>,
  ): Promise<T> {
    const start = performance.now();
    const startedAt = new Date().toISOString();
    try {
      const result = await fn();
      this.record({
        flowType,
        flowId,
        step,
        startedAt,
        durationMs: Math.round(performance.now() - start),
        ok: true,
        meta: this.sanitize(meta),
      });
      return result;
    } catch (err: any) {
      this.record({
        flowType,
        flowId,
        step,
        startedAt,
        durationMs: Math.round(performance.now() - start),
        ok: false,
        errorMessage: this.sanitizeError(err?.message ?? String(err)),
        meta: this.sanitize(meta),
      });
      throw err;
    }
  }

  /** Synchron: fuer Nicht-Async-Steps (z.B. reine Berechnungen). */
  timeSync<T>(
    flowType: FlowType,
    flowId: string,
    step: string,
    fn: () => T,
    meta?: Record<string, unknown>,
  ): T {
    const start = performance.now();
    const startedAt = new Date().toISOString();
    try {
      const result = fn();
      this.record({
        flowType, flowId, step, startedAt,
        durationMs: Math.round(performance.now() - start),
        ok: true,
        meta: this.sanitize(meta),
      });
      return result;
    } catch (err: any) {
      this.record({
        flowType, flowId, step, startedAt,
        durationMs: Math.round(performance.now() - start),
        ok: false,
        errorMessage: this.sanitizeError(err?.message ?? String(err)),
        meta: this.sanitize(meta),
      });
      throw err;
    }
  }

  private record(rec: StepRecord): void {
    this.buffer.push(rec);
    if (this.buffer.length > this.MAX_BUFFER) this.buffer.shift();
    // Ein-Zeilen JSON-Log, gut greppen mit jq
    try {
      this.logger.log(JSON.stringify({
        event: 'step',
        ...rec,
      }));
    } catch { /* JSON safety */ }
  }

  /** Liefert die letzten N Records fuer /telemetry-Endpoint. */
  recent(limit = 100, filterType?: FlowType): StepRecord[] {
    const filtered = filterType
      ? this.buffer.filter((r) => r.flowType === filterType)
      : this.buffer;
    return filtered.slice(-limit);
  }

  /** Aggregate: min/avg/p50/p95/max pro Step-Name fuer einen Flow-Typ. */
  aggregate(flowType?: FlowType): Record<string, {
    count: number; min: number; avg: number; p50: number; p95: number; max: number;
  }> {
    const filtered = flowType
      ? this.buffer.filter((r) => r.flowType === flowType)
      : this.buffer;
    const byStep = new Map<string, number[]>();
    for (const r of filtered) {
      const arr = byStep.get(r.step) ?? [];
      arr.push(r.durationMs);
      byStep.set(r.step, arr);
    }
    const out: Record<string, any> = {};
    for (const [step, values] of byStep) {
      const sorted = [...values].sort((a, b) => a - b);
      const sum = sorted.reduce((s, v) => s + v, 0);
      out[step] = {
        count: sorted.length,
        min: sorted[0],
        avg: Math.round(sum / sorted.length),
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1],
        max: sorted[sorted.length - 1],
      };
    }
    return out;
  }

  /** Redigiert bekannte sensible Feldnamen aus meta. */
  private sanitize(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!meta) return undefined;
    const SENSITIVE = /^(pass|password|secret|token|authorization|apikey|apisecret|credential|email|ekp|billing)/i;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (SENSITIVE.test(k)) {
        out[k] = '[REDACTED]';
      } else if (typeof v === 'string' && v.length > 300) {
        out[k] = v.slice(0, 300) + '…[truncated]';
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  /** Redigiert Auth-Header, EKP-Nummern etc. aus Fehlermeldungen. */
  private sanitizeError(msg: string): string {
    return msg
      .replace(/Bearer\s+[\w.-]+/gi, 'Bearer [REDACTED]')
      .replace(/Basic\s+[\w+/=]+/gi, 'Basic [REDACTED]')
      .replace(/(\d{10,})/g, '[REDACTED-NUM]');
  }
}
