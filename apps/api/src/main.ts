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

    // CORS
    const corsOrigin = process.env.APP_URL || 'http://localhost:3000';
    const origins = corsOrigin.split(',').map((o) => o.trim());
    app.enableCors({
      origin: origins.length === 1 ? origins[0] : origins,
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
