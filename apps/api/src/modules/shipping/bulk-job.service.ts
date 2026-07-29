import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Leichtgewichtige In-Memory-Job-Verwaltung fuer Bulk-Shipment-Erstellung.
 *
 * Warum nicht BullMQ / DB-Tabelle?
 *   - Bulk-Jobs sind kurzlebig (~5 Min max), 1-2 Bursts pro Tag
 *   - Ergebnisse werden 1h gecached, danach verworfen
 *   - Kein persistentes Requeue noetig — bei Server-Restart darf der Job
 *     gerne verloren gehen, der User startet halt neu (mit Idempotenz-
 *     Schutz kommen keine Duplikate raus)
 *
 * Lebensdauer eines Jobs:
 *   1. create()  → status 'running', progress { done:0, total:N }
 *   2. Aufrufer inkrementiert progress in einer Schleife
 *   3. finish() setzt status 'done' + Ergebnis
 *   4. Nach 1h Auto-GC entfernt den Eintrag
 */

export type BulkJobStatus = 'running' | 'done' | 'failed';

export interface BulkJob {
  id: string;
  orgId: string;
  createdAt: number;
  status: BulkJobStatus;
  progress: { done: number; total: number };
  result?: any;
  error?: string;
}

@Injectable()
export class BulkJobService {
  private readonly logger = new Logger(BulkJobService.name);
  private readonly jobs = new Map<string, BulkJob>();
  private readonly TTL_MS = 60 * 60 * 1000;

  constructor() {
    setInterval(() => this.gc(), 5 * 60 * 1000).unref?.();
  }

  create(orgId: string, total: number): BulkJob {
    const job: BulkJob = {
      id: randomUUID(),
      orgId,
      createdAt: Date.now(),
      status: 'running',
      progress: { done: 0, total },
    };
    this.jobs.set(job.id, job);
    this.logger.log(`Bulk-Job ${job.id} started (org=${orgId}, total=${total})`);
    return job;
  }

  incrementProgress(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.progress.done += 1;
  }

  finish(jobId: string, result: any): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'done';
    job.result = result;
    this.logger.log(`Bulk-Job ${jobId} done (${job.progress.done}/${job.progress.total})`);
  }

  fail(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'failed';
    job.error = error;
    this.logger.warn(`Bulk-Job ${jobId} failed: ${error}`);
  }

  get(orgId: string, jobId: string): BulkJob {
    const job = this.jobs.get(jobId);
    if (!job || job.orgId !== orgId) {
      throw new NotFoundException('Job nicht gefunden');
    }
    return job;
  }

  private gc(): void {
    const cutoff = Date.now() - this.TTL_MS;
    let removed = 0;
    for (const [id, job] of this.jobs) {
      if (job.createdAt < cutoff) {
        this.jobs.delete(id);
        removed++;
      }
    }
    if (removed) this.logger.debug(`GC: removed ${removed} expired bulk-jobs`);
  }
}
