import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: (config: ConfigService): Redis | null => {
        const logger = new Logger('FinanceCacheModule');
        const url = config.get<string>('REDIS_URL');
        if (!url) {
          logger.warn(
            'REDIS_URL is not set — running without Redis cache',
          );
          return null;
        }
        const redis = new Redis(url, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => Math.min(times * 200, 5000),
          lazyConnect: true,
          enableOfflineQueue: false,
        });
        redis.on('error', (err) => {
          logger.warn('Redis connection error (non-fatal)', err.message);
        });
        return redis;
      },
      inject: [ConfigService],
    },
    CacheService,
  ],
  exports: ['REDIS', CacheService],
})
export class FinanceCacheModule {}
