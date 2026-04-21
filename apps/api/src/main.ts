import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import * as express from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Log immediately on process start (before any async work)
const startTime = Date.now();
console.log(`[Startup] Process starting... PID=${process.pid} PORT=${process.env.PORT} NODE_ENV=${process.env.NODE_ENV}`);
console.log(`[Startup] DATABASE_URL set: ${!!process.env.DATABASE_URL}`);

// JSON.stringify can't handle BigInt by default — Prisma returns BigInt for
// fields like `fileSize` in PurchaseDocument/DocFile. Without this patch the
// response serialization throws "Do not know how to serialize a BigInt" → 500.
// Safe conversion: Number loses precision above 2^53, but file sizes are far below.
(BigInt.prototype as any).toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};

// Prevent unhandled rejections from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error);
  // Don't exit — let Railway see the error in logs
});

async function bootstrap() {
  try {
    console.log('[Startup] Creating NestJS application...');

    const app = await NestFactory.create(AppModule, {
      rawBody: true,
      logger:
        process.env.NODE_ENV === 'production'
          ? ['error', 'warn', 'log']
          : ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    console.log('[Startup] NestJS created, configuring...');

    // Raw body parser for Shopify webhooks (needed for HMAC verification).
    // Must be registered before the global JSON body parser so the raw
    // payload is preserved on req.rawBody for the webhook controller.
    app.use(
      '/api/webhooks/shopify',
      express.raw({ type: 'application/json' }),
    );

    app.use(helmet());
    app.use(compression());

    // Increase body size limit to allow base64-encoded avatar uploads
    // (typical 256x256 JPEG data URL is 30-80kb; leave headroom).
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ limit: '10mb', extended: true }));

    // CORS — supports comma-separated origins and wildcard patterns (e.g. "*.vercel.app")
    // so that preview deployments (branch URLs) don't break every time Vercel creates a new one.
    const corsOrigin = process.env.APP_URL || 'http://localhost:3000';
    const origins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
    const exactOrigins = new Set(origins.filter((o) => !o.includes('*')));
    const patternOrigins = origins
      .filter((o) => o.includes('*'))
      .map((o) => new RegExp('^' + o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));
    // Always accept *.vercel.app so preview deployments work without manual env changes.
    patternOrigins.push(/^https:\/\/[a-z0-9-]+\.vercel\.app$/);
    console.log(`[Startup] CORS exact origins: ${[...exactOrigins].join(', ') || '(none)'}`);
    console.log(`[Startup] CORS pattern origins: ${patternOrigins.map(String).join(', ')}`);

    app.enableCors({
      origin: (origin, callback) => {
        // Allow non-browser requests (curl, server-to-server, mobile) with no Origin header.
        if (!origin) return callback(null, true);
        if (exactOrigins.has(origin)) return callback(null, true);
        if (patternOrigins.some((re) => re.test(origin))) return callback(null, true);
        console.warn(`[CORS] Rejected origin: ${origin}`);
        return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new LoggingInterceptor());

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    app.setGlobalPrefix('api');

    // PORT: Read directly from env (Railway sets this)
    const port = parseInt(process.env.PORT || '4000', 10);

    console.log(`[Startup] Listening on 0.0.0.0:${port}...`);

    await app.listen(port, '0.0.0.0');

    const elapsed = Date.now() - startTime;
    console.log(`[Startup] Filapen API READY on port ${port} (${elapsed}ms)`);
    console.log(`[Startup] Health check: http://0.0.0.0:${port}/api/health`);

  } catch (error) {
    console.error('[Startup] FATAL ERROR during bootstrap:', error);
    // Don't call process.exit — let Railway capture the error
  }
}

bootstrap();
