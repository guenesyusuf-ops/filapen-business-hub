// =============================================================================
// Core Finance Types - Shared between API and Web
// =============================================================================

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum OrderStatusEnum {
  Open = 'open',
  Closed = 'closed',
  Cancelled = 'cancelled',
}

export enum IntegrationProvider {
  Shopify = 'shopify',
  MetaAds = 'meta_ads',
  GoogleAds = 'google_ads',
}

export enum IntegrationStatusEnum {
  Connected = 'connected',
  Disconnected = 'disconnected',
  Error = 'error',
}

export enum AlertSeverityEnum {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}

// ---------------------------------------------------------------------------
// Date & Range
// ---------------------------------------------------------------------------

export interface DateRange {
  start: Date;
  end: Date;
}

export type DatePreset = 'today' | '7d' | '30d' | '90d' | 'ytd';

// ---------------------------------------------------------------------------
// KPI & Dashboard
// ---------------------------------------------------------------------------

export interface KpiValue {
  label: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  format: 'currency' | 'percent' | 'number';
  currency?: string;
}

export interface DashboardOverviewResult {
  dateRange: DateRange;
  kpis: {
    grossRevenue: KpiValue;
    netProfit: KpiValue;
    totalAdSpend: KpiValue;
    blendedRoas: KpiValue;
    orderCount: KpiValue;
    avgOrderValue: KpiValue;
    refundRate: KpiValue;
    newCustomerRate: KpiValue;
  };
  revenueChart: Array<{
    date: string;
    grossRevenue: number;
    netProfit: number;
    adSpend: number;
  }>;
}

// ---------------------------------------------------------------------------
// P&L / Waterfall
// ---------------------------------------------------------------------------

export interface WaterfallSegment {
  label: string;
  value: number;
  type: 'positive' | 'negative' | 'subtotal' | 'total';
  color?: string;
}

export interface PnLResult {
  dateRange: DateRange;
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  adSpend: number;
  shippingCosts: number;
  paymentFees: number;
  contributionMargin: number;
  contributionMarginPercent: number;
  fixedCosts: number;
  netProfit: number;
  netMarginPercent: number;
  waterfall: WaterfallSegment[];
}

// ---------------------------------------------------------------------------
// Channel Performance
// ---------------------------------------------------------------------------

export interface ChannelPerformance {
  channel: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  cpa: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
}

// ---------------------------------------------------------------------------
// Product Profitability
// ---------------------------------------------------------------------------

export interface ProductProfitability {
  productId: string;
  title: string;
  sku: string | null;
  imageUrl: string | null;
  unitsSold: number;
  grossRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  refundCount: number;
  refundRate: number;
}

// ---------------------------------------------------------------------------
// Cost Management
// ---------------------------------------------------------------------------

export type CostFrequency = 'one-time' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type CostCategory = 'software' | 'payroll' | 'rent' | 'marketing' | 'shipping' | 'other';

export interface PaymentMethod {
  id: string;
  name: string;
  fixedFeePerTransaction: number;
  percentageFee: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface FixedCost {
  id: string;
  name: string;
  amount: number;
  currency: string;
  frequency: CostFrequency;
  category: CostCategory;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsListResponse {
  products: ProductProfitability[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Integration & Sync
// ---------------------------------------------------------------------------

export interface IntegrationSummary {
  id: string;
  provider: IntegrationProvider;
  status: IntegrationStatusEnum;
  lastSyncedAt: string | null;
  errorMessage?: string;
}

export interface SyncLogEntry {
  id: string;
  integrationId: string;
  syncType: 'webhook' | 'scheduled' | 'manual' | 'backfill';
  status: 'started' | 'completed' | 'failed';
  recordsProcessed: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export interface AlertItem {
  id: string;
  type: string;
  severity: AlertSeverityEnum;
  message: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  createdAt: string;
  status: 'active' | 'acknowledged' | 'resolved';
}
