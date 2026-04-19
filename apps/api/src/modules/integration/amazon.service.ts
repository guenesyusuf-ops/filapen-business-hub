import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SellingPartner = require('amazon-sp-api');

/** Returns "today minus daysBack" at midnight Europe/Berlin, as a UTC ISO string. */
function getCreatedAfterISO(daysBack = 0): string {
  // Simple approach: Berlin is UTC+1 (winter) or UTC+2 (summer).
  // We subtract the offset to get German midnight in UTC.
  const now = new Date();

  // Get Berlin date parts directly
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now).split('-').map(Number);

  // Build date at midnight UTC, then subtract daysBack
  const midnightUTC = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - daysBack));

  // Adjust for Berlin offset: in CEST (summer) midnight Berlin = 22:00 UTC prev day
  // Check current Berlin offset by comparing UTC hour vs Berlin hour
  const utcHour = now.getUTCHours();
  const berlinHourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false,
  }).format(now);
  const berlinHour = parseInt(berlinHourStr);
  const offsetHours = ((berlinHour - utcHour) + 24) % 24;

  // Subtract offset to convert Berlin midnight to UTC
  midnightUTC.setUTCHours(midnightUTC.getUTCHours() - offsetHours);

  return midnightUTC.toISOString();
}

/** Sleep helper for retry delays */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Default marketplace — additional marketplaces can be set via AMAZON_SP_MARKETPLACE_IDS env
const DEFAULT_MARKETPLACE_ID = 'A1PA6795UKMFR9'; // DE

@Injectable()
export class AmazonService {
  private readonly logger = new Logger(AmazonService.name);
  private sp: any = null;
  private readonly marketplaceIds: string[];

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const refreshToken = this.config.get<string>('AMAZON_SP_REFRESH_TOKEN');
    const clientId = this.config.get<string>('AMAZON_SP_CLIENT_ID');
    const clientSecret = this.config.get<string>('AMAZON_SP_CLIENT_SECRET');
    // Marketplace IDs — comma-separated env var or just the single configured one
    const multiIds = this.config.get<string>('AMAZON_SP_MARKETPLACE_IDS');
    const singleId = this.config.get<string>('AMAZON_SP_MARKETPLACE_ID');
    this.marketplaceIds = multiIds
      ? multiIds.split(',').map((s) => s.trim())
      : [singleId || DEFAULT_MARKETPLACE_ID];

