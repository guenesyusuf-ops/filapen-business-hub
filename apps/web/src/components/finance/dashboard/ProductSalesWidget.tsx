'use client';

import { Package } from 'lucide-react';
import { useProductSales } from '@/hooks/finance/useProductSales';

// ---------------------------------------------------------------------------
// Formatters (German locale)
// ---------------------------------------------------------------------------

const eurFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const intFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export function ProductSalesWidget() {
  const { data, isLoading, isError, error } = useProductSales();

  return (
    <div className="rounded-xl border border-white/5 bg-[#111] p-5 text-white shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.03]">
            <Package className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Verkäufe pro Produkt
            </h3>
            <p className="text-[11px] text-gray-500">
              Umsatz nach Produkt im gewählten Zeitraum
            </p>
          </div>
        </div>
        {data && !isLoading && !isError && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              Gesamtumsatz
            </div>
            <div className="text-sm font-semibold text-white">
              {eurFormatter.format(data.totalRevenue)}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-md bg-white/[0.03]"
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 p-4 text-xs text-red-300">
          <strong>Fehler beim Laden der Produktverkäufe.</strong>{' '}
          {error instanceof Error ? error.message : 'Bitte erneut versuchen.'}
        </div>
      )}

      {!isLoading && !isError && data && data.products.length === 0 && (
        <div className="py-10 text-center text-xs text-gray-500">
          Keine Produktverkäufe im gewählten Zeitraum.
        </div>
      )}

      {!isLoading && !isError && data && data.products.length > 0 && (
        <div className="max-h-[440px] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-[#111]">
              <tr className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                <th className="border-b border-white/5 py-2 pr-3 text-left w-8">
                  #
                </th>
                <th className="border-b border-white/5 py-2 pr-3 text-left">
                  Produkt
                </th>
                <th className="border-b border-white/5 py-2 pr-3 text-right w-24">
                  Verkäufe
                </th>
                <th className="border-b border-white/5 py-2 pr-3 text-right w-32">
                  Umsatz
                </th>
                <th className="border-b border-white/5 py-2 text-right w-44">
                  Anteil
                </th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((row, idx) => (
                <tr
                  key={`${row.productId ?? 'np'}-${idx}`}
                  className="group hover:bg-white/[0.02]"
                >
                  <td className="border-b border-white/5 py-2.5 pr-3 text-xs text-gray-500">
                    {idx + 1}
                  </td>
                  <td
                    className="max-w-0 truncate border-b border-white/5 py-2.5 pr-3 text-xs text-white"
                    title={row.title}
                  >
                    {row.title}
                  </td>
                  <td className="border-b border-white/5 py-2.5 pr-3 text-right text-xs tabular-nums text-gray-300">
                    {intFormatter.format(row.salesCount)}
                  </td>
                  <td className="border-b border-white/5 py-2.5 pr-3 text-right text-xs tabular-nums text-white">
                    {eurFormatter.format(row.revenue)}
                  </td>
                  <td className="border-b border-white/5 py-2.5 text-right text-xs tabular-nums text-gray-300">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, row.percentage))}%`,
                          }}
                        />
                      </div>
                      <span className="w-12 text-right">
                        {percentFormatter.format(row.percentage)} %
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
