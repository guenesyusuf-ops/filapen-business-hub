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
  // GET /api/finance/products/catalog
  // =========================================================================
  //
  // Raw product catalog (title, description, image, variants with price /
  // barcode / SKU / inventory). Independent of order data — returns all
  // products synced from Shopify (or other sources) for this org.
  //
  @Get('products/catalog')
  async getProductCatalog(
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(pageSizeStr || '60', 10) || 60));
    const validSortBy = ['title', 'price', 'createdAt'] as const;
    const sortField = (validSortBy.includes(sortBy as any)
      ? sortBy
      : 'title') as 'title' | 'price' | 'createdAt';
    const direction = (sortOrder === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

    try {
      return await this.productService.listCatalog(DEV_ORG_ID, {
        search: search?.trim() || undefined,
        sortBy: sortField,
        sortOrder: direction,
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('Failed to load product catalog', error);
      throw new HttpException('Failed to load product catalog', HttpStatus.INTERNAL_SERVER_ERROR);
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
  // GET /api/finance/revenue-breakdown
  // Shopify-style "Aufschlüsselung des Gesamtumsatzes" + stündlicher Verlauf
  // Query: ?date=YYYY-MM-DD (required) &end=YYYY-MM-DD (optional, defaults to date)
  // All calculations are anchored to Europe/Berlin day boundaries.
  // =========================================================================

  @Get('revenue-breakdown')
  async getShopifyRevenueBreakdown(
    @Query('date') dateStr?: string,
    @Query('end') endStr?: string,
  ) {
    // Default to today (server day) if no date supplied.
    const startDate = dateStr ?? new Date().toISOString().slice(0, 10);
    const endDate = endStr ?? startDate;

    // Strict YYYY-MM-DD validation — these values go into raw SQL casts.
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new HttpException(
        'Invalid date format. Expected YYYY-MM-DD',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // -----------------------------------------------------------------
      // Aggregated totals (Shopify breakdown)
      //
      //   Gesamtumsatz (totalSales) = SUM(total_price) - SUM(total_refunded)
      //   Steuern (taxes)           = SUM(total_tax)
      //   Versand (shipping)        = SUM(total_shipping)
      //   Nettoumsatz (netSales)    = totalSales - taxes - shipping
      //   Rabatte (discounts)       = SUM(total_discounts)
      //   Rückgaben (returns)       = SUM(total_refunded)
      //   Bruttoumsatz (grossSales) = netSales + discounts + returns
      //
      // -----------------------------------------------------------------
      const breakdownRows = await this.prisma.$queryRaw<
        Array<{
          gross_sales: string | null;
          discounts: string | null;
          returns: string | null;
          net_sales: string | null;
          shipping: string | null;
          taxes: string | null;
          total_sales: string | null;
        }>
      >`
        WITH bounds AS (
          SELECT
            (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
            ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
        ),
        filtered AS (
          SELECT
            COALESCE(total_price, 0)     AS total_price,
            COALESCE(total_tax, 0)       AS total_tax,
            COALESCE(total_shipping, 0)  AS total_shipping,
            COALESCE(total_discounts, 0) AS total_discounts,
            COALESCE(total_refunded, 0)  AS total_refunded
          FROM orders, bounds
          WHERE org_id = ${DEV_ORG_ID}::uuid
            AND placed_at >= bounds.start_ts
            AND placed_at <  bounds.end_ts
            AND status != 'cancelled'
        )
        SELECT
          (COALESCE(SUM(total_price), 0)
            - COALESCE(SUM(total_tax), 0)
            - COALESCE(SUM(total_shipping), 0)
            - COALESCE(SUM(total_refunded), 0)
            + COALESCE(SUM(total_discounts), 0)
            + COALESCE(SUM(total_refunded), 0)
          )::text AS gross_sales,
          COALESCE(SUM(total_discounts), 0)::text AS discounts,
          COALESCE(SUM(total_refunded), 0)::text  AS returns,
          (COALESCE(SUM(total_price), 0)
            - COALESCE(SUM(total_tax), 0)
            - COALESCE(SUM(total_shipping), 0)
            - COALESCE(SUM(total_refunded), 0)
          )::text AS net_sales,
          COALESCE(SUM(total_shipping), 0)::text  AS shipping,
          COALESCE(SUM(total_tax), 0)::text       AS taxes,
          (COALESCE(SUM(total_price), 0) - COALESCE(SUM(total_refunded), 0))::text AS total_sales
        FROM filtered
      `;

      const row = breakdownRows[0] ?? {
        gross_sales: '0',
        discounts: '0',
        returns: '0',
        net_sales: '0',
        shipping: '0',
        taxes: '0',
        total_sales: '0',
      };

      const toNumber = (v: string | null): number => {
        const n = v == null ? 0 : Number(v);
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
      };

      const breakdown = {
        grossSales: toNumber(row.gross_sales),
        discounts: toNumber(row.discounts),
        returns: toNumber(row.returns),
        netSales: toNumber(row.net_sales),
        shipping: toNumber(row.shipping),
        returnFees: 0, // Shopify lists separately; not tracked in orders table
        taxes: toNumber(row.taxes),
        totalSales: toNumber(row.total_sales),
      };

      // -----------------------------------------------------------------
      // Hourly series (0-23) in Europe/Berlin. Always produces 24 rows.
      // -----------------------------------------------------------------
      const hourlyRows = await this.prisma.$queryRaw<
        Array<{ hour: number; revenue: string | null; orders: bigint }>
      >`
        WITH bounds AS (
          SELECT
            (${startDate}::date)::timestamp AT TIME ZONE 'Europe/Berlin' AS start_ts,
            ((${endDate}::date + INTERVAL '1 day'))::timestamp AT TIME ZONE 'Europe/Berlin' AS end_ts
        ),
        hours AS (
          SELECT generate_series(0, 23) AS hour
        ),
        agg AS (
          SELECT
            EXTRACT(HOUR FROM (placed_at AT TIME ZONE 'Europe/Berlin'))::int AS hour,
            SUM(COALESCE(total_price, 0) - COALESCE(total_refunded, 0)) AS revenue,
            COUNT(*) AS orders
          FROM orders, bounds
          WHERE org_id = ${DEV_ORG_ID}::uuid
            AND placed_at >= bounds.start_ts
            AND placed_at <  bounds.end_ts
            AND status != 'cancelled'
          GROUP BY 1
        )
        SELECT
          h.hour,
          COALESCE(a.revenue, 0)::text  AS revenue,
          COALESCE(a.orders, 0)::bigint AS orders
        FROM hours h
        LEFT JOIN agg a ON a.hour = h.hour
        ORDER BY h.hour ASC
      `;

      const hourly = hourlyRows.map((r) => {
        const revenue = toNumber(r.revenue);
        const orders = Number(r.orders);
        const aov = orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0;
        return { hour: Number(r.hour), revenue, orders, aov };
      });

      return {
        range: { start: startDate, end: endDate, timezone: 'Europe/Berlin' },
        breakdown,
        hourly,
      };
    } catch (error) {
      this.logger.error('Failed to get Shopify revenue breakdown', error);
      throw new HttpException(
        'Failed to load revenue breakdown',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
