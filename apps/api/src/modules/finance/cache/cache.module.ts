import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: (config: ConfigService): Redis => {
        const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
        return new Redis(url, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => Math.min(times * 200, 5000),
          lazyConnect: true,
        });
      },
      inject: [ConfigService],
    },
    CacheService,
  ],
  exports: ['REDIS', CacheService],
})
export class FinanceCacheModule {}
