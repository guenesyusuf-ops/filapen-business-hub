import { Injectable, OnModuleInit, OnModuleDestroy, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log:
        process.env.NODE_ENV !== 'production'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    // Non-blocking Connect: verhindert dass ein langsamer DB-Handshake den
    // gesamten NestJS-Startup blockiert (Railway Healthcheck failed sonst,
    // neuer Container kommt nie hoch, alter bleibt aktiv). Prisma verbindet
    // ohnehin lazy bei der ersten echten Query.
    this.$connect().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(`[Prisma] initial $connect failed: ${err?.message}. Will connect lazily on first query.`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
