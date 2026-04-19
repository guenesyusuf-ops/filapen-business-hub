'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';
import { ShoppingBag, TrendingUp, Store, Video, BarChart3, GripVertical } from 'lucide-react';

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

function ChannelCard({ channel, dragHandleProps }: { channel: ChannelPnL; dragHandleProps?: any }) {
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
        {dragHandleProps && (
          <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 flex-shrink-0">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
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

        {/* ROAS + Marge */}
        <div className="flex items-center gap-3 py-2 border-t border-gray-100 dark:border-white/5">
          <div className="flex-1 text-center">
            <p className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">
              {channel.adSpend > 0 ? (channel.grossRevenue / channel.adSpend).toFixed(2) + 'x' : '–'}
            </p>
            <p className="text-[9px] text-gray-400">ROAS</p>
          </div>
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />
          <div className="flex-1 text-center">
            <p className={cn(
              'text-xs font-bold tabular-nums',
              channel.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
            )}>
              {channel.grossRevenue > 0 ? ((channel.netProfit / channel.grossRevenue) * 100).toFixed(1) + '%' : '0%'}
            </p>
            <p className="text-[9px] text-gray-400">Marge</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview KPI Card (kumuliert)
// ---------------------------------------------------------------------------

function OverviewCard({ kpis, dragHandleProps }: { kpis: OverviewKPIs; dragHandleProps?: any }) {
  const items = [
    { label: 'Cost per Order', value: eur(kpis.costPerOrder), icon: <ShoppingBag className="h-3.5 w-3.5" />, color: 'text-blue-600' },
    { label: 'CAC', value: eur(kpis.cac), icon: <TrendingUp className="h-3.5 w-3.5" />, color: 'text-violet-600' },
    { label: 'Wiederkehrende Kunden', value: pct(kpis.returningCustomersPct), icon: <BarChart3 className="h-3.5 w-3.5" />, color: 'text-emerald-600' },
    { label: 'Ø Warenkorb', value: eur(kpis.avgOrderValue), icon: <Store className="h-3.5 w-3.5" />, color: 'text-orange-600' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-white/5">
        {dragHandleProps && (
          <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 flex-shrink-0">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
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
  amazonDays?: number;
}

export function ChannelPnLCards({ pnl, loading, amazonDays = 30 }: ChannelPnLCardsProps) {
  const amazonQuery = useQuery({
    queryKey: ['amazon', 'sales-for-finance', amazonDays],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_URL}/api/amazon/dashboard?days=${amazonDays}`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) return null;
        return res.json();
      } catch { return null; }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const amazon = amazonQuery.data;

  if ((loading && !amazon) || !pnl) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
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

  // ---- Shopify P&L ----
  const grossRevShopify = pnl.netRevenue ?? pnl.grossRevenue;
  const vatShopify = pnl.totalVat ?? (grossRevShopify * 0.19 / 1.19);
  const shopifyOrders = pnl.orderCount ?? 0;
  const shopifyAvgOrder = shopifyOrders > 0 ? grossRevShopify / shopifyOrders : 0;
  const shopifyNetProfit = pnl.netProfit ?? (grossRevShopify - vatShopify - (pnl.adSpend ?? 0) - (pnl.cogs ?? 0) - (pnl.shippingCosts ?? 0) - (pnl.paymentFees ?? 0));

  // ---- Amazon P&L ----
  const amzRevenue = amazon?.totalRevenue ?? 0;
  const amzOrders = amazon?.totalOrders ?? 0;
  // Amazon FBA: ~15% referral fee, ~19% VAT (already included in totalRevenue)
  const amzVat = amzRevenue * 0.19 / 1.19;                     // MwSt herausrechnen
  const amzPlatformFees = amzRevenue * 0.15;                    // ~15% Amazon Referral Fee
  const amzShipping = amzRevenue * 0.08;                        // ~8% FBA fulfillment estimate
  const amzNetProfit = amzRevenue - amzVat - amzPlatformFees - amzShipping;
  const amzAvgOrder = amzOrders > 0 ? amzRevenue / amzOrders : 0;

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
      netProfit: shopifyNetProfit,
      orderCount: shopifyOrders,
      avgOrderValue: shopifyAvgOrder,
    },
    {
      name: 'Amazon',
      icon: <Store className="h-4 w-4" />,
      color: '#FF9900',
      grossRevenue: amzRevenue,
      vat: amzVat,
      adSpend: 0,            // Amazon Ads API not connected yet
      cogs: 0,               // Same products — COGS tracked in Shopify for now
      shippingCosts: amzShipping,
      platformFees: amzPlatformFees,
      netProfit: amzNetProfit,
      orderCount: amzOrders,
      avgOrderValue: amzAvgOrder,
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

  // Drag-to-reorder with localStorage persistence
  const STORAGE_KEY = 'filapen-channel-card-order';
  const allCards = [
    ...channels.map((ch) => ({ type: 'channel' as const, key: ch.name, channel: ch })),
    { type: 'overview' as const, key: 'overview', kpis: overviewKPIs },
  ];

  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return allCards.map((c) => c.key);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return allCards.map((c) => c.key);
  });

  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  // Ensure all keys exist (in case new channels added)
  const orderedCards = [...cardOrder.filter((k) => allCards.some((c) => c.key === k)), ...allCards.filter((c) => !cardOrder.includes(c.key)).map((c) => c.key)]
    .map((key) => allCards.find((c) => c.key === key))
    .filter(Boolean) as typeof allCards;

  function handleDragStart(key: string) {
    setDraggingKey(key);
  }

  function handleDragOver(e: React.DragEvent, targetKey: string) {
    e.preventDefault();
    if (!draggingKey || draggingKey === targetKey) return;
    const newOrder = [...orderedCards.map((c) => c.key)];
    const fromIdx = newOrder.indexOf(draggingKey);
    const toIdx = newOrder.indexOf(targetKey);
    if (fromIdx < 0 || toIdx < 0) return;
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggingKey);
    setCardOrder(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
  }

  function handleDragEnd() {
    setDraggingKey(null);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
      {orderedCards.map((card) => (
        <div
          key={card.key}
          draggable
          onDragStart={() => handleDragStart(card.key)}
          onDragOver={(e) => handleDragOver(e, card.key)}
          onDragEnd={handleDragEnd}
          className={cn(
            'transition-all',
            draggingKey === card.key && 'opacity-50 scale-[0.98]',
            draggingKey && draggingKey !== card.key && 'ring-2 ring-dashed ring-primary-300/50 rounded-xl',
          )}
        >
          {card.type === 'channel' ? (
            <ChannelCard
              channel={card.channel!}
              dragHandleProps={{
                onMouseDown: (e: any) => e.stopPropagation(),
              }}
            />
          ) : (
            <OverviewCard
              kpis={(card as any).kpis}
              dragHandleProps={{
                onMouseDown: (e: any) => e.stopPropagation(),
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
