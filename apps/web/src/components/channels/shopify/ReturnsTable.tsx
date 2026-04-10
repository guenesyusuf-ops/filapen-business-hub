'use client';

import { AnalyticsCard } from './AnalyticsCard';

interface ReturnRow {
  date: string;
  orderNumber: string;
  productTitle: string;
  status: string;
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return dateFormatter.format(d);
}

function statusBadge(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('refund')) return 'bg-red-500/10 text-red-400 border-red-500/30';
  if (s.includes('partial')) return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  return 'bg-white/5 text-gray-300 border-white/10';
}

export function ReturnsTable({ rows }: { rows: ReturnRow[] }) {
  return (
    <AnalyticsCard title="Rückgaben">
      {rows.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-gray-500">
          Keine Rückgaben im gewählten Zeitraum
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#111] text-[11px] uppercase tracking-wide text-gray-500">
              <tr className="border-b border-white/5">
                <th className="py-2 pr-3 text-left font-medium">Datum</th>
                <th className="py-2 pr-3 text-left font-medium">Bestellung</th>
                <th className="py-2 pr-3 text-left font-medium">Produkt</th>
                <th className="py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r, i) => (
                <tr key={`${r.orderNumber}-${i}`} className="text-gray-300">
                  <td className="py-2 pr-3 tabular-nums text-xs text-gray-400">
                    {formatDateLabel(r.date)}
                  </td>
                  <td className="py-2 pr-3 text-xs font-medium text-white">
                    #{r.orderNumber}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    <span className="line-clamp-1">{r.productTitle}</span>
                  </td>
                  <td className="py-2">
                    <span
                      className={[
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        statusBadge(r.status),
                      ].join(' ')}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AnalyticsCard>
  );
}