    if (refreshToken && clientId && clientSecret) {
      try {
        this.sp = new SellingPartner({
          region: 'eu',
          refresh_token: refreshToken,
          credentials: {
            SELLING_PARTNER_APP_CLIENT_ID: clientId,
            SELLING_PARTNER_APP_CLIENT_SECRET: clientSecret,
          },
          options: {
            auto_request_tokens: true,
            auto_request_throttled: false,
          },
        });
        this.logger.log('Amazon SP-API client initialized');
      } catch (err) {
        this.logger.error('Failed to init Amazon SP-API:', err);
      }
    } else {
      this.logger.warn('Amazon SP-API not configured — missing credentials');
    }
  }

  get isConfigured(): boolean {
    return !!this.sp;
  }

  async debugConnection(): Promise<any> {
    if (!this.sp) return { error: 'SP client not initialized' };
    try {
      // Try a simple API call to verify credentials work
      const after = new Date();
      after.setDate(after.getDate() - 7);

      const res: any = await this.callWithRetry({
        operation: 'getOrders',
        endpoint: 'orders',
        query: {
          MarketplaceIds: this.marketplaceIds,
          CreatedAfter: after.toISOString(),
        },
      });

      return {
        success: true,
        marketplaceIds: this.marketplaceIds,
        sellerId: this.config.get<string>('AMAZON_SP_SELLER_ID'),
        rawResponseKeys: res ? Object.keys(res) : [],
        orderCount: res?.Orders?.length ?? 0,
        firstOrder: res?.Orders?.[0] ? {
          id: res.Orders[0].AmazonOrderId,
          status: res.Orders[0].OrderStatus,
          total: res.Orders[0].OrderTotal,
          date: res.Orders[0].PurchaseDate,
        } : null,
        rawResponse: JSON.stringify(res).slice(0, 1000),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        code: err.code,
        statusCode: err.statusCode,
        details: err.details || err.body || null,
      };
    }
  }

  // =========================================================================
  // ORDERS
  // =========================================================================

  /** Call SP-API with up to `retries` attempts, waiting between throttle errors. */
  private async callWithRetry(params: any, retries = 4): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.sp.callAPI(params);
      } catch (err: any) {
        const isThrottle = err.statusCode === 429
          || err.code === 'QuotaExceeded'
          || (err.message && err.message.includes('quota'));
        if (isThrottle && attempt < retries) {
          // Exponential backoff: 3s, 6s, 12s
          const delay = 3000 * Math.pow(2, attempt - 1);
          this.logger.warn(`SP-API throttled (attempt ${attempt}/${retries}), waiting ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        throw err;
      }
    }
  }

  async getOrders(daysBack = 30): Promise<any[]> {
    if (!this.sp) return [];
    try {
      const start = Date.now();
      const createdAfter = getCreatedAfterISO(Math.max(daysBack, 0));

      this.logger.log(`getOrders: fetching from ${createdAfter} (daysBack=${daysBack}), marketplaces: ${this.marketplaceIds.join(', ')}`);

      const allOrders: any[] = [];
      let nextToken: string | undefined;

      for (let page = 0; page < 10; page++) {
        if (Date.now() - start > 50_000) {
          this.logger.warn(`getOrders: timeout after ${page} pages, returning ${allOrders.length} orders`);
          break;
        }

        const query: any = nextToken
          ? { NextToken: nextToken }
          : {
              MarketplaceIds: this.marketplaceIds,
              CreatedAfter: createdAfter,
              OrderStatuses: ['Shipped', 'Unshipped', 'PartiallyShipped', 'Pending'],
            };

        let res: any;
        try {
          res = await this.callWithRetry({ operation: 'getOrders', endpoint: 'orders', query });
        } catch (pageErr: any) {
          this.logger.warn(`getOrders: page ${page + 1} failed after retries: ${pageErr.message} — returning ${allOrders.length} orders`);
          break;
        }

        const orders = res?.Orders ?? [];
        allOrders.push(...orders);
        this.logger.log(`getOrders: page ${page + 1} → ${orders.length} orders (total: ${allOrders.length}, ${Date.now() - start}ms)`);

        nextToken = res?.NextToken;
        if (!nextToken || orders.length === 0) break;

        // Delay between pages to respect Amazon rate limit (~1 req/sec for getOrders)
        if (nextToken) await sleep(2000);
      }

      this.logger.log(`getOrders: done — ${allOrders.length} orders in ${Date.now() - start}ms`);
      return allOrders;
    } catch (err) {
      this.logger.error('getOrders failed:', err);
      return [];
    }
  }

  async getOrderItems(orderId: string): Promise<any[]> {
    if (!this.sp) return [];
    try {
      const res = await this.sp.callAPI({
        operation: 'getOrderItems',
        endpoint: 'orders',
        path: { orderId },
      });
      return res?.OrderItems ?? [];
    } catch (err) {
      this.logger.error(`getOrderItems(${orderId}) failed:`, err);
      return [];
    }
  }

  // =========================================================================
  // FINANCE
  // =========================================================================

  async getFinancialEvents(daysBack = 30): Promise<any> {
    if (!this.sp) return {};
    try {
      const after = new Date();
      after.setDate(after.getDate() - daysBack);

      const res = await this.sp.callAPI({
        operation: 'listFinancialEvents',
        endpoint: 'finances',
        query: {
          PostedAfter: after.toISOString(),
        },
      });

      return res?.FinancialEvents ?? {};
    } catch (err) {
      this.logger.error('getFinancialEvents failed:', err);
      return {};
    }
  }

  // =========================================================================
  // CATALOG / PRODUCTS
  // =========================================================================

  async getProducts(limit = 50): Promise<any[]> {
    if (!this.sp) return [];
    try {
      const res = await this.sp.callAPI({
        operation: 'getListingsItem' in (this.sp as any) ? 'searchCatalogItems' : 'searchCatalogItems',
        api_path: '/catalog/2022-04-01/items',
        method: 'GET',
        query: {
          marketplaceIds: this.marketplaceIds,
          sellerId: this.config.get<string>('AMAZON_SP_SELLER_ID'),
          pageSize: limit,
          includedData: ['summaries', 'images', 'salesRanks'],
        },
      });

      return res?.items ?? [];
    } catch (err) {
      this.logger.error('getProducts failed:', err);
      return [];
    }
  }

  // =========================================================================
  // SALES API — getOrderMetrics (matches Seller Central exactly)
  // =========================================================================

  /**
   * Uses the Sales API getOrderMetrics to get aggregated sales data.
   * This is the SAME data source Seller Central uses for its dashboard.
   * Single API call, no pagination needed, returns exact revenue figures.
   */
  async getOrderMetrics(daysBack = 0, granularity: 'Day' | 'Week' | 'Month' | 'Total' = 'Total'): Promise<any> {
    if (!this.sp) return null;
    try {
      // Build interval in ISO 8601 format: "2026-04-19T00:00:00--2026-04-20T00:00:00"
      const now = new Date();
      const berlinDateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(now);

      // End date is tomorrow (exclusive upper bound)
      const endParts = berlinDateParts.split('-').map(Number);
      const startDate = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2] - daysBack));
      const endDate = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2] + 1));

      const interval = `${startDate.toISOString().split('T')[0]}T00:00:00-00:00--${endDate.toISOString().split('T')[0]}T00:00:00-00:00`;

      this.logger.log(`getOrderMetrics: interval=${interval}, granularity=${granularity}`);

      const res: any = await this.callWithRetry({
        operation: 'getOrderMetrics',
        endpoint: 'sales',
        query: {
          marketplaceIds: this.marketplaceIds,
          interval,
          granularity,
        },
      });

      this.logger.log(`getOrderMetrics result: ${JSON.stringify(res).slice(0, 500)}`);
      return res;
    } catch (err: any) {
      this.logger.error(`getOrderMetrics failed: ${err.message}`);
      return null;
    }
  }

  // =========================================================================
  // COGS — average cost per unit from product_variants
  // =========================================================================

  /**
   * Get average COGS across all product variants that have a cost set.
   * Used to estimate Amazon product costs (unitCount * avgCogs).
   */
  private async getAverageCogs(): Promise<number> {
    try {
      const result = await this.prisma.$queryRaw<[{ avg_cogs: number }]>`
        SELECT COALESCE(AVG(cogs), 0)::float AS avg_cogs
        FROM product_variants
        WHERE cogs IS NOT NULL AND cogs > 0
      `;
      return result[0]?.avg_cogs ?? 0;
    } catch (err: any) {
      this.logger.warn(`getAverageCogs failed: ${err.message}`);
      return 0;
    }
  }

  // =========================================================================
  // REVENUE ESTIMATION

  /**
   * Calculate revenue matching Seller Central's "Ordered Product Sales".
   *
   * FACTS (verified):
   * - Shipped/Unshipped orders have OrderTotal.Amount with real values
   * - Pending orders have OrderTotal = {} (completely empty)
   * - Seller Central counts Pending orders in both count AND revenue
   * - SC uses ItemPrice from OrderItems for Pending order values
   * - Fetching OrderItems for each Pending order is too slow (1 call per order)
   *
   * STRATEGY:
   * 1. Use OrderTotal.Amount for all orders that have it (Shipped/Unshipped)
   * 2. For Pending orders: estimate using avg order value from Shipped orders
   *    This gives us a close approximation without 60+ extra API calls
   * 3. The order COUNT is always exact (no estimation needed)
   */
  private estimateRevenue(orders: any[]): {
    revenue: number;
    shippedRevenue: number;
    pendingEstimate: number;
    shippedCount: number;
    pendingCount: number;
    avgOrderValue: number;
  } {
    let shippedRevenue = 0;
    let shippedCount = 0;
    let pendingCount = 0;

    for (const o of orders) {
      const amount = parseFloat(o.OrderTotal?.Amount ?? '0');
      if (amount > 0) {
        shippedRevenue += amount;
        shippedCount++;
      } else {
        pendingCount++;
      }
    }

    // Estimate Pending revenue based on average Shipped order value
    const avgOrderValue = shippedCount > 0 ? shippedRevenue / shippedCount : 0;
    const pendingEstimate = pendingCount * avgOrderValue;

    return {
      revenue: Math.round((shippedRevenue + pendingEstimate) * 100) / 100,
      shippedRevenue: Math.round(shippedRevenue * 100) / 100,
      pendingEstimate: Math.round(pendingEstimate * 100) / 100,
      shippedCount,
      pendingCount,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    };
  }

  // =========================================================================
  // SUMMARY / DASHBOARD
  // =========================================================================

  async getDashboardSummary(daysBack = 30): Promise<{
    totalOrders: number;
    totalRevenue: number;
    confirmedRevenue: number;
    estimatedRevenue: number;
    todayOrders: number;
    todayRevenue: number;
    avgOrderValue: number;
    currency: string;
    orders: any[];
    marketplaces: Record<string, number>;
    debug: {
      statusBreakdown: Record<string, { count: number; revenue: number }>;
      createdAfter: string;
      paginationPages: number;
      shippedCount: number;
      pendingCount: number;
    };
  }> {
    const createdAfter = getCreatedAfterISO(Math.max(daysBack, 0));

    // 1) Sales API — single call, exact Seller Central data (revenue + orders)
    // 2) Average COGS from product_variants
    const [salesMetrics, avgCogs] = await Promise.all([
      this.getOrderMetrics(daysBack, 'Total'),
      this.getAverageCogs(),
    ]);
    const metricsData = salesMetrics?.payload?.[0] ?? salesMetrics?.[0] ?? null;

    // 3) Orders API — for the order list / details table
    const orders = await this.getOrders(daysBack);
    this.logger.log(`getDashboardSummary: ${orders.length} orders from Orders API, sales metrics: ${metricsData ? 'yes' : 'no'}`);

    // Use Berlin date for "today" comparison
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    // Split orders by today vs period
    const todayBerlin = (o: any) => {
      if (!o.PurchaseDate) return false;
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(o.PurchaseDate)) === today;
    };

    const todayOrdersList = orders.filter(todayBerlin);
    const totalEstimate = this.estimateRevenue(orders);
    const todayEstimate = this.estimateRevenue(todayOrdersList);

    // If Sales API returned data, use it as source of truth for revenue + order count
    let salesRevenue: number | null = null;
    let salesOrderCount: number | null = null;
    let unitCount = 0;
    let totalCogs = 0;
    if (metricsData) {
      salesRevenue = parseFloat(metricsData.totalSales?.amount ?? '0');
      salesOrderCount = metricsData.orderCount ?? null;
      unitCount = metricsData.unitCount ?? 0;
      // COGS = units sold × average cost per unit from product_variants
      totalCogs = Math.round(unitCount * avgCogs * 100) / 100;
      this.logger.log(`Sales API: revenue=${salesRevenue}, orders=${salesOrderCount}, units=${unitCount}, avgCogs=${avgCogs}, totalCogs=${totalCogs}`);
    }

    // Status breakdown
    const statusBreakdown: Record<string, { count: number; revenue: number }> = {};
    for (const o of orders) {
      const status = o.OrderStatus ?? 'Unknown';
      const amount = parseFloat(o.OrderTotal?.Amount ?? '0');
      if (!statusBreakdown[status]) statusBreakdown[status] = { count: 0, revenue: 0 };
      statusBreakdown[status].count++;
      statusBreakdown[status].revenue += amount;
    }

    // Marketplace breakdown
    const marketplaces: Record<string, number> = {};
    for (const o of orders) {
      const mp = o.MarketplaceId ?? 'unknown';
      marketplaces[mp] = (marketplaces[mp] ?? 0) + 1;
    }

    // Final values: Sales API > Orders API estimation
    const finalRevenue = salesRevenue ?? totalEstimate.revenue;
    const finalOrderCount = salesOrderCount ?? orders.length;

    this.logger.log(`Final: ${finalOrderCount} orders, ${finalRevenue}€ (source: ${salesRevenue != null ? 'Sales API' : 'Orders API estimate'})`);
    this.logger.log(`Status: ${JSON.stringify(statusBreakdown)}`);

    return {
      totalOrders: finalOrderCount,
      totalRevenue: Math.round(finalRevenue * 100) / 100,
      confirmedRevenue: totalEstimate.shippedRevenue,
      estimatedRevenue: totalEstimate.pendingEstimate,
      unitCount,
      cogs: totalCogs,
      avgCogs: Math.round(avgCogs * 100) / 100,
      todayOrders: salesOrderCount ?? todayOrdersList.length,
      todayRevenue: salesRevenue != null ? Math.round(salesRevenue * 100) / 100 : todayEstimate.revenue,
      avgOrderValue: finalOrderCount > 0 ? Math.round((finalRevenue / finalOrderCount) * 100) / 100 : 0,
      currency: orders[0]?.OrderTotal?.CurrencyCode ?? 'EUR',
      orders: orders.slice(0, 50).map((o) => ({
        id: o.AmazonOrderId,
        status: o.OrderStatus,
        amount: parseFloat(o.OrderTotal?.Amount ?? '0'),
        currency: o.OrderTotal?.CurrencyCode ?? 'EUR',
        date: o.PurchaseDate,
        items: (o.NumberOfItemsShipped ?? 0) + (o.NumberOfItemsUnshipped ?? 0),
        marketplace: o.MarketplaceId,
      })),
      marketplaces,
      debug: {
        statusBreakdown,
        createdAfter,
        paginationPages: Math.ceil(orders.length / 100),
        shippedCount: totalEstimate.shippedCount,
        pendingCount: totalEstimate.pendingCount,
      },
    };
  }
}
