'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';
import { ShoppingBag, TrendingUp, DollarSign, BarChart3, Target, AlertTriangle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Date range presets
// ---------------------------------------------------------------------------

const DATE_PRESETS = [
  { label: 'Heute', days: 0 },
  { label: '7 Tage', days: 7 },
  { label: '14 Tage', days: 14 },
  { label: '30 Tage', days: 30 },
  { label: '60 Tage', days: 60 },
  { label: '90 Tage', days: 90 },
  { label: 'Dieses Jahr', days: -1 },
];

function getDaysForPreset(preset: typeof DATE_PRESETS[number]): number {
  if (preset.days === -1) {
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((now.getTime() - jan1.getTime()) / 86_400_000);
  }
  return preset.days || 1;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AmazonDashboard {
  totalOrders: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  avgOrderValue: number;
  currency: string;
  orders: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    date: string;
    items: number;
  }[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useAmazonDashboard(days: number) {
  return useQuery<AmazonDashboard>({
    queryKey: ['amazon', 'dashboard', days],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/amazon/dashboard?days=${days}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Amazon-Daten nicht verfügbar');
      return res.json();
    },
    retry: 1,
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eur(val: number, currency = 'EUR'): string {
  return val.toLocaleString('de-DE', { style: 'currency', currency, minimumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AmazonDashboardPage() {
  const [selectedPreset, setSelectedPreset] = useState(3); // default 30 Tage
  const days = getDaysForPreset(DATE_PRESETS[selectedPreset]);
  const { data, isLoading, error } = useAmazonDashboard(days);

  // Placeholder values until we have ads data
  const adSpend = 0;
  const roas = adSpend > 0 && data ? (data.totalRevenue / adSpend) : 0;
  const profit = data ? data.totalRevenue * 0.81 - adSpend : 0; // Rough: revenue - 19% VAT - ads (COGS not tracked on Amazon yet)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header + Date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Amazon</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">Bestellungen, Umsatz und Performance</p>
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-white/[0.06] p-0.5 overflow-x-auto flex-shrink-0">
          {DATE_PRESETS.map((preset, i) => (
            <button
              key={preset.label}
              onClick={() => setSelectedPreset(i)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                selectedPreset === i
                  ? 'bg-white dark:bg-[#1a1d2e] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Amazon-Verbindung fehlgeschlagen</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Bitte prüfe die API-Credentials in den Railway-Variablen.</p>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* 5 KPI Cards — same as Shopify */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
            {/* Umsatz */}
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-orange-600" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Umsatz</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{eur(data.totalRevenue, data.currency)}</p>
            </div>

            {/* Gewinn */}
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Gewinn</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{eur(profit, data.currency)}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">Exkl. Amazon-Gebühren (bald automatisch)</p>
            </div>

            {/* Werbekosten */}
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-red-600" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Werbekosten</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{eur(adSpend)}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">Amazon Ads API nötig</p>
            </div>

            {/* ROAS */}
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Target className="h-4 w-4 text-violet-600" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">ROAS</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{roas > 0 ? roas.toFixed(2) + 'x' : '–'}</p>
            </div>

            {/* Bestellungen */}
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <ShoppingBag className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Bestellungen</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{data.totalOrders}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">Ø {eur(data.avgOrderValue)} pro Bestellung</p>
            </div>
          </div>

          {/* Orders table */}
          <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Bestellungen ({data.totalOrders})</span>
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/5">
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Bestellung</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Betrag</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Artikel</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                  {data.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                      <td className="px-5 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{o.id.slice(-8)}</td>
                      <td className="px-5 py-3">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', o.status === 'Shipped' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400')}>
                          {o.status === 'Shipped' ? 'Versendet' : o.status === 'Unshipped' ? 'Offen' : o.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{eur(o.amount, o.currency)}</td>
                      <td className="px-5 py-3 text-gray-500">{o.items}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(o.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-white/5">
              {data.orders.map((o) => (
                <div key={o.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-500">#{o.id.slice(-8)}</span>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', o.status === 'Shipped' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                      {o.status === 'Shipped' ? 'Versendet' : 'Offen'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{eur(o.amount, o.currency)}</span>
                    <span className="text-xs text-gray-400">{formatDate(o.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
