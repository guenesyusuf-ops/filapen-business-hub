'use client';

import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';
import { ShoppingBag, TrendingUp, Package, DollarSign, BarChart3, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function useAmazonDashboard() {
  return useQuery<AmazonDashboard>({
    queryKey: ['amazon', 'dashboard'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/amazon/dashboard`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Amazon-Daten nicht verfügbar');
      return res.json();
    },
    retry: 1,
    staleTime: 5 * 60_000,
  });
}

function formatCurrency(val: number, currency = 'EUR'): string {
  return val.toLocaleString('de-DE', { style: 'currency', currency });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AmazonDashboardPage() {
  const { data, isLoading, error } = useAmazonDashboard();

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Amazon</h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">Bestellungen, Umsatz und Performance</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
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
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-3 sm:p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{data.totalOrders}</p>
                <p className="text-[10px] sm:text-xs text-gray-500">Bestellungen (30 Tage)</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-3 sm:p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(data.totalRevenue, data.currency)}</p>
                <p className="text-[10px] sm:text-xs text-gray-500">Umsatz (30 Tage)</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-3 sm:p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{data.todayOrders}</p>
                <p className="text-[10px] sm:text-xs text-gray-500">Heute</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] p-3 sm:p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(data.avgOrderValue, data.currency)}</p>
                <p className="text-[10px] sm:text-xs text-gray-500">Ø Warenkorb</p>
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Letzte Bestellungen</span>
            </div>

            {/* Desktop table */}
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
                  {data.orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                      <td className="px-5 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{order.id.slice(-8)}</td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full',
                          order.status === 'Shipped' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700',
                        )}>
                          {order.status === 'Shipped' ? 'Versendet' : order.status === 'Unshipped' ? 'Offen' : order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{formatCurrency(order.amount, order.currency)}</td>
                      <td className="px-5 py-3 text-gray-500">{order.items}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(order.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-white/5">
              {data.orders.map((order) => (
                <div key={order.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-500">#{order.id.slice(-8)}</span>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      order.status === 'Shipped' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                    )}>
                      {order.status === 'Shipped' ? 'Versendet' : 'Offen'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(order.amount, order.currency)}</span>
                    <span className="text-xs text-gray-400">{formatDate(order.date)}</span>
                  </div>
                </div>
              ))}
            </div>

            {data.orders.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400">Keine Bestellungen in den letzten 30 Tagen</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
