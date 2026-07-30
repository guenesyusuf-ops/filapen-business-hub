import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async check() {
    // WICHTIG: Health-Check MUSS immer schnell antworten damit Railway
    // den Container nicht neu startet. Wenn die DB langsam ist (z.B. wegen
    // US↔EU Latenz oder Pool-Timeout), darf der Health-Check NICHT
    // ebenfalls timeouten — sonst kommt der Server nie hoch.
    // Race: DB-Ping mit 2s Timeout. Bei Timeout Status "degraded" statt Fehler.
    let dbOk = false;
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;

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
    } catch (err: any) {
      dbOk = false;
      dbError = err?.message?.slice(0, 100) ?? 'unknown';
    }

    // HTTP 200 auch wenn DB nicht antwortet — Container ist prinzipiell
    // lauffaehig, nur die DB-Verbindung ist grad langsam/gestoert.
    return {
      status: dbOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: dbOk,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
      uptime: Math.round(process.uptime()),
    };
  }
}
