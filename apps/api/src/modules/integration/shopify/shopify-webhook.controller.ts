import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Request } from 'express';
import { ShopifyService } from './shopify.service';

/**
 * Shopify Webhook Controller
 *
 * Receives webhook payloads from Shopify, verifies the HMAC signature,
 * and enqueues the payload for asynchronous processing via BullMQ.
 * Returns 200 immediately to avoid Shopify's 5-second timeout.
 *
 * IMPORTANT: This controller requires raw body parsing to be enabled
 * for webhook HMAC verification. Configure in main.ts:
 *
 *   app.use('/webhooks/shopify', express.raw({ type: 'application/json' }));
 */
@Controller('webhooks/shopify')
export class ShopifyWebhookController {
  private readonly logger = new Logger(ShopifyWebhookController.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    @InjectQueue('webhook-process') private readonly webhookQueue: Queue,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-topic') topic: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Headers('x-shopify-api-version') apiVersion: string,
    @Headers('x-shopify-webhook-id') webhookId: string,
  ): Promise<{ received: boolean }> {
    // 1. Validate required headers
    if (!hmacHeader || !topic || !shopDomain) {
      this.logger.warn(
        'Webhook received with missing headers. Ignoring.',
      );
      return { received: false };
    }

    // 2. Verify HMAC signature using the raw body
    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.error(
        'Raw body not available. Ensure raw body parsing is configured for /webhooks/shopify',
      );
      return { received: false };
    }

    const isValid = this.shopifyService.verifyWebhookHmac(
      rawBody,
      hmacHeader,
    );

    if (!isValid) {
      this.logger.warn(
        `Invalid HMAC signature for webhook ${webhookId} from ${shopDomain}`,
      );
      return { received: false };
    }

    // 3. Parse the body
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      this.logger.error(
        `Failed to parse webhook body for ${webhookId}`,
      );
      return { received: false };
    }

    // 4. Enqueue for async processing and return 200 immediately
    await this.webhookQueue.add(
      topic,
      {
        topic,
        shopDomain,
        webhookId,
        apiVersion,
        payload,
        receivedAt: new Date().toISOString(),
      },
      {
        jobId: webhookId || undefined,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    );

    this.logger.debug(
      `Enqueued webhook ${webhookId}: ${topic} from ${shopDomain}`,
    );

    return { received: true };
  }
}
