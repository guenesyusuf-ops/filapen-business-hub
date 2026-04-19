import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SellingPartner = require('amazon-sp-api');

@Injectable()
export class AmazonService {
  private readonly logger = new Logger(AmazonService.name);
  private sp: any = null;
  private readonly marketplaceId: string;

  constructor(private config: ConfigService) {
    const refreshToken = this.config.get<string>('AMAZON_SP_REFRESH_TOKEN');
    const clientId = this.config.get<string>('AMAZON_SP_CLIENT_ID');
    const clientSecret = this.config.get<string>('AMAZON_SP_CLIENT_SECRET');
    this.marketplaceId = this.config.get<string>('AMAZON_SP_MARKETPLACE_ID') || 'A1PA6795UKMFR9';

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
            auto_request_throttled: true,
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

      const res = await this.sp.callAPI({
        operation: 'getOrders',
        endpoint: 'orders',
        query: {
          MarketplaceIds: [this.marketplaceId],
          CreatedAfter: after.toISOString(),
        },
      });

      return {
        success: true,
        marketplaceId: this.marketplaceId,
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
      const after = new Date();
      after.setDate(after.getDate() - daysBack);

      const res = await this.sp.callAPI({
        operation: 'getOrders',
        endpoint: 'orders',
        query: {
          MarketplaceIds: [this.marketplaceId],
          CreatedAfter: after.toISOString(),
          OrderStatuses: ['Shipped', 'Unshipped', 'PartiallyShipped'],
        },
      });

      return res?.Orders ?? [];
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
          marketplaceIds: [this.marketplaceId],
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
  }> {
    const orders = await this.getOrders(daysBack);

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

    return {
      totalOrders: orders.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      todayOrders,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      avgOrderValue: orders.length ? Math.round((totalRevenue / orders.length) * 100) / 100 : 0,
      currency: orders[0]?.OrderTotal?.CurrencyCode ?? 'EUR',
      orders: orders.slice(0, 20).map((o) => ({
        id: o.AmazonOrderId,
        status: o.OrderStatus,
        amount: parseFloat(o.OrderTotal?.Amount ?? '0'),
        currency: o.OrderTotal?.CurrencyCode ?? 'EUR',
        date: o.PurchaseDate,
        items: o.NumberOfItemsShipped ?? 0,
        marketplace: o.MarketplaceId,
      })),
    };
  }
}
