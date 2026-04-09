'use client';

import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import {
  ArrowUpDown,
  ShoppingBag,
  Facebook,
  Search,
  Music2,
  Globe,
  ChevronRight,
} from 'lucide-react';
import type { ChannelPerformance } from '@filapen/shared/src/types/finance';
import { formatDollars, formatNumber } from '@filapen/shared/src/utils/money';
import { cn } from '@/lib/utils';

interface ChannelTableProps {
  data: ChannelPerformance[];
  onChannelClick: (channel: string) => void;
  loading?: boolean;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  'Shopify DTC': <ShoppingBag className="h-4 w-4 text-green-600" />,
  'Meta Ads': <Facebook className="h-4 w-4 text-blue-600" />,
  'Google Ads': <Search className="h-4 w-4 text-yellow-600" />,
  'TikTok Ads': <Music2 className="h-4 w-4 text-gray-900" />,
  'Direct / Organic': <Globe className="h-4 w-4 text-purple-600" />,
};

function roasColor(roas: number): string {
  if (roas === 0) return 'text-gray-400';
  if (roas >= 2.0) return 'text-emerald-600';
  if (roas >= 1.0) return 'text-amber-600';
  return 'text-red-600';
}

function roasBgColor(roas: number): string {
  if (roas === 0) return 'bg-gray-50';
  if (roas >= 2.0) return 'bg-emerald-50';
  if (roas >= 1.0) return 'bg-amber-50';
  return 'bg-red-50';
}

function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

function TableSkeleton() {
  return (
    <div className="relative rounded-xl bg-white shadow-card overflow-hidden">
      <div className="absolute inset-0 shimmer-bg animate-shimmer" />
      <div className="relative p-5">
        <div className="h-4 w-44 rounded-full bg-gray-200/60 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-100/60" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChannelTable({ data, onChannelClick, loading }: ChannelTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'revenue', desc: true },
  ]);

  // Values are in DOLLARS from the API
  const columns = useMemo<ColumnDef<ChannelPerformance>[]>(
    () => [
      {
        accessorKey: 'channel',
        header: 'Channel',
        cell: ({ row }) => {
          const channel = row.original.channel;
          return (
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-gray-50">
                {CHANNEL_ICONS[channel] ?? <Globe className="h-4 w-4 text-gray-400" />}
              </span>
              <span className="font-medium text-gray-900">{channel}</span>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'revenue',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => column.toggleSorting()}
          >
            Revenue <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-900 font-semibold tabular-nums">{formatDollars(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'spend',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => column.toggleSorting()}
          >
            Ad Spend <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span className="text-gray-600 tabular-nums">
              {val > 0 ? formatDollars(val) : '--'}
            </span>
          );
        },
      },
      {
        accessorKey: 'roas',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => column.toggleSorting()}
          >
            ROAS <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return val > 0 ? (
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
              roasColor(val),
              roasBgColor(val),
            )}>
              {val.toFixed(2)}x
            </span>
          ) : (
            <span className="text-gray-400">--</span>
          );
        },
      },
      {
        id: 'profit',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => column.toggleSorting()}
          >
            Profit <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        accessorFn: (row) => row.revenue - row.spend,
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span className={cn('font-semibold tabular-nums', val >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {formatDollars(val)}
            </span>
          );
        },
      },
      {
        id: 'margin',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => column.toggleSorting()}
          >
            Margin <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        accessorFn: (row) => (row.revenue > 0 ? (row.revenue - row.spend) / row.revenue : 0),
        cell: ({ getValue }) => (
          <span className="text-gray-600 tabular-nums">{formatPercent(getValue<number>(), 1)}</span>
        ),
      },
      {
        accessorKey: 'conversions',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => column.toggleSorting()}
          >
            Orders <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-600 tabular-nums">{formatNumber(getValue<number>())}</span>
        ),
      },
    ],
    [],
  );

  const totals = useMemo(() => {
    const totalRevenue = data.reduce((sum, r) => sum + r.revenue, 0);
    const totalSpend = data.reduce((sum, r) => sum + r.spend, 0);
    const totalConversions = data.reduce((sum, r) => sum + r.conversions, 0);
    const totalProfit = totalRevenue - totalSpend;
    const totalMargin = totalRevenue > 0 ? totalProfit / totalRevenue : 0;
    const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    return { totalRevenue, totalSpend, totalConversions, totalProfit, totalMargin, totalRoas };
  }, [data]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return <TableSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Channel Performance</h3>
        <div className="py-12 text-center text-gray-400 text-sm">No channel data available</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow-card overflow-hidden transition-shadow duration-200 hover:shadow-card-hover">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-gray-900">Channel Performance</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-y border-gray-100 bg-gray-50/50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                {/* Extra header for arrow indicator */}
                <th className="w-8" />
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => (
              <tr
                key={row.id}
                className={cn(
                  'group cursor-pointer transition-all duration-150',
                  'hover:bg-primary-50/30',
                  index % 2 === 1 ? 'bg-gray-50/30' : 'bg-white',
                  index < table.getRowModel().rows.length - 1 && 'border-b border-gray-100/80',
                )}
                onClick={() => onChannelClick(row.original.channel)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-5 py-3.5 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <td className="pr-3">
                  <ChevronRight className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50/80">
              <td className="px-5 py-3.5 font-semibold text-gray-900">Total</td>
              <td className="px-5 py-3.5 font-semibold text-gray-900 tabular-nums">
                {formatDollars(totals.totalRevenue)}
              </td>
              <td className="px-5 py-3.5 font-semibold text-gray-600 tabular-nums">
                {formatDollars(totals.totalSpend)}
              </td>
              <td className="px-5 py-3.5">
                {totals.totalRoas > 0 ? (
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                    roasColor(totals.totalRoas),
                    roasBgColor(totals.totalRoas),
                  )}>
                    {totals.totalRoas.toFixed(2)}x
                  </span>
                ) : (
                  <span className="text-gray-400">--</span>
                )}
              </td>
              <td
                className={cn(
                  'px-5 py-3.5 font-semibold tabular-nums',
                  totals.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600',
                )}
              >
                {formatDollars(totals.totalProfit)}
              </td>
              <td className="px-5 py-3.5 font-semibold text-gray-600 tabular-nums">
                {formatPercent(totals.totalMargin, 1)}
              </td>
              <td className="px-5 py-3.5 font-semibold text-gray-600 tabular-nums">
                {formatNumber(totals.totalConversions)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
