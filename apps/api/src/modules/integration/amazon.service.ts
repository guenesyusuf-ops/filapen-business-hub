import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  // ORDER ITEMS — needed for accurate revenue (Pending orders have 0 in OrderTotal)
  // =========================================================================

  /**
   * Fetch OrderItems for orders that have OrderTotal.Amount = 0 (typically Pending).
   * This gives us the actual product prices that Seller Central uses.
   * Rate limit: 1 request per order, so we batch with delays.
   */
  private async enrichOrdersWithItemPrices(orders: any[]): Promise<void> {
    const ordersNeedingItems = orders.filter(
      (o) => !o.OrderTotal?.Amount || parseFloat(o.OrderTotal.Amount) === 0,
    );

    if (ordersNeedingItems.length === 0) return;

    this.logger.log(`Enriching ${ordersNeedingItems.length} orders with item prices...`);
    let enriched = 0;

    for (const order of ordersNeedingItems) {
      try {
        const items = await this.callWithRetry({
          operation: 'getOrderItems',
          endpoint: 'orders',
          path: { orderId: order.AmazonOrderId },
        });

        const orderItems = items?.OrderItems ?? [];
        let itemTotal = 0;
        let currency = 'EUR';

        for (const item of orderItems) {
          // ItemPrice.Amount = product price (what Seller Central calls "Umsatz")
          const price = parseFloat(item.ItemPrice?.Amount ?? '0');
          itemTotal += price;
          if (item.ItemPrice?.CurrencyCode) currency = item.ItemPrice.CurrencyCode;
        }

        if (itemTotal > 0) {
          order.OrderTotal = { Amount: String(itemTotal), CurrencyCode: currency };
          order._enrichedFromItems = true;
          enriched++;
        }

        // Respect rate limit for getOrderItems (1 req / 2 sec burst)
        await sleep(500);
      } catch (err: any) {
        this.logger.warn(`Failed to get items for ${order.AmazonOrderId}: ${err.message}`);
        // Continue with other orders — don't break the loop
      }
    }

    this.logger.log(`Enriched ${enriched}/${ordersNeedingItems.length} orders with item prices`);
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
    debug: {
      statusBreakdown: Record<string, { count: number; revenue: number }>;
      createdAfter: string;
      paginationPages: number;
    };
  }> {
    const createdAfter = getCreatedAfterISO(Math.max(daysBack, 0));
    const orders = await this.getOrders(daysBack);
    this.logger.log(`getDashboardSummary: ${orders.length} orders fetched for ${daysBack} days back`);

    // Enrich Pending orders with actual item prices (like Seller Central does)
    await this.enrichOrdersWithItemPrices(orders);

    // Use Berlin date for "today" comparison
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    let totalRevenue = 0;
    let todayRevenue = 0;
    let todayOrders = 0;
    const statusBreakdown: Record<string, { count: number; revenue: number }> = {};

    for (const o of orders) {
      const amount = parseFloat(o.OrderTotal?.Amount ?? '0');
      totalRevenue += amount;

      // Track per-status breakdown for debugging
      const status = o.OrderStatus ?? 'Unknown';
      if (!statusBreakdown[status]) statusBreakdown[status] = { count: 0, revenue: 0 };
      statusBreakdown[status].count++;
      statusBreakdown[status].revenue += amount;

      // Convert order date to Berlin timezone for today comparison
      const orderDate = o.PurchaseDate
        ? new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Berlin',
            year: 'numeric', month: '2-digit', day: '2-digit',
          }).format(new Date(o.PurchaseDate))
        : '';
      if (orderDate === today) {
        todayRevenue += amount;
        todayOrders++;
      }
    }

    // Count orders per marketplace
    const marketplaces: Record<string, number> = {};
    for (const o of orders) {
      const mp = o.MarketplaceId ?? 'unknown';
      marketplaces[mp] = (marketplaces[mp] ?? 0) + 1;
    }

    this.logger.log(`Status breakdown: ${JSON.stringify(statusBreakdown)}`);
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
      debug: {
        statusBreakdown,
        createdAfter,
        paginationPages: Math.ceil(orders.length / 100),
      },
    };
  }
}
