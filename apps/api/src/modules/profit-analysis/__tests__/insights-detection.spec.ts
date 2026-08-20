import { describe, it, expect } from 'vitest';
import {
  detectRoasChange, detectRevenueStreak, detectMarginThreshold,
  detectAdsOutpacingRevenue, detectAnomaly, detectRunRateTargetGap,
  periodRoas, aggregateRange, DailyPoint,
} from '../insights/detection-rules';
import { lastNCompleteDays, previousNDays, monthToDate, sameMonthRangeInPreviousMonth } from '../insights/period-helpers';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function mkPoint(date: string, o: Partial<DailyPoint> = {}): DailyPoint {
  return {
    date,
    netSales: o.netSales ?? 0,
    profit: o.profit ?? 0,
    margin: o.margin ?? null,
    ads: o.ads ?? { meta: 0, google: 0, influencer: 0, amazonPpc: 0, tiktokAds: 0 },
    channels: o.channels ?? {
      shopify: { grossAdjusted: 0, net: 0, ads: { meta: 0, google: 0, influencer: 0 } },
      amazon:  { grossAdjusted: 0, net: 0, ads: { amazonPpc: 0 } },
      tiktok:  { grossAdjusted: 0, net: 0, ads: { tiktokAds: 0 } },
    },
  };
}

// -----------------------------------------------------------------------------
// §11 ROAS Zeitraum
// -----------------------------------------------------------------------------

