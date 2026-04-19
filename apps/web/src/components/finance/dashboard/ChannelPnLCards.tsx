'use client';

import { cn } from '@/lib/utils';
import { ShoppingBag, TrendingUp, Store, Video, BarChart3 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChannelPnL {
  name: string;
  icon: React.ReactNode;
  color: string;
  grossRevenue: number;  // nach Retouren + Rabatten
  vat: number;           // Umsatzsteuer
  adSpend: number;       // Werbekosten
  cogs: number;          // Produktkosten
  shippingCosts: number; // Versandkosten
  platformFees: number;  // Plattformkosten
  netProfit: number;     // Nettogewinn
  orderCount: number;    // Bestellungen
  avgOrderValue: number; // Ø Warenkorb (grossRevenue / orderCount)
}

interface OverviewKPIs {
  costPerOrder: number;
  cac: number;
  returningCustomersPct: number;
  avgOrderValue: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eur(val: number): string {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function pct(val: number): string {
  return `${val.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Single Channel Card
// ---------------------------------------------------------------------------

function ChannelCard({ channel }: { channel: ChannelPnL }) {
  const rows = [
    { label: 'Bruttoumsatz', value: channel.grossRevenue, positive: true },
    { label: 'USt.', value: -channel.vat, negative: true },
    { label: 'Werbekosten', value: -channel.adSpend, negative: true },
    { label: 'Produktkosten', value: -channel.cogs, negative: true },
    { label: 'Versandkosten', value: -channel.shippingCosts, negative: true },
    { label: 'Plattformkosten', value: -channel.platformFees, negative: true },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-white/5">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${channel.color}15` }}>
          <div style={{ color: channel.color }}>{channel.icon}</div>
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{channel.name}</span>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{eur(channel.avgOrderValue)}</p>
          <p className="text-[9px] text-gray-400">Ø Warenkorb</p>
        </div>
      </div>

      {/* Rows */}
      <div className="px-4 py-2 space-y-0">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between py-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">{row.label}</span>
            <span className={cn(
              'text-xs font-semibold tabular-nums',
              row.negative ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
            )}>
              {row.negative ? `-${eur(Math.abs(row.value))}` : eur(row.value)}
            </span>
          </div>
        ))}

        {/* Nettogewinn */}
        <div className="flex items-center justify-between py-2 mt-1 border-t border-gray-200 dark:border-white/10">
          <span className="text-xs font-bold text-gray-900 dark:text-white">Nettogewinn</span>
          <span className={cn(
            'text-sm font-bold tabular-nums',
            channel.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
          )}>
            {eur(channel.netProfit)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview KPI Card (kumuliert)
// ---------------------------------------------------------------------------

function OverviewCard({ kpis }: { kpis: OverviewKPIs }) {
  const items = [
    { label: 'Cost per Order', value: eur(kpis.costPerOrder), icon: <ShoppingBag className="h-3.5 w-3.5" />, color: 'text-blue-600' },
    { label: 'CAC', value: eur(kpis.cac), icon: <TrendingUp className="h-3.5 w-3.5" />, color: 'text-violet-600' },
    { label: 'Wiederkehrende Kunden', value: pct(kpis.returningCustomersPct), icon: <BarChart3 className="h-3.5 w-3.5" />, color: 'text-emerald-600' },
    { label: 'Ø Warenkorb', value: eur(kpis.avgOrderValue), icon: <Store className="h-3.5 w-3.5" />, color: 'text-orange-600' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-white/5">
        <div className="h-8 w-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <BarChart3 className="h-4 w-4 text-primary-600" />
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">Übersicht (alle Kanäle)</span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-white/5">
        {items.map((item) => (
          <div key={item.label} className="px-4 py-3 text-center">
            <div className={cn('flex items-center justify-center gap-1 mb-1', item.color)}>
              {item.icon}
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{item.value}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

interface ChannelPnLCardsProps {
  pnl?: any; // PnLResult from backend
  loading?: boolean;
}

export function ChannelPnLCards({ pnl, loading }: ChannelPnLCardsProps) {
  if (loading || !pnl) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-6 animate-pulse">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Calculate VAT (19% of netRevenue as approximation if not provided)
  const vatRate = 0.19;
  const grossRevShopify = pnl.netRevenue ?? (pnl.grossRevenue - (pnl.discounts ?? 0));
  const vatShopify = grossRevShopify * vatRate / (1 + vatRate); // USt aus Brutto rausrechnen

  const shopifyOrders = pnl.orderCount ?? 0;
  const shopifyAvgOrder = shopifyOrders > 0 ? grossRevShopify / shopifyOrders : 0;

  const channels: ChannelPnL[] = [
    {
      name: 'Shopify',
      icon: <ShoppingBag className="h-4 w-4" />,
      color: '#95BF47',
      grossRevenue: grossRevShopify,
      vat: vatShopify,
      adSpend: pnl.adSpend ?? 0,
      cogs: pnl.cogs ?? 0,
      shippingCosts: pnl.shippingCosts ?? 0,
      platformFees: pnl.paymentFees ?? 0,
      netProfit: grossRevShopify - vatShopify - (pnl.adSpend ?? 0) - (pnl.cogs ?? 0) - (pnl.shippingCosts ?? 0) - (pnl.paymentFees ?? 0) - (pnl.fixedCosts ?? 0),
      orderCount: shopifyOrders,
      avgOrderValue: shopifyAvgOrder,
    },
    {
      name: 'Amazon',
      icon: <Store className="h-4 w-4" />,
      color: '#FF9900',
      grossRevenue: 0,
      vat: 0,
      adSpend: 0,
      cogs: 0,
      shippingCosts: 0,
      platformFees: 0,
      netProfit: 0,
      orderCount: 0,
      avgOrderValue: 0,
    },
    {
      name: 'TikTok',
      icon: <Video className="h-4 w-4" />,
      color: '#000000',
      grossRevenue: 0,
      vat: 0,
      adSpend: 0,
      cogs: 0,
      shippingCosts: 0,
      platformFees: 0,
      netProfit: 0,
      orderCount: 0,
      avgOrderValue: 0,
    },
  ];

  // Calculate overview KPIs — kumuliert über alle Kanäle
  const totalRevenue = channels.reduce((s, c) => s + c.grossRevenue, 0);
  const totalAdSpend = channels.reduce((s, c) => s + c.adSpend, 0);
  const totalOrders = channels.reduce((s, c) => s + c.orderCount, 0);
  const newCustomerRate = pnl.newCustomerRate ?? 0;

  // Ø Warenkorb = Gesamtumsatz aller Kanäle / Gesamtbestellungen aller Kanäle
  const avgOrderValueAll = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const overviewKPIs: OverviewKPIs = {
    costPerOrder: totalOrders > 0 ? (totalAdSpend + channels.reduce((s, c) => s + c.shippingCosts, 0) + channels.reduce((s, c) => s + c.platformFees, 0)) / totalOrders : 0,
    cac: totalOrders > 0 ? totalAdSpend / Math.max(1, totalOrders * (newCustomerRate / 100)) : 0,
    returningCustomersPct: 100 - newCustomerRate,
    avgOrderValue: avgOrderValueAll,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {channels.map((ch) => (
        <ChannelCard key={ch.name} channel={ch} />
      ))}
      <OverviewCard kpis={overviewKPIs} />
    </div>
  );
}
