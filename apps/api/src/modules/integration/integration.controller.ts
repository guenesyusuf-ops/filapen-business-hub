import {
  Controller,
  Get,
  Post,
  Param,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopifyService } from './shopify/shopify.service';
import { AggregationService } from '../finance/profit/aggregation.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * All known integration types and their metadata.
 * Used to show "available" integrations even when not yet connected.
 */
const KNOWN_INTEGRATION_TYPES = [
  { type: 'shopify', label: 'Shopify', description: 'Sync orders, products and inventory from Shopify' },
  { type: 'meta_ads', label: 'Meta Ads', description: 'Import ad spend and campaign data from Meta' },
  { type: 'google_ads', label: 'Google Ads', description: 'Import ad spend and campaign data from Google' },
];

@Controller('integrations')
export class IntegrationController {
  private readonly logger = new Logger(IntegrationController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopifyService: ShopifyService,
    private readonly aggregationService: AggregationService,
  ) {}

  // =========================================================================
  // GET /api/integrations — List all integrations for the org
  // =========================================================================

  @Get()
  async list() {
    try {
      const connected = await this.prisma.integration.findMany({
        where: { orgId: DEV_ORG_ID },
        select: {
          id: true,
          type: true,
          status: true,
          lastSyncedAt: true,
          createdAt: true,
          scopes: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const connectedTypes = new Set(connected.map((i) => i.type));

      // Build a combined list: connected integrations + available (not yet connected) types
      const connectedList = connected.map((i) => ({
        id: i.id,
        type: i.type,
        label: KNOWN_INTEGRATION_TYPES.find((k) => k.type === i.type)?.label ?? i.type,
        description: KNOWN_INTEGRATION_TYPES.find((k) => k.type === i.type)?.description ?? '',
        status: i.status,
        lastSyncedAt: i.lastSyncedAt?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
        scopes: i.scopes,
      }));

      const availableList = KNOWN_INTEGRATION_TYPES
        .filter((k) => !connectedTypes.has(k.type as any))
        .map((k) => ({
          id: null,
          type: k.type,
          label: k.label,
          description: k.description,
          status: 'available' as const,
          lastSyncedAt: null,
          createdAt: null,
          scopes: [],
        }));

      return [...connectedList, ...availableList];
    } catch (error) {
      this.logger.error('Failed to list integrations', error);
      throw new HttpException('Failed to load integrations', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/integrations/:id — Single integration with details
  // =========================================================================

  @Get(':id')
  async getById(@Param('id') id: string) {
    try {
      const integration = await this.prisma.integration.findFirst({
        where: { id, orgId: DEV_ORG_ID },
        include: {
          syncLogs: {
            orderBy: { startedAt: 'desc' },
            take: 10,
            select: {
              id: true,
              syncType: true,
              status: true,
              recordsProcessed: true,
              errors: true,
              startedAt: true,
              completedAt: true,
              durationMs: true,
            },
          },
        },
      });

      if (!integration) {
        throw new NotFoundException(`Integration ${id} not found`);
      }

      return {
        id: integration.id,
        type: integration.type,
        status: integration.status,
        scopes: integration.scopes,
        errorLog: integration.errorLog,
        lastSyncedAt: integration.lastSyncedAt?.toISOString() ?? null,
        createdAt: integration.createdAt.toISOString(),
        updatedAt: integration.updatedAt.toISOString(),
        syncLogs: integration.syncLogs.map((log) => ({
          ...log,
          startedAt: log.startedAt.toISOString(),
          completedAt: log.completedAt?.toISOString() ?? null,
        })),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to get integration ${id}`, error);
      throw new HttpException('Failed to load integration details', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // POST /api/integrations/:id/disconnect — Disconnect an integration
  // =========================================================================

  @Post(':id/disconnect')
  async disconnect(@Param('id') id: string) {
    try {
      const integration = await this.prisma.integration.findFirst({
        where: { id, orgId: DEV_ORG_ID },
      });

      if (!integration) {
        throw new NotFoundException(`Integration ${id} not found`);
      }

      await this.prisma.integration.update({
        where: { id },
        data: {
          status: 'disconnected',
          credentials: {},
        },
      });

      this.logger.log(`Integration ${id} (${integration.type}) disconnected`);

      return { success: true, message: `Integration ${integration.type} disconnected` };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to disconnect integration ${id}`, error);
      throw new HttpException('Failed to disconnect integration', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // POST /api/integrations/:id/sync — Trigger manual sync
  // =========================================================================

  @Post(':id/sync')
  async triggerSync(@Param('id') id: string) {
    try {
      const integration = await this.prisma.integration.findFirst({
        where: { id, orgId: DEV_ORG_ID },
      });

      if (!integration) {
        throw new NotFoundException(`Integration ${id} not found`);
      }

      if (integration.status !== 'connected') {
        throw new HttpException(
          'Integration is not connected. Connect it first before syncing.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (integration.type === 'shopify') {
        // Fire-and-forget: backfill + aggregate rebuild in background
        this.shopifyService
          .backfill(id)
          .then(async () => {
            this.logger.log(`Backfill done for ${id}, rebuilding aggregates...`);
            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 12);
            await this.aggregationService.rebuildRange(DEV_ORG_ID, start, end);
            this.logger.log(`Aggregates rebuilt for ${id}`);
          })
          .catch((err) => {
            this.logger.error(`Background sync failed for integration ${id}`, err);
          });
      } else {
        throw new HttpException(
          `Manual sync not yet supported for type: ${integration.type}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return { syncing: true, integrationId: id, type: integration.type };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof HttpException) throw error;
      this.logger.error(`Failed to trigger sync for integration ${id}`, error);
      throw new HttpException('Failed to trigger sync', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // POST /api/integrations/rebuild-aggregates — Rebuild dashboard aggregates
  // =========================================================================

  @Post('rebuild-aggregates')
  async rebuildAggregates() {
    try {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 12);

      this.logger.log(`Rebuilding aggregates for last 12 months`);

      // Run synchronously so caller knows when it's done
      await this.aggregationService.rebuildRange(DEV_ORG_ID, start, end);

      return {
        success: true,
        message: 'Aggregates rebuilt for the last 12 months',
        from: start.toISOString(),
        to: end.toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to rebuild aggregates', error);
      throw new HttpException(
        `Failed to rebuild aggregates: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
