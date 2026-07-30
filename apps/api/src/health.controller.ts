import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async check() {
    let dbOk = false;
    let dbLatencyMs = 0;

    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const status = dbOk ? 'healthy' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: dbOk,
        latencyMs: dbOk ? dbLatencyMs : null,
      },
      uptime: Math.round(process.uptime()),
    };
  }
}
