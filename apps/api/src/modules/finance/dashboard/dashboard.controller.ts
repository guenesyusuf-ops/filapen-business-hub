import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ProfitEngineService } from '../profit/profit-engine.service';
import { CostService } from '../cost/cost.service';
import type { CreatePaymentMethodDto, CreateFixedCostDto } from '../cost/cost.service';
import { ProductService } from '../product/product.service';
import { AttributionService } from '../attribution/attribution.service';
import type { AttributionModel } from '../attribution/attribution.service';
import { CohortService } from '../cohort/cohort.service';
import { BenchmarkService } from '../benchmark/benchmark.service';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../../prisma/prisma.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Query DTO helpers (simple parsing, no class-validator for now)
// ---------------------------------------------------------------------------

function parseDateOrDefault(value: string | undefined, fallbackDaysAgo: number): Date {
  if (value) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setDate(d.getDate() - fallbackDaysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

function today(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('finance')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly profitEngine: ProfitEngineService,
    private readonly costService: CostService,
    private readonly productService: ProductService,
    private readonly attributionService: AttributionService,
    private readonly cohortService: CohortService,
    private readonly benchmarkService: BenchmarkService,
    private readonly prisma: PrismaService,
  ) {}

  // =========================================================================
  // GET /api/finance/dashboard
  // =========================================================================

  @Get('dashboard')
  async getDashboard(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('channel') channel?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();
    const ch = channel === 'all' ? undefined : channel;

    try {
      return await this.dashboardService.getOverview(DEV_ORG_ID, startDate, endDate, ch);
    } catch (error) {
      this.logger.error('Failed to get dashboard', error);
      throw new HttpException('Failed to load dashboard data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/products
  // =========================================================================

  @Get('products')
  async getProducts(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr || '25', 10) || 25));

    try {
      return await this.profitEngine.calculateProductProfitability(
        DEV_ORG_ID,
        startDate,
        endDate,
        {
          sortBy: sortBy || 'grossRevenue',
          sortOrder: (sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
          page,
          pageSize,
          search,
          category,
        },
      );
    } catch (error) {
      this.logger.error('Failed to get products', error);
      throw new HttpException('Failed to load product data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/channels
  // =========================================================================

  @Get('channels')
  async getChannels(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();

    try {
      return await this.profitEngine.getChannelPerformance(DEV_ORG_ID, startDate, endDate);
    } catch (error) {
      this.logger.error('Failed to get channels', error);
      throw new HttpException('Failed to load channel data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/timeseries
  // =========================================================================

  @Get('timeseries')
  async getTimeSeries(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('metrics') metricsStr?: string,
    @Query('channel') channel?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();
    const metrics = metricsStr
      ? metricsStr.split(',').map((m) => m.trim()).filter(Boolean)
      : ['revenue', 'profit', 'adSpend'];
    const ch = channel === 'all' ? undefined : channel;

    try {
      return await this.profitEngine.getTimeSeries(DEV_ORG_ID, startDate, endDate, metrics, ch);
    } catch (error) {
      this.logger.error('Failed to get timeseries', error);
      throw new HttpException('Failed to load timeseries data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/costs/payment-methods
  // =========================================================================

  @Get('costs/payment-methods')
  async getPaymentMethods() {
    try {
      return await this.costService.listPaymentMethods(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to get payment methods', error);
      throw new HttpException('Failed to load payment methods', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // POST /api/finance/costs/payment-methods
  // =========================================================================

  @Post('costs/payment-methods')
  async upsertPaymentMethod(@Body() body: CreatePaymentMethodDto) {
    try {
      return await this.costService.upsertPaymentMethod(DEV_ORG_ID, body);
    } catch (error) {
      this.logger.error('Failed to upsert payment method', error);
      throw new HttpException('Failed to save payment method', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/costs/fixed
  // =========================================================================

  @Get('costs/fixed')
  async getFixedCosts() {
    try {
      return await this.costService.listFixedCosts(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to get fixed costs', error);
      throw new HttpException('Failed to load fixed costs', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // POST /api/finance/costs/fixed
  // =========================================================================

  @Post('costs/fixed')
  async createFixedCost(@Body() body: CreateFixedCostDto) {
    try {
      return await this.costService.createFixedCost(DEV_ORG_ID, body);
    } catch (error) {
      this.logger.error('Failed to create fixed cost', error);
      throw new HttpException('Failed to save fixed cost', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/alerts
  // =========================================================================

  @Get('alerts')
  async getAlerts() {
    try {
      const alerts = await this.prisma.alert.findMany({
        where: {
          orgId: DEV_ORG_ID,
          status: { in: ['active', 'acknowledged'] },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      });

      return alerts.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        message: a.message,
        metric: a.metric,
        threshold: a.threshold ? Number(a.threshold) : undefined,
        currentValue: a.currentValue ? Number(a.currentValue) : undefined,
        createdAt: a.createdAt.toISOString(),
        status: a.status,
      }));
    } catch (error) {
      this.logger.error('Failed to get alerts', error);
      throw new HttpException('Failed to load alerts', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/integrations
  // =========================================================================

  @Get('integrations')
  async getIntegrations() {
    try {
      const integrations = await this.prisma.integration.findMany({
        where: { orgId: DEV_ORG_ID },
        select: {
          id: true,
          type: true,
          status: true,
          lastSyncedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      return integrations;
    } catch (error) {
      this.logger.error('Failed to get integrations', error);
      throw new HttpException('Failed to load integrations', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/revenue/breakdown
  // =========================================================================

  @Get('revenue/breakdown')
  async getRevenueBreakdown(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();

    try {
      const byChannel = await this.prisma.$queryRaw`
        SELECT channel, SUM(net_revenue) as revenue, SUM(order_count) as orders
        FROM daily_aggregates
        WHERE org_id = ${DEV_ORG_ID}::uuid
          AND date >= ${startDate.toISOString().slice(0, 10)}::date
          AND date <= ${endDate.toISOString().slice(0, 10)}::date
          AND channel != 'all'
        GROUP BY channel ORDER BY revenue DESC
      `;

      const byCountry = await this.prisma.$queryRaw`
        SELECT country_code, COUNT(*) as orders, SUM(total_price) as revenue
        FROM orders
        WHERE org_id = ${DEV_ORG_ID}::uuid
          AND placed_at >= ${startDate.toISOString().slice(0, 10)}::date
          AND placed_at <= ${endDate.toISOString().slice(0, 10)}::date
          AND status != 'cancelled'
        GROUP BY country_code ORDER BY revenue DESC LIMIT 10
      `;

      const byProduct = await this.prisma.$queryRaw`
        SELECT COALESCE(p.title, oli.title) as title, p.image_url,
               SUM(oli.line_total) as revenue, SUM(oli.quantity)::bigint as units
        FROM order_line_items oli
        JOIN orders o ON oli.order_id = o.id
        LEFT JOIN product_variants pv ON oli.product_variant_id = pv.id
        LEFT JOIN products p ON pv.product_id = p.id
        WHERE o.org_id = ${DEV_ORG_ID}::uuid
          AND o.placed_at >= ${startDate.toISOString().slice(0, 10)}::date
          AND o.placed_at <= ${endDate.toISOString().slice(0, 10)}::date
          AND o.status != 'cancelled'
        GROUP BY COALESCE(p.title, oli.title), p.image_url ORDER BY revenue DESC LIMIT 10
      `;

      const serialize = (rows: any[]) =>
        rows.map((row) => {
          const result: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(row)) {
            result[key] = typeof val === 'bigint' ? Number(val) : val;
          }
          return result;
        });

      return {
        byChannel: serialize(byChannel as any[]),
        byCountry: serialize(byCountry as any[]),
        byProduct: serialize(byProduct as any[]),
      };
    } catch (error) {
      this.logger.error('Failed to get revenue breakdown', error);
      throw new HttpException('Failed to load revenue breakdown', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/pnl
  // =========================================================================

  @Get('pnl')
  async getPnL(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('channel') channel?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();
    const ch = channel === 'all' ? undefined : channel;

    try {
      return await this.profitEngine.calculatePnL(DEV_ORG_ID, startDate, endDate, ch);
    } catch (error) {
      this.logger.error('Failed to get P&L', error);
      throw new HttpException('Failed to load P&L data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/campaigns
  // =========================================================================

  @Get('campaigns')
  async getCampaigns(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('platform') platform?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();

    try {
      return await this.profitEngine.getCampaigns(
        DEV_ORG_ID,
        startDate,
        endDate,
        platform,
      );
    } catch (error) {
      this.logger.error('Failed to get campaigns', error);
      throw new HttpException('Failed to load campaign data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/campaigns/:id
  // =========================================================================

  @Get('campaigns/:id')
  async getCampaignDetail(
    @Param('id') id: string,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();

    try {
      return await this.profitEngine.getCampaignDetail(
        DEV_ORG_ID,
        id,
        startDate,
        endDate,
      );
    } catch (error) {
      this.logger.error('Failed to get campaign detail', error);
      throw new HttpException('Failed to load campaign detail', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/attribution
  // =========================================================================

  @Get('attribution')
  async getAttribution(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('model') model?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();
    const validModels = ['last_touch', 'linear', 'time_decay', 'data_driven'];
    const attributionModel = validModels.includes(model ?? '')
      ? (model as AttributionModel)
      : 'linear';

    try {
      return await this.attributionService.getAttribution(
        DEV_ORG_ID,
        startDate,
        endDate,
        attributionModel,
      );
    } catch (error) {
      this.logger.error('Failed to get attribution', error);
      throw new HttpException('Failed to load attribution data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/marketing-mix
  // =========================================================================

  @Get('marketing-mix')
  async getMarketingMix(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();

    try {
      return await this.attributionService.getMarketingMix(
        DEV_ORG_ID,
        startDate,
        endDate,
      );
    } catch (error) {
      this.logger.error('Failed to get marketing mix', error);
      throw new HttpException('Failed to load marketing mix data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/cohorts
  // =========================================================================

  @Get('cohorts')
  async getCohorts(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 90);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();

    try {
      return await this.cohortService.getCohortAnalysis(
        DEV_ORG_ID,
        startDate,
        endDate,
      );
    } catch (error) {
      this.logger.error('Failed to get cohort analysis', error);
      throw new HttpException('Failed to load cohort data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/ltv
  // =========================================================================

  @Get('ltv')
  async getLTV() {
    try {
      return await this.cohortService.getLTV(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to get LTV', error);
      throw new HttpException('Failed to load LTV data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/benchmarks
  // =========================================================================

  @Get('benchmarks')
  async getBenchmarks(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();

    try {
      return await this.benchmarkService.getBenchmarks(
        DEV_ORG_ID,
        startDate,
        endDate,
      );
    } catch (error) {
      this.logger.error('Failed to get benchmarks', error);
      throw new HttpException('Failed to load benchmark data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // GET /api/finance/creative-performance
  // =========================================================================

  @Get('creative-performance')
  async getCreativePerformance(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const startDate = parseDateOrDefault(startDateStr, 30);
    const endDate = endDateStr ? parseDateOrDefault(endDateStr, 0) : today();

    try {
      // Get campaigns with daily trend data
      const campaigns = await this.profitEngine.getCampaigns(
        DEV_ORG_ID,
        startDate,
        endDate,
      );

      // Get daily trends for top campaigns (up to 10)
      const topCampaigns = campaigns.slice(0, 10);
      const trends = await Promise.all(
        topCampaigns.map(async (c) => {
          try {
            const detail = await this.profitEngine.getCampaignDetail(
              DEV_ORG_ID,
              c.id,
              startDate,
              endDate,
            );
            return {
              campaignId: c.id,
              campaignName: c.name,
              daily: detail.daily,
            };
          } catch {
            return { campaignId: c.id, campaignName: c.name, daily: [] };
          }
        }),
      );

      // Compute ROAS trend direction per campaign
      const campaignsWithTrend = campaigns.map((c) => {
        const trend = trends.find((t) => t.campaignId === c.id);
        let roasTrend: 'improving' | 'declining' | 'stable' = 'stable';
        if (trend && trend.daily.length >= 7) {
          const half = Math.floor(trend.daily.length / 2);
          const firstHalfRoas = trend.daily.slice(0, half).reduce((s, d) => s + d.roas, 0) / half;
          const secondHalfRoas = trend.daily.slice(half).reduce((s, d) => s + d.roas, 0) / (trend.daily.length - half);
          if (secondHalfRoas > firstHalfRoas * 1.1) roasTrend = 'improving';
          else if (secondHalfRoas < firstHalfRoas * 0.9) roasTrend = 'declining';
        }
        return { ...c, roasTrend };
      });

      return {
        campaigns: campaignsWithTrend,
        trends,
      };
    } catch (error) {
      this.logger.error('Failed to get creative performance', error);
      throw new HttpException('Failed to load creative performance data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
