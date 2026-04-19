import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SellingPartner = require('amazon-sp-api');

/** Returns "today minus daysBack" at midnight Europe/Berlin, as a UTC Date. */
function germanMidnight(daysBack = 0): Date {
  // Get current date in Berlin timezone (format: "2026-04-19")
  const now = new Date();
  const target = new Date(now.getTime() - daysBack * 86_400_000);
  const berlinDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(target);
  // Determine if Berlin is in CEST (+02:00) or CET (+01:00) right now
  const berlinHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false,
    }).format(new Date(`${berlinDate}T12:00:00Z`)),
  );
  const offset = berlinHour === 14 ? '+02:00' : '+01:00';
  return new Date(`${berlinDate}T00:00:00${offset}`);
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

  constructor(private config: ConfigService) {
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
  private async callWithRetry(params: any, retries = 3): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.sp.callAPI(params);
      } catch (err: any) {
        const isThrottle = err.statusCode === 429 || err.code === 'QuotaExceeded';
        if (isThrottle && attempt < retries) {
          const delay = attempt * 2000; // 2s, 4s
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
      const after = germanMidnight(Math.max(daysBack, 0));

      this.logger.log(`getOrders: fetching from ${after.toISOString()} (daysBack=${daysBack}), marketplaces: ${this.marketplaceIds.join(', ')}`);

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
              CreatedAfter: after.toISOString(),
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

        // Small delay between pages to avoid hitting rate limits
        if (nextToken) await sleep(500);
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
  // SUMMARY / DASHBOARD
  // =========================================================================

  async getDashboardSummary(daysBack = 30): Promise<{
    totalOrders: number;
    totalRevenue: number;
    todayOrders: number;
    todayRevenue: number;
    avgOrderValue: number;
    currency: string;
    orders: any[];
    marketplaces: Record<string, number>;
  }> {
    const orders = await this.getOrders(daysBack);
    this.logger.log(`getDashboardSummary: ${orders.length} orders fetched for ${daysBack} days back`);

    const today = new Date().toISOString().split('T')[0];
    let totalRevenue = 0;
    let todayRevenue = 0;
    let todayOrders = 0;

    for (const o of orders) {
      const amount = parseFloat(o.OrderTotal?.Amount ?? '0');
      totalRevenue += amount;

      const orderDate = (o.PurchaseDate ?? '').split('T')[0];
      if (orderDate === today) {
        todayRevenue += amount;
        todayOrders++;
      }
    }

    // Count orders per marketplace for debugging
    const marketplaces: Record<string, number> = {};
    for (const o of orders) {
      const mp = o.MarketplaceId ?? 'unknown';
      marketplaces[mp] = (marketplaces[mp] ?? 0) + 1;
    }
    this.logger.log(`Marketplace breakdown: ${JSON.stringify(marketplaces)}`);

    return {
      totalOrders: orders.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      todayOrders,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      avgOrderValue: orders.length ? Math.round((totalRevenue / orders.length) * 100) / 100 : 0,
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
    };
  }
}
