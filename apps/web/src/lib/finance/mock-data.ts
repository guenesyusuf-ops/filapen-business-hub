import type {
  DashboardOverviewResult,
  PnLResult,
  ChannelPerformance,
  WaterfallSegment,
  AlertItem,
  AlertSeverityEnum,
} from '@filapen/shared/src/types/finance';

// ---------------------------------------------------------------------------
// Time Series (30 days of daily data)
// ---------------------------------------------------------------------------

function generateDailyData(): DashboardOverviewResult['revenueChart'] {
  const data: DashboardOverviewResult['revenueChart'] = [];
  const baseRevenue = 380000; // $3,800 in cents
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);
    const dateStr = date.toISOString().split('T')[0]!;

    // Add realistic variance
    const dayOfWeek = date.getUTCDay();
    const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 1.25 : 1.0;
    const noise = 0.85 + Math.random() * 0.3;
    const trend = 1 + (29 - i) * 0.003; // slight upward trend

    const grossRevenue = Math.round(baseRevenue * weekendFactor * noise * trend);
    const adSpend = Math.round(grossRevenue * (0.18 + Math.random() * 0.06));
    const netProfit = Math.round(grossRevenue * (0.2 + Math.random() * 0.1) - adSpend);

    data.push({ date: dateStr, grossRevenue, netProfit, adSpend });
  }

  return data;
}

const revenueChart = generateDailyData();

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export const MOCK_DASHBOARD_DATA: DashboardOverviewResult = {
  dateRange: {
    start: new Date(Date.now() - 29 * 86400000),
    end: new Date(),
  },
  kpis: {
    grossRevenue: {
      label: 'Gross Revenue',
      value: 12453200, // $124,532.00 in cents
      previousValue: 11280400,
      changePercent: 0.104,
      format: 'currency',
      currency: 'USD',
    },
    netProfit: {
      label: 'Net Profit',
      value: 3145000, // $31,450.00
      previousValue: 2876500,
      changePercent: 0.093,
      format: 'currency',
      currency: 'USD',
    },
    totalAdSpend: {
      label: 'Total Ad Spend',
      value: 2891400, // $28,914.00
      previousValue: 2654200,
      changePercent: 0.089,
      format: 'currency',
      currency: 'USD',
    },
    blendedRoas: {
      label: 'Blended ROAS',
      value: 3.2,
      previousValue: 3.0,
      changePercent: 0.067,
      format: 'number',
    },
    orderCount: {
      label: 'Orders',
      value: 1847,
      previousValue: 1692,
      changePercent: 0.092,
      format: 'number',
    },
    avgOrderValue: {
      label: 'AOV',
      value: 6742, // $67.42
      previousValue: 6668,
      changePercent: 0.011,
      format: 'currency',
      currency: 'USD',
    },
    refundRate: {
      label: 'Refund Rate',
      value: 0.032,
      previousValue: 0.041,
      changePercent: -0.22,
      format: 'percent',
    },
    newCustomerRate: {
      label: 'New Customers',
      value: 0.38,
      previousValue: 0.35,
      changePercent: 0.086,
      format: 'percent',
    },
  },
  revenueChart,
};

// ---------------------------------------------------------------------------
// P&L Waterfall
// ---------------------------------------------------------------------------

export const MOCK_WATERFALL: WaterfallSegment[] = [
  { label: 'Gross Revenue', value: 12453200, type: 'positive' },
  { label: 'Discounts', value: -1245320, type: 'negative' },
  { label: 'Net Revenue', value: 11207880, type: 'subtotal' },
  { label: 'COGS', value: -3362364, type: 'negative' },
  { label: 'Gross Profit', value: 7845516, type: 'subtotal' },
  { label: 'Ad Spend', value: -2891400, type: 'negative' },
  { label: 'Shipping', value: -935100, type: 'negative' },
  { label: 'Payment Fees', value: -336236, type: 'negative' },
  { label: 'Fixed Costs', value: -537780, type: 'negative' },
  { label: 'Net Profit', value: 3145000, type: 'total' },
];

