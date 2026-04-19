import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SellingPartner = require('amazon-sp-api');

/** Wraps a promise with a timeout — rejects if it takes too long. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// EU marketplace IDs where seller is registered (DE, FR, IT, ES)
// Amazon SP-API handles all in a single request — no separate calls needed
const EU_MARKETPLACE_IDS = [
  'A1PA6795UKMFR9',  // DE
  'A13V1IB3VIYZZH',  // FR
  'APJ6JRA9NG5V4',   // IT
  'A1RKKUPIHCS9HS',  // ES
];

@Injectable()
export class AmazonService {
  private readonly logger = new Logger(AmazonService.name);
  private sp: any = null;
  private readonly marketplaceIds: string[];

  constructor(private config: ConfigService) {
    const refreshToken = this.config.get<string>('AMAZON_SP_REFRESH_TOKEN');
    const clientId = this.config.get<string>('AMAZON_SP_CLIENT_ID');
    const clientSecret = this.config.get<string>('AMAZON_SP_CLIENT_SECRET');
    // Use configured marketplace IDs or default to all EU
    const configuredId = this.config.get<string>('AMAZON_SP_MARKETPLACE_ID');
    this.marketplaceIds = configuredId ? [configuredId, ...EU_MARKETPLACE_IDS.filter(id => id !== configuredId)] : EU_MARKETPLACE_IDS;

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

      const res = await withTimeout(
        this.sp.callAPI({
          operation: 'getOrders',
          endpoint: 'orders',
          query: {
            MarketplaceIds: this.marketplaceIds,
            CreatedAfter: after.toISOString(),
          },
        }),
        15_000,
        'debugConnection',
      );

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

  async getOrders(daysBack = 30): Promise<any[]> {
    if (!this.sp) return [];
    try {
      const start = Date.now();
      // For "today": start at midnight local time
      const after = new Date();
      if (daysBack <= 0) {
        after.setHours(0, 0, 0, 0);
      } else {
        after.setDate(after.getDate() - daysBack);
        after.setHours(0, 0, 0, 0);
      }

      this.logger.log(`getOrders: fetching from ${after.toISOString()}, marketplaces: ${this.marketplaceIds.join(', ')}`);

      const allOrders: any[] = [];
      let nextToken: string | undefined;

      // Paginate through all results (max 10 pages, 45s timeout)
      for (let page = 0; page < 10; page++) {
        // Safety: abort if taking too long (Amazon throttling can add up)
        if (Date.now() - start > 45_000) {
          this.logger.warn(`getOrders: timeout after ${page} pages, returning ${allOrders.length} orders`);
          break;
        }

        const query: any = nextToken
          ? { NextToken: nextToken }
          : {
              MarketplaceIds: this.marketplaceIds,
              CreatedAfter: after.toISOString(),
              OrderStatuses: ['Pending', 'Shipped', 'Unshipped', 'PartiallyShipped'],
            };

        let res: any;
        try {
          res = await withTimeout(
            this.sp.callAPI({ operation: 'getOrders', endpoint: 'orders', query }),
            15_000,
            `getOrders page ${page + 1}`,
          );
        } catch (pageErr: any) {
          this.logger.warn(`getOrders: page ${page + 1} failed: ${pageErr.message} — returning ${allOrders.length} orders so far`);
          break;
        }

        const orders = res?.Orders ?? [];
        allOrders.push(...orders);
        this.logger.log(`getOrders: page ${page + 1} → ${orders.length} orders (total: ${allOrders.length}, ${Date.now() - start}ms)`);

        nextToken = res?.NextToken;
        if (!nextToken || orders.length === 0) break;
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
