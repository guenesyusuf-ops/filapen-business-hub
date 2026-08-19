import { describe, it, expect } from 'vitest';
import { webshopProfit, amazonProfit, tiktokProfit, aggregateDay } from '../domain/channel-profit';
import { round2 } from '../domain/decimal';

// -----------------------------------------------------------------------------
// Webshop
// -----------------------------------------------------------------------------

describe('webshopProfit (§27)', () => {
  it('rechnet einen typischen Tag korrekt', () => {
    // Shopify: 1190 brutto (19%) → 1000 netto
    // Kosten: 30 Payment Fee (3% auf Netto), 200 Produkte, 50 Versand
    // Ads: 100 Meta, 80 Google, 50 Influencer
    // Profit = 1000 - 30 - 200 - 50 - 100 - 80 - 50 = 490
    const r = webshopProfit({
      netSales: 1000,
      grossSales: 1190,
      productCosts: 200,
      shippingCosts: 50,
      paymentFeeRatePercent: 3.0,
      metaAds: 100,
      googleAds: 80,
      influencer: 50,
    });
    expect(round2(r.platformFees).toString()).toBe('30');       // 1000 × 3 %
    expect(round2(r.totalCostsWithoutAds).toString()).toBe('280'); // 200+50+30 (§24)
    expect(round2(r.profit).toString()).toBe('490');
    // ROAS beruecksichtigt NUR Meta+Google (nicht Influencer): 180
    expect(round2(r.roasGross!).toString()).toBe('6.61');  // 1190/180
    expect(round2(r.roasNet!).toString()).toBe('5.56');    // 1000/180
    // Marge 490/1000 = 49%
    expect(r.margin!.toString()).toBe('49');
  });

  it('Payment-Fee auf NETTO (nicht auf Brutto)', () => {
    // Wichtige User-Klaerung: Gebuehr auf Netto
    const r = webshopProfit({
      netSales: 1000, grossSales: 1190,
      productCosts: 0, shippingCosts: 0,
      paymentFeeRatePercent: 3.0,
      metaAds: 0, googleAds: 0, influencer: 0,
    });
    expect(round2(r.platformFees).toString()).toBe('30');  // 1000 × 3% = 30
  });

  it('ROAS ohne Ads → NULL', () => {
    const r = webshopProfit({
      netSales: 1000, grossSales: 1190,
      productCosts: 0, shippingCosts: 0, paymentFeeRatePercent: 0,
      metaAds: 0, googleAds: 0, influencer: 100,
    });
    expect(r.roasGross).toBeNull();
    expect(r.roasNet).toBeNull();
  });

  it('Marge bei Netto=0 → NULL', () => {
    const r = webshopProfit({
      netSales: 0, grossSales: 0,
      productCosts: 0, shippingCosts: 0, paymentFeeRatePercent: 0,
      metaAds: 0, googleAds: 0, influencer: 0,
    });
    expect(r.margin).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Amazon
// -----------------------------------------------------------------------------

describe('amazonProfit (§30)', () => {
  it('rechnet Amazon-Profit korrekt', () => {
    // 1000 Netto (1190 brutto), 200 Produkte, 100 Fulfillment,
    // 15% Amazon-Gebuehr auf Netto = 150, 80 PPC
    // Profit = 1000 - 200 - 100 - 150 - 80 = 470
    const r = amazonProfit({
      netSales: 1000, grossSales: 1190,
      productCosts: 200,
      fulfillmentCosts: 100,
      feeRatePercent: 15,
      amazonPpc: 80,
    });
    expect(round2(r.platformFees).toString()).toBe('150');
    expect(round2(r.totalCostsWithoutAds).toString()).toBe('450'); // 200+100+150
    expect(round2(r.profit).toString()).toBe('470');
    expect(round2(r.roasNet!).toString()).toBe('12.5');   // 1000/80
    expect(round2(r.roasGross!).toString()).toBe('14.88'); // 1190/80
    expect(r.margin!.toString()).toBe('47');
  });

  it('Fulfillment=0 wird korrekt behandelt', () => {
    const r = amazonProfit({
      netSales: 1000, grossSales: 1190,
      productCosts: 200, fulfillmentCosts: 0,
      feeRatePercent: 15, amazonPpc: 80,
    });
    expect(round2(r.profit).toString()).toBe('570');  // 1000 - 200 - 0 - 150 - 80
  });
});

// -----------------------------------------------------------------------------
// TikTok
// -----------------------------------------------------------------------------

describe('tiktokProfit (§33)', () => {
  it('rechnet TikTok-Profit korrekt', () => {
    const r = tiktokProfit({
      netSales: 500, grossSales: 595,
      productCosts: 100,
      shippingCosts: 25,
      feeRatePercent: 10,
      tiktokAds: 50,
    });
    expect(round2(r.platformFees).toString()).toBe('50');       // 500 × 10 %
    expect(round2(r.totalCostsWithoutAds).toString()).toBe('175'); // 100+25+50
    expect(round2(r.profit).toString()).toBe('275');            // 500-175-50
    expect(round2(r.roasNet!).toString()).toBe('10');           // 500/50
  });
});

// -----------------------------------------------------------------------------
// Aggregation (§36, §37)
// -----------------------------------------------------------------------------

describe('aggregateDay (§36, §37)', () => {
  it('summiert die drei Kanal-Profits', () => {
    const webshop = webshopProfit({
      netSales: 1000, grossSales: 1190, productCosts: 0, shippingCosts: 0,
      paymentFeeRatePercent: 0, metaAds: 0, googleAds: 0, influencer: 0,
    });
    const amazon = amazonProfit({
      netSales: 500, grossSales: 595, productCosts: 0, fulfillmentCosts: 0,
      feeRatePercent: 0, amazonPpc: 0,
    });
    const tiktok = tiktokProfit({
      netSales: 200, grossSales: 238, productCosts: 0, shippingCosts: 0,
      feeRatePercent: 0, tiktokAds: 0,
    });

    const agg = aggregateDay({ webshop, amazon, tiktok });
    expect(round2(agg.totalNetSales).toString()).toBe('1700');
    expect(round2(agg.totalProfit).toString()).toBe('1700');    // keine Kosten
    expect(agg.totalMargin!.toString()).toBe('100');
  });

  it('behandelt kombinierten Verlust', () => {
    const webshop = webshopProfit({
      netSales: 100, grossSales: 119, productCosts: 200, shippingCosts: 0,
      paymentFeeRatePercent: 0, metaAds: 0, googleAds: 0, influencer: 0,
    }); // profit = -100
    const amazon = amazonProfit({
      netSales: 100, grossSales: 119, productCosts: 50, fulfillmentCosts: 0,
      feeRatePercent: 0, amazonPpc: 0,
    }); // profit = 50
    const tiktok = tiktokProfit({
      netSales: 0, grossSales: 0, productCosts: 0, shippingCosts: 0,
      feeRatePercent: 0, tiktokAds: 0,
    }); // profit = 0
    const agg = aggregateDay({ webshop, amazon, tiktok });
    expect(round2(agg.totalProfit).toString()).toBe('-50');     // -100 + 50 + 0
    expect(round2(agg.totalNetSales).toString()).toBe('200');
    expect(agg.totalMargin!.toString()).toBe('-25');
  });

  it('Gesamtmarge NULL wenn alle Netto=0', () => {
    const zero = { netSales: 0, grossSales: 0, productCosts: 0, shippingCosts: 0 };
    const webshop = webshopProfit({ ...zero, paymentFeeRatePercent: 0, metaAds: 0, googleAds: 0, influencer: 0 });
    const amazon  = amazonProfit({ ...zero, fulfillmentCosts: 0, feeRatePercent: 0, amazonPpc: 0 });
    const tiktok  = tiktokProfit({ ...zero, feeRatePercent: 0, tiktokAds: 0 });
    const agg = aggregateDay({ webshop, amazon, tiktok });
    expect(agg.totalMargin).toBeNull();
  });
});
