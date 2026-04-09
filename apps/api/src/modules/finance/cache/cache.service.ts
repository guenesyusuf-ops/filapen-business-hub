import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

const FINANCE_PREFIX = 'finance';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  /**
   * Get a cached value by key, deserialized from JSON.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(`${FINANCE_PREFIX}:${key}`);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Cache get failed for key=${key}`, err);
      return null;
    }
  }

  /**
   * Set a cached value with TTL in seconds.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.set(
        `${FINANCE_PREFIX}:${key}`,
        serialized,
        'EX',
        ttlSeconds,
      );
    } catch (err) {
      this.logger.warn(`Cache set failed for key=${key}`, err);
    }
  }

  /**
   * Invalidate all keys matching a glob pattern using SCAN (not KEYS).
   * Returns the count of deleted keys.
   */
  async invalidatePattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deletedCount = 0;
    const fullPattern = `${FINANCE_PREFIX}:${pattern}`;

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        fullPattern,
        'COUNT',
        200,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = this.redis.pipeline();
        for (const key of keys) {
          pipeline.del(key);
        }
        await pipeline.exec();
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    return deletedCount;
  }

  /**
   * Invalidate all finance cache entries for an organization.
   */
  async invalidateForOrg(orgId: string): Promise<void> {
    const count = await this.invalidatePattern(`*:${orgId}:*`);
    this.logger.debug(`Invalidated ${count} cache entries for org ${orgId}`);
  }
}
