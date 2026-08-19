import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { CalculationService } from '../calculation.service';
import { SettingsService } from '../settings.service';
import { ProductCostService } from '../product-cost.service';
import { SETTING_KEYS } from '../settings.constants';

/**
 * End-to-End-Test der Tages-Berechnung. Mockt Prisma so, dass der
 * ganze Weg vom Rohdaten-Row bis zur berechneten Profit-Aggregation
 * durchlaeuft. Beweist:
 *   - Settings-Historie wird abgerufen
 *   - Produktkosten-Historie wird abgerufen
 *   - Kanal-VAT wird berechnet
 *   - Kanal-Profit wird berechnet
 *   - Warnungen werden erkannt
 */

function makeMock() {
  const state: any = {
    paMonth: { findUnique: vi.fn() },
    paDay: { findUnique: vi.fn() },
    paSettingHistory: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    paProductCost: { findMany: vi.fn().mockResolvedValue([]) },
    paAmazonFulfillmentCost: { findMany: vi.fn().mockResolvedValue([]) },
    product: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) },
    $transaction: vi.fn(async (fn: any) => fn(state)),
  };
  return state;
}

function mockSettingsAt(prisma: any, key: string, value: string) {
  const original = prisma.paSettingHistory.findFirst.getMockImplementation() || (() => Promise.resolve(null));
  prisma.paSettingHistory.findFirst.mockImplementation(async (args: any) => {
    if (args.where.key === key) {
      return { value: new Prisma.Decimal(value), effectiveFrom: new Date('2020-01-01'), effectiveTo: null };
    }
    return original(args);
  });
}

const ORG = 'org-1';

