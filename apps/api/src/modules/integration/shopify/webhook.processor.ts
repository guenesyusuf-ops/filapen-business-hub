import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { ShopifyService } from './shopify.service';
import {
  ShopifyOrder,
  ShopifyRefundPayload,
  ShopifyProduct,
} from './shopify.types';

interface WebhookJobData {
  topic: string;
  shopDomain: string;
  webhookId: string;
  apiVersion: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

/**
 * BullMQ processor for the 'webhook-process' queue.
 * Routes incoming Shopify webhook payloads to the appropriate
 * ShopifyService method based on the topic.
 */
@Processor('webhook-process', {
  concurrency: 5,
})
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<unknown> {
    const { topic, shopDomain, webhookId, payload } = job.data;

    this.logger.log(
      `Processing webhook ${webhookId}: ${topic} from ${shopDomain}`,
    );

    // Resolve the integration and orgId from the shop domain
    const shop = await this.prisma.shop.findFirst({
      where: { domain: shopDomain },
      include: { integration: true },
    });

    if (!shop) {
      this.logger.warn(
        `No shop found for domain ${shopDomain}. Skipping webhook ${webhookId}.`,
      );
      return { skipped: true, reason: 'shop_not_found' };
    }

    const orgId = shop.orgId;
    const integrationId = shop.integrationId;

    try {
      switch (topic) {
        case 'orders/create':
        case 'orders/updated': {
          const order = payload as unknown as ShopifyOrder;
          const result = await this.shopifyService.upsertOrder(
            orgId,
            integrationId,
            order,
          );
          this.logger.log(
            `Order ${result.orderId} ${result.action} via ${topic}`,
          );
          return result;
        }

        case 'orders/cancelled': {
          // Cancelled orders come through as regular order payloads
          // with cancelled_at set. upsertOrder handles this.
          const cancelledOrder = payload as unknown as ShopifyOrder;
          const result = await this.shopifyService.upsertOrder(
            orgId,
            integrationId,
            cancelledOrder,
          );
          this.logger.log(
            `Order ${result.orderId} cancelled via webhook`,
          );
          return result;
        }

        case 'refunds/create': {
          const refund = payload as unknown as ShopifyRefundPayload;
          await this.shopifyService.processRefund(
            orgId,
            integrationId,
            refund,
          );
          this.logger.log(
            `Refund ${refund.id} processed for order ${refund.order_id}`,
          );
          return { processed: true, refundId: refund.id };
        }

        case 'products/update': {
          const product = payload as unknown as ShopifyProduct;
          await this.shopifyService.upsertProduct(
            orgId,
            integrationId,
            product,
          );
          this.logger.log(`Product ${product.id} updated via webhook`);
          return { processed: true, productId: product.id };
        }

        case 'app/uninstalled': {
          // Mark the integration as disconnected
          await this.prisma.integration.update({
            where: { id: integrationId },
            data: {
              status: 'disconnected',
              updatedAt: new Date(),
            },
          });

          this.logger.warn(
            `App uninstalled from ${shopDomain}. Integration ${integrationId} marked as disconnected.`,
          );

          return { processed: true, action: 'disconnected' };
        }

        default: {
          this.logger.warn(
            `Unhandled webhook topic: ${topic} from ${shopDomain}`,
          );
          return { skipped: true, reason: 'unhandled_topic' };
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process webhook ${webhookId} (${topic}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Store the error on the integration for visibility
      await this.prisma.integration
        .update({
          where: { id: integrationId },
          data: {
            errorLog: {
              push: {
                webhookId,
                topic,
                error:
                  error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
              },
            },
          },
        })
        .catch((updateErr) => {
          this.logger.error(
            `Failed to log webhook error: ${updateErr}`,
          );
        });

      // Re-throw so BullMQ can retry
      throw error;
    }
  }
}