export const MOCK_PNL: PnLResult = {
  dateRange: {
    start: new Date(Date.now() - 29 * 86400000),
    end: new Date(),
  },
  grossRevenue: 12453200,
  discounts: 1245320,
  netRevenue: 11207880,
  cogs: 3362364,
  grossProfit: 7845516,
  grossMarginPercent: 0.63,
  adSpend: 2891400,
  shippingCosts: 935100,
  paymentFees: 336236,
  contributionMargin: 3682780,
  contributionMarginPercent: 0.296,
  fixedCosts: 537780,
  totalVat: 0,
  netProfit: 3145000,
  netMarginPercent: 0.253,
  waterfall: MOCK_WATERFALL,
};

// ---------------------------------------------------------------------------
// Channel Performance
// ---------------------------------------------------------------------------

export const MOCK_CHANNELS: ChannelPerformance[] = [
  {
    channel: 'Shopify DTC',
    spend: 0,
    revenue: 5234800,
    roas: 0,
    conversions: 782,
    cpa: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
  },
  {
    channel: 'Meta Ads',
    spend: 1456200,
    revenue: 4968400,
    roas: 3.41,
    conversions: 534,
    cpa: 2728,
    impressions: 1240000,
    clicks: 28400,
    ctr: 0.0229,
    cpc: 51,
  },
  {
    channel: 'Google Ads',
    spend: 892400,
    revenue: 3124600,
    roas: 3.50,
    conversions: 312,
    cpa: 2861,
    impressions: 890000,
    clicks: 19200,
    ctr: 0.0216,
    cpc: 46,
  },
  {
    channel: 'TikTok Ads',
    spend: 542800,
    revenue: 1625400,
    roas: 2.99,
    conversions: 164,
    cpa: 3310,
    impressions: 2100000,
    clicks: 42000,
    ctr: 0.02,
    cpc: 13,
  },
  {
    channel: 'Direct / Organic',
    spend: 0,
    revenue: 1500000,
    roas: 0,
    conversions: 245,
    cpa: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
  },
];

// ---------------------------------------------------------------------------
// Comparison Time Series (previous 30 days)
// ---------------------------------------------------------------------------

export function generateComparisonData(): {
  dates: string[];
  revenue: number[];
  profit: number[];
  comparisonRevenue: number[];
  comparisonProfit: number[];
} {
  const dates: string[] = [];
  const revenue: number[] = [];
  const profit: number[] = [];
  const comparisonRevenue: number[] = [];
  const comparisonProfit: number[] = [];

  for (const point of revenueChart) {
    dates.push(point.date);
    revenue.push(point.grossRevenue);
    profit.push(point.netProfit);
    // Previous period is ~8% lower on average
    comparisonRevenue.push(Math.round(point.grossRevenue * (0.88 + Math.random() * 0.08)));
    comparisonProfit.push(Math.round(point.netProfit * (0.85 + Math.random() * 0.1)));
  }

  return { dates, revenue, profit, comparisonRevenue, comparisonProfit };
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const MOCK_ALERTS: AlertItem[] = [
  {
    id: 'alert-1',
    type: 'roas_drop',
    severity: 'critical' as AlertSeverityEnum,
    message: 'TikTok Ads ROAS dropped below 3.0x target (currently 2.99x)',
    metric: 'roas',
    threshold: 3.0,
    currentValue: 2.99,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: 'active',
  },
  {
    id: 'alert-2',
    type: 'spend_spike',
    severity: 'warning' as AlertSeverityEnum,
    message: 'Meta Ads daily spend is 23% above 7-day average',
    metric: 'daily_spend',
    threshold: 52000,
    currentValue: 63960,
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    status: 'active',
  },
  {
    id: 'alert-3',
    type: 'refund_rate',
    severity: 'warning' as AlertSeverityEnum,
    message: 'Refund rate for "Premium Bundle" increased to 5.2% (threshold: 4%)',
    metric: 'refund_rate',
    threshold: 0.04,
    currentValue: 0.052,
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    status: 'active',
  },
  {
    id: 'alert-4',
    type: 'sync_error',
    severity: 'critical' as AlertSeverityEnum,
    message: 'Shopify order sync failed - retrying in 5 minutes',
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    status: 'active',
  },
  {
    id: 'alert-5',
    type: 'margin_improvement',
    severity: 'info' as AlertSeverityEnum,
    message: 'Gross margin improved to 63% (+2pp vs last period)',
    metric: 'gross_margin',
    currentValue: 0.63,
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    status: 'active',
  },
];