describe('CalculationService.computeDay — End-to-End', () => {
  let prisma: any;
  let svc: CalculationService;
  beforeEach(() => {
    prisma = makeMock();
    // Default: alle Settings liefern realistische Werte
    prisma.paSettingHistory.findFirst.mockImplementation(async (args: any) => {
      const defaults: Record<string, string> = {
        [SETTING_KEYS.VAT_STANDARD]: '19',
        [SETTING_KEYS.VAT_REDUCED]: '7',
        [SETTING_KEYS.PAYMENT_FEE_SHOPIFY]: '3',
        [SETTING_KEYS.FEE_AMAZON]: '15',
        [SETTING_KEYS.FEE_TIKTOK]: '10',
        [SETTING_KEYS.DHL_PRICE_PER_PACKAGE]: '5.49',
      };
      const key = args.where.key;
      if (defaults[key]) {
        return { value: new Prisma.Decimal(defaults[key]), effectiveFrom: new Date('2020-01-01'), effectiveTo: null };
      }
      return null;
    });
    const settings = new SettingsService(prisma);
    const costs = new ProductCostService(prisma);
    const wholesale = { listForMonth: vi.fn().mockResolvedValue([]) } as any;
    const overhead  = { getEntriesForMonth: vi.fn().mockResolvedValue([]) } as any;
    svc = new CalculationService(prisma, settings, costs, wholesale, overhead);
  });

  it('rechnet einen typischen Tag mit Shopify+Amazon+TikTok end-to-end', async () => {
    prisma.paDay.findUnique.mockResolvedValueOnce({
      date: new Date('2026-08-20'),
      month: { status: 'open' },
      channelSales: [
        { channel: 'shopify', gross19: new Prisma.Decimal('1190'), gross7: new Prisma.Decimal('0'), returns19: new Prisma.Decimal('0'), returns7: new Prisma.Decimal('0') },
        { channel: 'amazon',  gross19: new Prisma.Decimal('595'),  gross7: new Prisma.Decimal('0'), returns19: new Prisma.Decimal('0'), returns7: new Prisma.Decimal('0') },
        { channel: 'tiktok',  gross19: new Prisma.Decimal('357'),  gross7: new Prisma.Decimal('0'), returns19: new Prisma.Decimal('0'), returns7: new Prisma.Decimal('0') },
      ],
      ads: { meta: new Prisma.Decimal('100'), google: new Prisma.Decimal('80'), influencer: new Prisma.Decimal('50'), amazonPpc: new Prisma.Decimal('40'), tiktokAds: new Prisma.Decimal('30') },
      shipping: { shopifyPackages: 10, tiktokPackages: 3 },
      productSales: [
        { channel: 'shopify', productId: 'p1', quantity: 10 },
        { channel: 'amazon',  productId: 'p1', quantity: 5  },
        { channel: 'tiktok',  productId: 'p1', quantity: 3  },
      ],
    });
    prisma.paProductCost.findMany.mockResolvedValueOnce([
      { productId: 'p1', cost: new Prisma.Decimal('4'), effectiveFrom: new Date('2020-01-01'), effectiveTo: null },
    ]);
    prisma.paAmazonFulfillmentCost.findMany.mockResolvedValueOnce([
      { productId: 'p1', cost: new Prisma.Decimal('3.5'), effectiveFrom: new Date('2020-01-01'), effectiveTo: null },
    ]);

    const result = await svc.computeDay(ORG, '2026-08-20');
    expect(result).not.toBeNull();
    if (!result) return;

    // Shopify: 1190 brutto -> 1000 netto. 10 Pakete × 5.49 = 54.90 Versand
    // 10 Stueck × 4€ = 40 Produktkosten. Payment 3 % auf Netto = 30
    // Ads: 100+80+50 = 230 (Influencer im Profit, nicht im ROAS)
    // Profit = 1000 - 40 - 54.90 - 30 - 230 = 645.10
    expect(result.shopify.profit.netSales.toString()).toBe('1000');
    expect(result.shopify.profit.productCosts.toString()).toBe('40');
    expect(result.shopify.profit.shippingCosts.toString()).toBe('54.9');
    expect(result.shopify.profit.platformFees.toString()).toBe('30');
    expect(result.shopify.profit.profit.toString()).toBe('645.1');
    // ROAS beruecksichtigt nur Meta+Google = 180
    expect(result.shopify.profit.roasNet?.toString()).toBe('5.56');   // 1000/180

    // Amazon: 595 brutto -> 500 netto. 5 Stueck × 4€ = 20 Produkte, 5 × 3.5 = 17.5 Fulfillment.
    // 15 % auf Netto = 75 Fee. 40 PPC.
    // Profit = 500 - 20 - 17.5 - 75 - 40 = 347.5
    expect(result.amazon.profit.netSales.toString()).toBe('500');
    expect(result.amazon.profit.productCosts.toString()).toBe('20');
    expect(result.amazon.profit.shippingCosts.toString()).toBe('17.5');
    expect(result.amazon.profit.platformFees.toString()).toBe('75');
    expect(result.amazon.profit.profit.toString()).toBe('347.5');

    // TikTok: 357 brutto -> 300 netto (357 / 1.19 = 300). 3 Stueck × 4€ = 12. 3 × 5.49 = 16.47.
    // 10 % auf Netto = 30. 30 Ads.
    // Profit = 300 - 12 - 16.47 - 30 - 30 = 211.53
    expect(result.tiktok.profit.netSales.toString()).toBe('300');
    expect(result.tiktok.profit.productCosts.toString()).toBe('12');
    expect(result.tiktok.profit.shippingCosts.toString()).toBe('16.47');
    expect(result.tiktok.profit.platformFees.toString()).toBe('30');
    expect(result.tiktok.profit.profit.toString()).toBe('211.53');

    // Tages-Gesamt = 645.10 + 347.50 + 211.53 = 1204.13
    expect((result.aggregate.totalProfit as any).toString()).toBe('1204.13');
    // Netto-Gesamt = 1000 + 500 + 300 = 1800
    expect((result.aggregate.totalNetSales as any).toString()).toBe('1800');
  });

  it('setzt Warnung wenn Umsatz aber keine Produktverkaeufe eingetragen', async () => {
    prisma.paDay.findUnique.mockResolvedValueOnce({
      date: new Date('2026-08-20'),
      month: { status: 'open' },
      channelSales: [
        { channel: 'shopify', gross19: new Prisma.Decimal('1190'), gross7: new Prisma.Decimal('0'), returns19: new Prisma.Decimal('0'), returns7: new Prisma.Decimal('0') },
      ],
      ads: null,
      shipping: { shopifyPackages: 5, tiktokPackages: 0 },
      productSales: [],
    });

    const result = await svc.computeDay(ORG, '2026-08-20');
    expect(result?.warnings).toContain('Shopify-Umsatz vorhanden, aber keine Produktverkaeufe eingetragen.');
  });

  it('setzt Warnung wenn Umsatz aber keine Pakete', async () => {
    prisma.paDay.findUnique.mockResolvedValueOnce({
      date: new Date('2026-08-20'),
      month: { status: 'open' },
      channelSales: [
        { channel: 'shopify', gross19: new Prisma.Decimal('1190'), gross7: new Prisma.Decimal('0'), returns19: new Prisma.Decimal('0'), returns7: new Prisma.Decimal('0') },
      ],
      ads: null,
      shipping: null,
      productSales: [{ channel: 'shopify', productId: 'p1', quantity: 5 }],
    });
    prisma.paProductCost.findMany.mockResolvedValueOnce([
      { productId: 'p1', cost: new Prisma.Decimal('4'), effectiveFrom: new Date('2020-01-01'), effectiveTo: null },
    ]);

    const result = await svc.computeDay(ORG, '2026-08-20');
    expect(result?.warnings).toContain('Shopify-Umsatz vorhanden, aber keine Pakete versendet.');
  });

  it('gibt NULL zurueck wenn Tag nicht existiert', async () => {
    prisma.paDay.findUnique.mockResolvedValueOnce(null);
    const result = await svc.computeDay(ORG, '2026-08-20');
    expect(result).toBeNull();
  });

  it('nutzt historische Produktkosten (nicht heute-Wert) fuer alten Tag', async () => {
    // Tag: 2026-05-15. Kosten haben zwei Perioden.
    prisma.paDay.findUnique.mockResolvedValueOnce({
      date: new Date('2026-05-15'),
      month: { status: 'open' },
      channelSales: [
        { channel: 'shopify', gross19: new Prisma.Decimal('1190'), gross7: new Prisma.Decimal('0'), returns19: new Prisma.Decimal('0'), returns7: new Prisma.Decimal('0') },
      ],
      ads: null,
      shipping: { shopifyPackages: 0, tiktokPackages: 0 },
      productSales: [{ channel: 'shopify', productId: 'p1', quantity: 10 }],
    });
    prisma.paProductCost.findMany.mockResolvedValueOnce([
      { productId: 'p1', cost: new Prisma.Decimal('5'), effectiveFrom: new Date('2026-06-01'), effectiveTo: null },
      { productId: 'p1', cost: new Prisma.Decimal('4'), effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-05-31') },
    ]);

    const result = await svc.computeDay(ORG, '2026-05-15');
    // Muss die alte Periode 4€ verwenden (nicht die neue 5€!)
    expect(result?.shopify.profit.productCosts.toString()).toBe('40');
  });
});
