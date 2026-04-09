import { Logger } from '@nestjs/common';
import { ShopifyRateLimitInfo } from './shopify.types';

/**
 * Tracks Shopify REST API leaky-bucket rate limits from response headers.
 * Shopify allows 40 requests per app per store, replenished at 2/second.
 * This limiter reads X-Shopify-Shop-Api-Call-Limit and Retry-After headers,
 * and introduces delays when approaching the ceiling.
 */
export class ShopifyRateLimiter {
  private readonly logger = new Logger(ShopifyRateLimiter.name);

  /** Current known calls made in the bucket */
  private callsMade = 0;

  /** Current known bucket limit (typically 40) */
  private callsLimit = 40;

  /** Timestamp (ms) when we can next safely make a request */
  private nextAllowedAt = 0;

  /** Safety threshold: start throttling when bucket is this % full */
  private readonly throttleThresholdPct: number;

  /** Minimum delay (ms) injected when above threshold */
  private readonly minDelayMs: number;

  constructor(
    options: {
      throttleThresholdPct?: number;
      minDelayMs?: number;
    } = {},
  ) {
    this.throttleThresholdPct = options.throttleThresholdPct ?? 0.8;
    this.minDelayMs = options.minDelayMs ?? 500;
  }

  /**
   * Parse rate limit info from Shopify response headers.
   * Header format: X-Shopify-Shop-Api-Call-Limit: 32/40
   */
  updateFromHeaders(headers: Record<string, string | string[] | undefined>): ShopifyRateLimitInfo {
    const limitHeader =
      headers['x-shopify-shop-api-call-limit'] ??
      headers['X-Shopify-Shop-Api-Call-Limit'];

    const retryHeader =
      headers['retry-after'] ?? headers['Retry-After'];

    const info: ShopifyRateLimitInfo = {
      callsMade: this.callsMade,
      callsLimit: this.callsLimit,
    };

    if (limitHeader) {
      const raw = Array.isArray(limitHeader) ? limitHeader[0] : limitHeader;
      const parts = raw.split('/');
      if (parts.length === 2) {
        this.callsMade = parseInt(parts[0], 10) || 0;
        this.callsLimit = parseInt(parts[1], 10) || 40;
        info.callsMade = this.callsMade;
        info.callsLimit = this.callsLimit;
      }
    }

    if (retryHeader) {
      const retrySeconds = parseFloat(
        Array.isArray(retryHeader) ? retryHeader[0] : retryHeader,
      );
      if (!isNaN(retrySeconds)) {
        const retryMs = Math.ceil(retrySeconds * 1000);
        this.nextAllowedAt = Date.now() + retryMs;
        info.retryAfterMs = retryMs;
        this.logger.warn(
          `Rate limited by Shopify. Retry after ${retrySeconds}s`,
        );
      }
    }

    return info;
  }

  /**
   * Wait if necessary before making the next API call.
   * Respects both Retry-After and proactive throttling.
   */
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();

    // Hard rate limit: Shopify told us to wait
    if (this.nextAllowedAt > now) {
      const waitMs = this.nextAllowedAt - now;
      this.logger.debug(`Hard rate limit: waiting ${waitMs}ms`);
      await this.sleep(waitMs);
      return;
    }

    // Proactive throttling: approaching limit
    const usageRatio = this.callsLimit > 0 ? this.callsMade / this.callsLimit : 0;
    if (usageRatio >= this.throttleThresholdPct) {
      // Scale delay based on how close to limit
      // At 80% -> minDelayMs, at 100% -> minDelayMs * 4
      const scaleFactor = 1 + ((usageRatio - this.throttleThresholdPct) / (1 - this.throttleThresholdPct)) * 3;
      const delayMs = Math.ceil(this.minDelayMs * scaleFactor);
      this.logger.debug(
        `Proactive throttle: ${this.callsMade}/${this.callsLimit} (${(usageRatio * 100).toFixed(0)}%), waiting ${delayMs}ms`,
      );
      await this.sleep(delayMs);
    }
  }

  /**
   * Handle a 429 response. Sets nextAllowedAt based on Retry-After
   * or a sensible default.
   */
  handleTooManyRequests(retryAfterSeconds?: number): void {
    const waitSeconds = retryAfterSeconds ?? 2;
    this.nextAllowedAt = Date.now() + waitSeconds * 1000;
    this.logger.warn(
      `429 received. Will retry after ${waitSeconds}s`,
    );
  }

  /** Current bucket usage as a fraction 0..1 */
  get usageRatio(): number {
    return this.callsLimit > 0 ? this.callsMade / this.callsLimit : 0;
  }

  /** Whether we are at or above the proactive threshold */
  get isThrottling(): boolean {
    return this.usageRatio >= this.throttleThresholdPct;
  }

  /** Reset state (e.g. on new integration connection) */
  reset(): void {
    this.callsMade = 0;
    this.callsLimit = 40;
    this.nextAllowedAt = 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