describe('periodRoas (§11)', () => {
  it('Sum(sales) / Sum(ads), nicht Durchschnitt der Tages-ROAS', () => {
    expect(periodRoas(10000, 2000)).toBe(5);
  });
  it('NULL bei Ads=0', () => {
    expect(periodRoas(10000, 0)).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// §12 Zeitraum-Helpers
// -----------------------------------------------------------------------------

describe('lastNCompleteDays + previousNDays (§12)', () => {
  it('endet gestern, nicht heute (heute ist unvollstaendig)', () => {
    const today = new Date('2026-08-20T15:30:00Z');
    const last7 = lastNCompleteDays(7, today);
    expect(last7.to.toISOString().slice(0, 10)).toBe('2026-08-19');
    expect(last7.from.toISOString().slice(0, 10)).toBe('2026-08-13');
    expect(last7.dayCount).toBe(7);
  });
  it('previousNDays liegt exakt vor lastN', () => {
    const today = new Date('2026-08-20T15:30:00Z');
    const last7 = lastNCompleteDays(7, today);
    const prev7 = previousNDays(last7, 7);
    expect(prev7.to.toISOString().slice(0, 10)).toBe('2026-08-12');
    expect(prev7.from.toISOString().slice(0, 10)).toBe('2026-08-06');
  });
});

describe('monthToDate + sameMonthRangeInPreviousMonth (§15)', () => {
  it('MTD endet gestern', () => {
    const today = new Date('2026-08-18T10:00:00Z');
    const mtd = monthToDate(today);
    expect(mtd.from.toISOString().slice(0, 10)).toBe('2026-08-01');
    expect(mtd.to.toISOString().slice(0, 10)).toBe('2026-08-17');
  });
  it('Vormonats-Equivalent: 01.-17. Juli fuer MTD 01.-17. Aug', () => {
    const today = new Date('2026-08-18T10:00:00Z');
    const mtd = monthToDate(today);
    const same = sameMonthRangeInPreviousMonth(mtd);
    expect(same.from.toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(same.to.toISOString().slice(0, 10)).toBe('2026-07-17');
  });
});

// -----------------------------------------------------------------------------
// §19 ROAS-Vergleich (Rolling 7d)
// -----------------------------------------------------------------------------

describe('detectRoasChange (§12/§19)', () => {
  const today = new Date('2026-08-20T00:00:00Z');
  const currentRange = lastNCompleteDays(7, today);
  const previousRange = previousNDays(currentRange, 7);
  const days = (start: string, n: number) => Array.from({ length: n }, (_, i) => {
    const d = new Date(start); d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  it('erkennt starken Rueckgang (ROAS von 3.34 → 2.81, ~-15.9%)', () => {
    const currentPoints = days('2026-08-13', 7).map((d) => mkPoint(d, {
      channels: { shopify: { grossAdjusted: 4064, net: 3420, ads: { meta: 800, google: 419, influencer: 0 } }, amazon: { grossAdjusted: 0, net: 0, ads: { amazonPpc: 0 } }, tiktok: { grossAdjusted: 0, net: 0, ads: { tiktokAds: 0 } } },
    }));
    const previousPoints = days('2026-08-06', 7).map((d) => mkPoint(d, {
      channels: { shopify: { grossAdjusted: 4440, net: 3728, ads: { meta: 800, google: 315, influencer: 0 } }, amazon: { grossAdjusted: 0, net: 0, ads: { amazonPpc: 0 } }, tiktok: { grossAdjusted: 0, net: 0, ads: { tiktokAds: 0 } } },
    }));
    const insight = detectRoasChange({ channel: 'webshop', currentRange, previousRange, currentPoints, previousPoints });
    expect(insight).not.toBeNull();
    expect(insight!.type).toBe('roas.rolling7d.dropped.webshop');
    expect(insight!.severity).toBe('warning');
    expect(insight!.currentValue).toBeCloseTo(2.81, 1);
    expect(insight!.comparisonValue).toBeCloseTo(3.34, 1);
    expect(insight!.percentageChange).toBeLessThan(-10);
  });

  it('gibt NULL wenn Aenderung unter Threshold', () => {
    const currentPoints  = days('2026-08-13', 7).map((d) => mkPoint(d, { channels: { shopify: { grossAdjusted: 1000, net: 840, ads: { meta: 300, google: 0, influencer: 0 } }, amazon: { grossAdjusted: 0, net: 0, ads: { amazonPpc: 0 } }, tiktok: { grossAdjusted: 0, net: 0, ads: { tiktokAds: 0 } } } }));
    const previousPoints = days('2026-08-06', 7).map((d) => mkPoint(d, { channels: { shopify: { grossAdjusted: 1010, net: 848, ads: { meta: 300, google: 0, influencer: 0 } }, amazon: { grossAdjusted: 0, net: 0, ads: { amazonPpc: 0 } }, tiktok: { grossAdjusted: 0, net: 0, ads: { tiktokAds: 0 } } } }));
    const insight = detectRoasChange({ channel: 'webshop', currentRange, previousRange, currentPoints, previousPoints, minChangePct: 10 });
    expect(insight).toBeNull();
  });

  it('gibt NULL wenn Ads=0 (Division-Schutz)', () => {
    const currentPoints  = days('2026-08-13', 7).map((d) => mkPoint(d, { channels: { shopify: { grossAdjusted: 1000, net: 840, ads: { meta: 0, google: 0, influencer: 0 } }, amazon: { grossAdjusted: 0, net: 0, ads: { amazonPpc: 0 } }, tiktok: { grossAdjusted: 0, net: 0, ads: { tiktokAds: 0 } } } }));
    const previousPoints = days('2026-08-06', 7).map((d) => mkPoint(d, { channels: { shopify: { grossAdjusted: 900, net: 756, ads: { meta: 300, google: 0, influencer: 0 } }, amazon: { grossAdjusted: 0, net: 0, ads: { amazonPpc: 0 } }, tiktok: { grossAdjusted: 0, net: 0, ads: { tiktokAds: 0 } } } }));
    const insight = detectRoasChange({ channel: 'webshop', currentRange, previousRange, currentPoints, previousPoints });
    expect(insight).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// §14 Umsatz-Streak
// -----------------------------------------------------------------------------

describe('detectRevenueStreak (§14)', () => {
  it('erkennt 3 aufeinanderfolgende steigende Tage', () => {
    const insight = detectRevenueStreak({
      points: [
        mkPoint('2026-08-14', { netSales: 1000 }),
        mkPoint('2026-08-15', { netSales: 1100 }),
        mkPoint('2026-08-16', { netSales: 1250 }),
        mkPoint('2026-08-17', { netSales: 1400 }),
      ],
    });
    expect(insight).not.toBeNull();
    expect(insight!.type).toBe('revenue.streak.up');
    expect(insight!.severity).toBe('positive');
  });

  it('erkennt 3 aufeinanderfolgende fallende Tage', () => {
    const insight = detectRevenueStreak({
      points: [
        mkPoint('2026-08-14', { netSales: 2000 }),
        mkPoint('2026-08-15', { netSales: 1800 }),
        mkPoint('2026-08-16', { netSales: 1600 }),
        mkPoint('2026-08-17', { netSales: 1400 }),
      ],
    });
    expect(insight).not.toBeNull();
    expect(insight!.type).toBe('revenue.streak.down');
  });

  it('ignoriert Rauschen unter minStepPct', () => {
    const insight = detectRevenueStreak({
      points: [
        mkPoint('2026-08-14', { netSales: 1000 }),
        mkPoint('2026-08-15', { netSales: 1010 }),
        mkPoint('2026-08-16', { netSales: 1005 }),
        mkPoint('2026-08-17', { netSales: 1015 }),
      ],
      minStepPct: 2,
    });
    expect(insight).toBeNull();
  });

  it('NULL bei zu wenig Datenpunkten', () => {
    const insight = detectRevenueStreak({ points: [mkPoint('2026-08-19', { netSales: 100 })] });
    expect(insight).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// §17 Marge-Schwelle
// -----------------------------------------------------------------------------

describe('detectMarginThreshold (§17)', () => {
  const period = lastNCompleteDays(30, new Date('2026-08-20T00:00:00Z'));

  it('Marge < 20% = critical', () => {
    const i = detectMarginThreshold({ period, currentMargin: 18.7 });
    expect(i?.severity).toBe('critical');
    expect(i?.type).toBe('margin.critical');
  });
  it('Marge 25-30% = positive/good', () => {
    const i = detectMarginThreshold({ period, currentMargin: 27 });
    expect(i?.severity).toBe('positive');
    expect(i?.type).toBe('margin.good');
  });
  it('Marge >= 30% = target', () => {
    const i = detectMarginThreshold({ period, currentMargin: 32 });
    expect(i?.type).toBe('margin.target_reached');
  });
  it('Marge 20-25% = kein Insight (mittlerer Bereich)', () => {
    const i = detectMarginThreshold({ period, currentMargin: 22 });
    expect(i).toBeNull();
  });
  it('NULL bei nicht berechenbarer Marge', () => {
    const i = detectMarginThreshold({ period, currentMargin: null });
    expect(i).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// §18 Ads outpacing Revenue
// -----------------------------------------------------------------------------

describe('detectAdsOutpacingRevenue (§18)', () => {
  const today = new Date('2026-08-20T00:00:00Z');
  const currentRange = lastNCompleteDays(7, today);
  const previousRange = previousNDays(currentRange, 7);
  const days = (start: string, n: number) => Array.from({ length: n }, (_, i) => {
    const d = new Date(start); d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  it('warnt wenn Meta+Google +17% aber Shopify-Netto nur +4%', () => {
    const currentPoints  = days('2026-08-13', 7).map((d) => mkPoint(d, { channels: { shopify: { grossAdjusted: 1237, net: 1040, ads: { meta: 100, google: 40, influencer: 0 } }, amazon: { grossAdjusted: 0, net: 0, ads: { amazonPpc: 0 } }, tiktok: { grossAdjusted: 0, net: 0, ads: { tiktokAds: 0 } } } }));
    const previousPoints = days('2026-08-06', 7).map((d) => mkPoint(d, { channels: { shopify: { grossAdjusted: 1190, net: 1000, ads: { meta: 90, google: 30, influencer: 0 } }, amazon: { grossAdjusted: 0, net: 0, ads: { amazonPpc: 0 } }, tiktok: { grossAdjusted: 0, net: 0, ads: { tiktokAds: 0 } } } }));
    const i = detectAdsOutpacingRevenue({ currentRange, previousRange, currentPoints, previousPoints });
    expect(i).not.toBeNull();
    expect(i!.type).toBe('ads.outpacing_revenue.webshop');
  });
});

// -----------------------------------------------------------------------------
// §16 Umsatz steigt, Profit fällt (kombiniert)
// -----------------------------------------------------------------------------

describe('kombinierte Regel: Umsatz steigt, Profit fällt (§16)', () => {
  it('aggregateRange summiert korrekt', () => {
    const points = [
      mkPoint('2026-08-13', { netSales: 100, profit: 30 }),
      mkPoint('2026-08-14', { netSales: 200, profit: 60 }),
    ];
    const agg = aggregateRange(points);
    expect(agg.netSales).toBe(300);
    expect(agg.profit).toBe(90);
  });
});

// -----------------------------------------------------------------------------
// §28 Anomalie
// -----------------------------------------------------------------------------

describe('detectAnomaly (§28 Median + MAD)', () => {
  it('erkennt Ausreisser 3× MAD', () => {
    const history = [100, 105, 98, 102, 97, 103, 101, 99, 100, 104, 96, 102];
    const insight = detectAnomaly({
      metric: 'shopify_revenue',
      historyValues: history,
      currentValue: 250,
      currentDate: new Date('2026-08-20T00:00:00Z'),
      channel: 'webshop',
    });
    expect(insight).not.toBeNull();
    expect(insight!.type).toBe('anomaly.shopify_revenue');
    expect(insight!.severity).toBe('positive'); // hoeher als Median = positiv beim Umsatz
  });
  it('ignoriert normale Schwankung (currentValue nahe Median)', () => {
    const history = [100, 105, 98, 102, 97, 103, 101, 99, 100, 104, 96, 102];
    const insight = detectAnomaly({
      metric: 'shopify_revenue',
      historyValues: history,
      currentValue: 103,     // sehr nah am Median ~100.5, MAD-Score < 3
      currentDate: new Date('2026-08-20T00:00:00Z'),
      channel: 'webshop',
    });
    expect(insight).toBeNull();
  });
  it('warnt bei ungewoehnlich hohem Meta-Spend', () => {
    const history = [50, 55, 48, 52, 49, 51, 53, 47, 50, 52];
    const insight = detectAnomaly({
      metric: 'meta_spend',
      historyValues: history,
      currentValue: 200,
      currentDate: new Date('2026-08-20T00:00:00Z'),
      channel: 'webshop',
    });
    expect(insight?.severity).toBe('warning');
  });
});

// -----------------------------------------------------------------------------
// §27 Run-Rate Forecast
// -----------------------------------------------------------------------------

describe('detectRunRateTargetGap (§27)', () => {
  it('erkennt Umsatzziel unter Run-Rate', () => {
    const insights = detectRunRateTargetGap({
      year: 2026, month: 8,
      completedDays: 10, currentMtdNetSales: 30000, currentMtdProfit: 5000,
      monthlyRevenueTarget: 150000, monthlyProfitTarget: 30000,
    });
    // Run-Rate Umsatz: 30000/10 × 31 = 93000, Ziel 150000 → 62% → off_track
    const revenue = insights.find((i) => i.type.startsWith('forecast.revenue'));
    expect(revenue?.type).toBe('forecast.revenue.off_track');
    expect(revenue?.severity).toBe('warning');
  });

  it('erkennt Umsatzziel wahrscheinlich erreichbar', () => {
    const insights = detectRunRateTargetGap({
      year: 2026, month: 8,
      completedDays: 10, currentMtdNetSales: 50000, currentMtdProfit: 15000,
      monthlyRevenueTarget: 150000, monthlyProfitTarget: 30000,
    });
    // Run-Rate: 50000/10 × 31 = 155000 → 103% → on_track
    const revenue = insights.find((i) => i.type.startsWith('forecast.revenue'));
    expect(revenue?.type).toBe('forecast.revenue.on_track');
    expect(revenue?.severity).toBe('positive');
  });

  it('leere Liste wenn zu wenig Tage abgeschlossen', () => {
    const insights = detectRunRateTargetGap({
      year: 2026, month: 8,
      completedDays: 2, currentMtdNetSales: 5000, currentMtdProfit: 1000,
      monthlyRevenueTarget: 150000, monthlyProfitTarget: 30000,
    });
    expect(insights).toHaveLength(0);
  });
});
