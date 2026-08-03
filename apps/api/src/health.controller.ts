import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async check() {
    // Race mit 2s Timeout — verhindert dass langsame DB den Health-Check
    // und damit den Container-Start blockiert (Railway timeout = 120s ist zu lang).
    let dbOk = false;
    let dbLatencyMs: number | null = null;
    try {
      const start = Date.now();
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('db_probe_timeout_2s')), 2000),
        ),
      ]);
      dbLatencyMs = Date.now() - start;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    // HTTP 200 auch bei degraded — Container prinzipiell lauffaehig.
    return {
      status: dbOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      database: { connected: dbOk, latencyMs: dbLatencyMs },
      uptime: Math.round(process.uptime()),
    };
  }
}
