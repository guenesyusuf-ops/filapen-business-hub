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

// Marketplace IDs für die 4 relevanten EU-Märkte. Amazon SP-API
// getOrderMetrics summiert Umsätze über alle angegebenen MarketplaceIds —
// so bekommt der User im Dashboard einen kumulierten DE+FR+IT+ES-Umsatz
// mit einem einzigen API-Call.
// Kann via AMAZON_SP_MARKETPLACE_IDS env var überschrieben werden (comma-separated).
const DEFAULT_MARKETPLACE_ID = 'A1PA6795UKMFR9'; // DE (für Legacy single-ID Env)
const DEFAULT_EU_MARKETPLACES = [
  'A1PA6795UKMFR9', // Deutschland (amazon.de)
  'A13V1IB3VIYZZH', // Frankreich (amazon.fr)
  'APJ6JRA9NG5V4',  // Italien (amazon.it)
  'A1RKKUPIHCS9HS', // Spanien (amazon.es)
];

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
    // Marketplace IDs — präzise Priorität:
    //   1. AMAZON_SP_MARKETPLACE_IDS (comma-separated) wenn explizit gesetzt
    //   2. AMAZON_SP_MARKETPLACE_ID (legacy single-ID)
    //   3. Fallback: DE+FR+IT+ES (4 Haupt-EU-Märkte des Users)
    const multiIds = this.config.get<string>('AMAZON_SP_MARKETPLACE_IDS');
    const singleId = this.config.get<string>('AMAZON_SP_MARKETPLACE_ID');
    this.marketplaceIds = multiIds
      ? multiIds.split(',').map((s) => s.trim()).filter(Boolean)
      : singleId
        ? [singleId]
        : [...DEFAULT_EU_MARKETPLACES];
    this.logger.log(`Amazon active marketplaces: ${this.marketplaceIds.join(', ')}`);

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

  /**
   * Paginated FinancialEvents aggregation — sums real Selling Fees,
   * FBA Fees, and Refunds across all events in the window. Matches what
   * SellerBoard / Helium10 etc. show as Est. Payout components.
   *
   * Each ShipmentEvent contains ItemFeeList[] with FeeType:
   *   - "Commission"            → Selling Fee (referral fee, ~15%)
   *   - "FBAPerUnitFulfillmentFee" → FBA fulfilment fee
   *   - "FBAWeightBasedFee"     → FBA fee variant
   *   - others (closing fees, variable closing) → bucketed as "other"
   *
   * Each RefundEvent contains ShipmentItemAdjustmentList[] with:
   *   - ItemChargeAdjustmentList[] — money refunded to buyer (Principal/Tax/Shipping)
   *   - ItemFeeAdjustmentList[]    — fee credits Amazon returns (RefundCommission)
   *
   * SP-API convention: fees + refunds are returned as **negative** numbers
   * (money the seller pays / loses). We preserve sign so totals add up
   * correctly in `est_payout = revenue + fees + refunds`.
   */
  async getFinancialAggregates(daysBack = 30): Promise<{
    fbaFees: number;
    sellingFees: number;
    otherFees: number;
    totalFees: number;
    refundAmount: number;
    refundCount: number;
    shipmentCount: number;
    pages: number;
  }> {
    const empty = {
      fbaFees: 0, sellingFees: 0, otherFees: 0, totalFees: 0,
      refundAmount: 0, refundCount: 0, shipmentCount: 0, pages: 0,
    };
    if (!this.sp) return empty;

    const after = new Date();
    after.setDate(after.getDate() - daysBack);

    let fbaFees = 0;
    let sellingFees = 0;
    let otherFees = 0;
    let refundAmount = 0;
    let refundCount = 0;
    let shipmentCount = 0;
    let pages = 0;
    let nextToken: string | undefined;
    const start = Date.now();
    // Knappe Budgets — Finance darf NIE den 90s-Controller-Timeout erschöpfen,
    // sonst zeigt das Dashboard gar keine Zahlen mehr. Lieber partielle
    // Aggregate als komplettes Endpoint-Failure.
    const FEE_PAGE_LIMIT = 12;
    const FEE_BUDGET_MS = 40_000;

    const collectFees = (feeList: any[] | undefined) => {
      if (!Array.isArray(feeList)) return;
      for (const fee of feeList) {
        const amt = parseFloat(fee?.FeeAmount?.CurrencyAmount ?? '0');
        if (!Number.isFinite(amt) || amt === 0) continue;
        const type = String(fee?.FeeType ?? '');
        if (type.startsWith('FBA')) {
          fbaFees += amt;
        } else if (type === 'Commission' || type === 'RefundCommission' || type === 'VariableClosingFee' || type === 'FixedClosingFee') {
          sellingFees += amt;
        } else {
          otherFees += amt;
        }
      }
    };

    try {
      for (let page = 0; page < FEE_PAGE_LIMIT; page++) {
        if (Date.now() - start > FEE_BUDGET_MS) {
          this.logger.warn(`getFinancialAggregates: ${FEE_BUDGET_MS}ms budget reached at page ${page}, returning partial`);
          break;
        }

        const query: any = nextToken
          ? { NextToken: nextToken }
          : { PostedAfter: after.toISOString() };

        let res: any;
        try {
          res = await this.callWithRetry({
            operation: 'listFinancialEvents',
            endpoint: 'finances',
            query,
          });
        } catch (err: any) {
          this.logger.warn(`getFinancialAggregates: page ${page + 1} failed: ${err.message}`);
          break;
        }

        pages++;
        const events = res?.FinancialEvents ?? {};

        for (const evt of events.ShipmentEventList ?? []) {
          shipmentCount++;
          for (const item of evt?.ShipmentItemList ?? []) {
            collectFees(item?.ItemFeeList);
          }
        }

        for (const evt of events.RefundEventList ?? []) {
          refundCount++;
          for (const item of evt?.ShipmentItemAdjustmentList ?? []) {
            for (const ch of item?.ItemChargeAdjustmentList ?? []) {
              const amt = parseFloat(ch?.ChargeAmount?.CurrencyAmount ?? '0');
              if (!Number.isFinite(amt) || amt === 0) continue;
              const t = String(ch?.ChargeType ?? '');
              // Only count money returned to buyer — Principal/Tax/Shipping.
              // Fee adjustments belong in sellingFees as a credit.
              if (t === 'Principal' || t === 'Tax' || t === 'Shipping' ||
                  t === 'ShippingTax' || t === 'GiftWrap' || t === 'GiftWrapTax') {
                refundAmount += amt;
              }
            }
            collectFees(item?.ItemFeeAdjustmentList);
          }
        }

        nextToken = res?.NextToken;
        if (!nextToken) break;
        await sleep(600);
      }

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const totalFees = round2(fbaFees + sellingFees + otherFees);

      this.logger.log(
        `[FIN_AGG] pages=${pages} shipments=${shipmentCount} refunds=${refundCount} ` +
        `fba=${round2(fbaFees)} selling=${round2(sellingFees)} other=${round2(otherFees)} ` +
        `total_fees=${totalFees} refunds=${round2(refundAmount)}`,
      );

      return {
        fbaFees: round2(fbaFees),
        sellingFees: round2(sellingFees),
        otherFees: round2(otherFees),
        totalFees,
        refundAmount: round2(refundAmount),
        refundCount,
        shipmentCount,
        pages,
      };
    } catch (err: any) {
      this.logger.error(`getFinancialAggregates failed: ${err.message}`);
      return empty;
    }
  }

  /**
   * Per-marketplace order metrics. Exposes the same per-market call
   * `getOrderMetrics` does internally, but as a Record<marketplaceId, …>
   * so the dashboard can show DE/FR/IT/ES separately.
   */
  async getOrderMetricsByMarketplace(daysBack = 0): Promise<Record<string, {
    totalSales: number;
    orderCount: number;
    unitCount: number;
  }>> {
    if (!this.sp) return {};
    const now = new Date();
    const berlinDateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    const endParts = berlinDateParts.split('-').map(Number);
    const startDate = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2] - daysBack));
    const endDate = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2] + 1));
    const interval = `${startDate.toISOString().split('T')[0]}T00:00:00-00:00--${endDate.toISOString().split('T')[0]}T00:00:00-00:00`;

    const out: Record<string, { totalSales: number; orderCount: number; unitCount: number }> = {};
    await Promise.all(
      this.marketplaceIds.map(async (mid) => {
        try {
          const res: any = await this.callWithRetry({
            operation: 'getOrderMetrics',
            endpoint: 'sales',
            query: {
              marketplaceIds: [mid],
              interval,
              granularity: 'Total',
            },
          });
          const payload = Array.isArray(res?.payload) ? res.payload : [];
          const totalSales = payload.reduce(
            (s: number, e: any) => s + parseFloat(e?.totalSales?.amount ?? '0'),
            0,
          );
          const orderCount = payload.reduce((s: number, e: any) => s + (e?.orderCount ?? 0), 0);
          const unitCount = payload.reduce((s: number, e: any) => s + (e?.unitCount ?? 0), 0);
          out[mid] = {
            totalSales: Math.round(totalSales * 100) / 100,
            orderCount,
            unitCount,
          };
        } catch (err: any) {
          this.logger.warn(`getOrderMetricsByMarketplace ${mid} failed: ${err.message}`);
          out[mid] = { totalSales: 0, orderCount: 0, unitCount: 0 };
        }
      }),
    );
    return out;
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
    // Interval im ISO-8601-Format "YYYY-MM-DDT00:00:00-00:00--YYYY-MM-DDT00:00:00-00:00"
    const now = new Date();
    const berlinDateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    const endParts = berlinDateParts.split('-').map(Number);
    const startDate = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2] - daysBack));
    const endDate = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2] + 1));
    const interval = `${startDate.toISOString().split('T')[0]}T00:00:00-00:00--${endDate.toISOString().split('T')[0]}T00:00:00-00:00`;

    this.logger.log(`getOrderMetrics: interval=${interval}, granularity=${granularity}, marketplaces=${this.marketplaceIds.length}`);

    // ⚠️ Workaround für amazon-sp-api Library-Bug:
    // Bei mehreren marketplaceIds in einem einzigen Call wirft die Library
    // "Failure decrypting token using tag A" — sie missinterpretiert den
    // comma-serialisierten Array als verschlüsselten NextToken.
    // Lösung: Pro Marketplace einzeln abfragen, Ergebnisse serverseitig
    // zusammenführen. Die Payload-Struktur (payload[]) bleibt kompatibel
    // zur bestehenden Dashboard-Summierung.
    const perMarketResults = await Promise.all(
      this.marketplaceIds.map(async (mid) => {
        try {
          const res: any = await this.callWithRetry({
            operation: 'getOrderMetrics',
            endpoint: 'sales',
            query: {
              marketplaceIds: [mid], // single-element array — Library ist damit happy
              interval,
              granularity,
            },
          });
          const payload = Array.isArray(res?.payload) ? res.payload : [];
          this.logger.log(
            `[SALES_API ${mid}] payload entries=${payload.length}, sum=${payload.reduce((s: number, e: any) => s + parseFloat(e?.totalSales?.amount ?? '0'), 0).toFixed(2)}, orders=${payload.reduce((s: number, e: any) => s + (e?.orderCount ?? 0), 0)}`,
          );
          return payload;
        } catch (err: any) {
          this.logger.error(`getOrderMetrics ${mid} failed: ${err.message}`);
          return [];
        }
      }),
    );

    const allPayloads = perMarketResults.flat();
    if (allPayloads.length === 0) return null;
    return { payload: allPayloads };
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
    unitCount: number;
    cogs: number;
    avgCogs: number;
    fbaFees: number;
    sellingFees: number;
    otherFees: number;
    totalFees: number;
    refundAmount: number;
    refundCount: number;
    estPayout: number;
    todayOrders: number;
    todayRevenue: number;
    avgOrderValue: number;
    currency: string;
    orders: any[];
    marketplaces: Record<string, number>;
    marketplaceBreakdown: Record<string, {
      totalSales: number;
      orderCount: number;
      unitCount: number;
    }>;
    activeMarketplaces: string[];
    debug: {
      statusBreakdown: Record<string, { count: number; revenue: number }>;
      createdAfter: string;
      paginationPages: number;
      shippedCount: number;
      pendingCount: number;
      financePages: number;
      shipmentEvents: number;
    };
  }> {
    const createdAfter = getCreatedAfterISO(Math.max(daysBack, 0));

    // Alles parallel — Controller hat 90s Hard-Timeout. Wenn Fees-Aggregation
    // sequentiell vor getOrders läuft, addieren sich die Budgets (60s + 50s
    // > 90s) und das ganze Endpoint timed out → Frontend zeigt nichts.
    //   1) Per-marketplace order metrics (Sales API — Seller-Central-genau)
    //   2) Avg COGS from product_variants
    //   3) Real Selling/FBA Fees + Refunds from Finances API
    //   4) Orders API — for the order list / details table
    const [perMarketMetrics, avgCogs, finAgg, orders] = await Promise.all([
      this.getOrderMetricsByMarketplace(daysBack),
      this.getAverageCogs(),
      this.getFinancialAggregates(daysBack),
      this.getOrders(daysBack),
    ]);

    // Build legacy `salesMetrics` shape from per-market data — the rest of
    // this method already consumes that shape, so we keep the contract.
    const perMarketEntries = Object.values(perMarketMetrics);
    const salesMetrics = perMarketEntries.length
      ? {
          payload: perMarketEntries.map((e) => ({
            totalSales: { amount: String(e.totalSales) },
            orderCount: e.orderCount,
            unitCount: e.unitCount,
          })),
        }
      : null;
    // Die SP-Sales-API kann je nach Marketplace-Kombination MEHRERE
    // payload-Einträge liefern (einer pro Marketplace oder pro buyerType).
    // Wir summieren alle Einträge, damit der Gesamtwert stimmt — nicht nur
    // payload[0] nehmen (sonst DE-only oder wir verpassen FR/IT/ES).
    const payloadArr: any[] = Array.isArray(salesMetrics?.payload)
      ? salesMetrics.payload
      : Array.isArray(salesMetrics)
        ? salesMetrics
        : [];
    const metricsData = payloadArr.length
      ? payloadArr.reduce(
          (acc: any, entry: any) => ({
            totalSales: {
              amount: String(
                parseFloat(acc.totalSales?.amount ?? '0') + parseFloat(entry?.totalSales?.amount ?? '0'),
              ),
            },
            orderCount: (acc.orderCount ?? 0) + (entry?.orderCount ?? 0),
            unitCount: (acc.unitCount ?? 0) + (entry?.unitCount ?? 0),
          }),
          { totalSales: { amount: '0' }, orderCount: 0, unitCount: 0 },
        )
      : null;
    if (payloadArr.length > 1) {
      this.logger.log(`getOrderMetrics lieferte ${payloadArr.length} payload-Einträge — summiert zu ${metricsData?.totalSales?.amount}`);
    }

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

    // Final values: Sales API ist Source of Truth (matcht Seller Central exakt).
    // Fallback (Sales API null) mit Guard gegen Verdopplung:
    //   - shippedRevenue immer genommen (bestätigt via OrderTotal.Amount)
    //   - pendingEstimate nur bis maximal 50% von shippedRevenue
    //     (Schutz vor Inflate wenn #Pending >= #Shipped, was bei
    //     Multi-Market "Heute" zufällig zu 2× führen kann)
    const cappedPendingEstimate = Math.min(
      totalEstimate.pendingEstimate,
      totalEstimate.shippedRevenue * 0.5,
    );
    const fallbackRevenue = totalEstimate.shippedRevenue + cappedPendingEstimate;
    const finalRevenue = salesRevenue ?? fallbackRevenue;
    const finalOrderCount = salesOrderCount ?? orders.length;
    this.logger.log(
      `[REVENUE_CHOICE] salesRevenue=${salesRevenue} fallback=${fallbackRevenue} (shipped=${totalEstimate.shippedRevenue}, pending=${totalEstimate.pendingEstimate}, cappedPending=${cappedPendingEstimate}) → final=${finalRevenue}`,
    );

    this.logger.log(`Final: ${finalOrderCount} orders, ${finalRevenue}€ (source: ${salesRevenue != null ? 'Sales API' : 'Orders API estimate'})`);
    this.logger.log(`Status: ${JSON.stringify(statusBreakdown)}`);

    // Est. Payout = revenue + fees + refunds  (fees & refunds are negative).
    // Mirrors what SellerBoard / Helium10 show.
    const estPayout = Math.round(
      (finalRevenue + finAgg.totalFees + finAgg.refundAmount) * 100,
    ) / 100;
    this.logger.log(
      `[PAYOUT] revenue=${finalRevenue} + fees=${finAgg.totalFees} + refunds=${finAgg.refundAmount} = ${estPayout}`,
    );

    return {
      totalOrders: finalOrderCount,
      totalRevenue: Math.round(finalRevenue * 100) / 100,
      confirmedRevenue: totalEstimate.shippedRevenue,
      estimatedRevenue: totalEstimate.pendingEstimate,
      unitCount,
      cogs: totalCogs,
      avgCogs: Math.round(avgCogs * 100) / 100,
      fbaFees: finAgg.fbaFees,
      sellingFees: finAgg.sellingFees,
      otherFees: finAgg.otherFees,
      totalFees: finAgg.totalFees,
      refundAmount: finAgg.refundAmount,
      refundCount: finAgg.refundCount,
      estPayout,
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
      marketplaceBreakdown: perMarketMetrics,
      activeMarketplaces: this.marketplaceIds,
      debug: {
        statusBreakdown,
        createdAfter,
        paginationPages: Math.ceil(orders.length / 100),
        shippedCount: totalEstimate.shippedCount,
        pendingCount: totalEstimate.pendingCount,
        financePages: finAgg.pages,
        shipmentEvents: finAgg.shipmentCount,
      },
    };
  }
}
