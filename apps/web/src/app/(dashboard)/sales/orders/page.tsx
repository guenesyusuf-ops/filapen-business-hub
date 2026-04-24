'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Upload, AlertTriangle, Clock, FileText, Inbox, CheckCircle2 } from 'lucide-react';
import { salesApi, STATUS_LABELS, fmtDate, fmtMoney, urgencyOf, SalesOrderStatus } from '@/lib/sales';
import { PageHeader, Empty, btn, Badge } from '@/components/sales/SalesUI';
import { cn } from '@/lib/utils';

type UrgencyFilter = 'all' | 'urgent' | 'overdue';
type Tab = 'open' | 'done';

export default function SalesOrdersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [urgency, setUrgency] = useState<UrgencyFilter>('all');
  const [status, setStatus] = useState<SalesOrderStatus | 'all'>('all');
  const [tab, setTab] = useState<Tab>('open');

  async function load() {
    setLoading(true);
    try {
      const res = await salesApi.listOrders({
        search: search || undefined,
        urgency: urgency === 'all' ? undefined : urgency,
        status: status === 'all' ? undefined : status,
        archived: tab === 'done' ? 'true' : 'false',
        limit: '100',
      });
      setItems(res.items);
      setTotal(res.total);
      // Counts pro Tab fürs Badge — zwei Mini-Calls parallel zum Haupt-Load.
      // Limit=1 reicht weil nur res.total interessant ist; spart Payload.
      const [openRes, doneRes] = await Promise.all([
        salesApi.listOrders({ archived: 'false', limit: '1' }),
        salesApi.listOrders({ archived: 'true', limit: '1' }),
      ]);
      setOpenCount(openRes.total);
      setDoneCount(doneRes.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [urgency, status, tab]);

  const counts = useMemo(() => ({
    total,
    urgent: items.filter((i) => urgencyOf(i) === 'urgent').length,
    overdue: items.filter((i) => urgencyOf(i) === 'overdue').length,
  }), [items, total]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Verkauf"
        subtitle={
          tab === 'open'
            ? `${counts.total} offene Bestellungen — ${counts.urgent} dringend, ${counts.overdue} in Verzug`
            : `${counts.total} abgeschlossene Bestellungen`
        }
        actions={
          <div className="flex gap-2">
            <Link href="/sales/import" className={btn('secondary')}>
              <Upload className="h-4 w-4" /> Import
            </Link>
            <Link href="/sales/orders/new" className={btn('primary')}>
              <Plus className="h-4 w-4" /> Neue Bestellung
            </Link>
          </div>
        }
      />

      {/* Tabs: Offen / Abgeschlossen. shippedAt entscheidet — alles mit
          gesetztem Versand-Datum landet im Abgeschlossen-Tab. */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-white/8">
        <TabButton
          active={tab === 'open'}
          onClick={() => setTab('open')}
          icon={<Inbox className="h-4 w-4" />}
          label="Offen"
          count={openCount}
        />
        <TabButton
          active={tab === 'done'}
          onClick={() => setTab('done')}
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Abgeschlossen"
          count={doneCount}
        />
      </div>

      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
          placeholder="Suche: Bestellnummer, Kunde …"
          className="flex-1 min-w-[200px] rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
        />
        {/* Urgency-Filter nur im Offen-Tab — abgeschlossene Bestellungen
            können nicht mehr "dringend" sein. */}
        {tab === 'open' && (
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as UrgencyFilter)}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1.5 text-sm"
          >
            <option value="all">Alle</option>
            <option value="urgent">Dringend (≤3 Tage)</option>
            <option value="overdue">In Verzug</option>
          </select>
        )}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-2 py-1.5 text-sm"
        >
          <option value="all">Status: Alle</option>
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <button onClick={load} className={btn('ghost', 'text-sm')}>Filter anwenden</button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <Empty
            icon={<FileText className="h-10 w-10" />}
            title="Noch keine Bestellungen"
            hint="Importiere eine PDF-Bestellung oder lege manuell eine an."
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200/80 dark:border-white/8 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Bestellnr.</th>
                <th className="px-4 py-2">Kunde</th>
                <th className="px-4 py-2">Produkte</th>
                <th className="px-4 py-2">Liefertermin</th>
                <th className="px-4 py-2 text-right">Betrag</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((o) => {
                const urg = urgencyOf(o);
                return (
                  <tr key={o.id} className="border-t border-gray-200/60 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link href={`/sales/orders/${o.id}`} className="text-primary-600 hover:underline">
                        {o.orderNumber}
                      </Link>
                      {o.externalOrderNumber && (
                        <div className="text-[10px] text-gray-400">ext: {o.externalOrderNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-gray-900 dark:text-gray-100">{o.customer?.companyName ?? '—'}</div>
                      <div className="text-[11px] text-gray-500">{o.customer?.customerNumber ?? ''}</div>
                    </td>
                    <td className="px-4 py-2">
                      <ProductTiles items={o.lineItems ?? []} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        {urg === 'overdue' && <Badge color="bg-red-100 text-red-700"><AlertTriangle className="inline h-3 w-3 mr-0.5" />In Verzug</Badge>}
                        {urg === 'urgent' && <Badge color="bg-amber-100 text-amber-700"><Clock className="inline h-3 w-3 mr-0.5" />Dringend</Badge>}
                        {!urg && <span className="text-gray-600 dark:text-gray-400">{fmtDate(o.requiredDeliveryDate)}</span>}
                      </div>
                      {urg && (
                        <div className="text-[10px] text-gray-500 mt-0.5">{fmtDate(o.requiredDeliveryDate)}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{fmtMoney(o.totalNet, o.currency)}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        <StatusDot on={!!o.confirmationSentAt} label="AB" />
                        <StatusDot on={!!o.shippedAt} label="Versand" />
                        <StatusDot on={!!o.invoiceSentAt} label="Rg." />
                        <StatusDot on={!!o.paidAt} label="Bez." />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/sales/orders/${o.id}`} className="text-xs text-primary-600 hover:underline">
                        Details →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-medium transition-colors border-b-2',
        active
          ? 'border-primary-600 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
      )}
    >
      {icon}
      {label}
      {count !== null && (
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums',
            active
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
              : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        on
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
      }`}
      title={on ? `${label}: erledigt` : `${label}: offen`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-green-500' : 'bg-gray-400'}`} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Kleine Produkt-Kacheln für die Listenansicht. Bilder kommen aus unserer
// Produkt-DB via lineItem.matchedVariant.product.imageUrl (nur dann wenn
// Claude beim Import ein Match per SKU/EAN gefunden hat). Ohne Bild → Initialen-
// Fallback. Hover → Popover mit Produkt + Menge.
// ---------------------------------------------------------------------------
function ProductTiles({ items }: { items: any[] }) {
  // Hover-State explizit über React — group-hover/Tailwind funktioniert in
  // Tabellen nicht zuverlässig wegen Stacking Context der <tr>/<td> Elemente.
  const [hovered, setHovered] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  if (!items?.length) return <span className="text-xs text-gray-400">—</span>;

  // Aggregate per product (falls dasselbe Produkt in mehreren Positions-
  // Zeilen steht) damit nur eine Kachel erscheint mit Summen-Menge.
  type Tile = { key: string; image: string | null; title: string; quantity: number };
  const byKey = new Map<string, Tile>();
  for (const li of items) {
    const variant = li.matchedVariant;
    const product = variant?.product;
    const key = product?.id || variant?.sku || li.id;
    const qty = Number(li.quantity) || 1;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += qty;
    } else {
      byKey.set(key, {
        key,
        image: product?.imageUrl || null,
        title: product?.title || li.title || '',
        quantity: qty,
      });
    }
  }
  const tiles = Array.from(byKey.values());
  const shown = tiles.slice(0, 5);
  const overflow = tiles.length - shown.length;

  // Position des Popovers: direkt unter dem Hover-Element, viewport-fixiert
  // damit <td>/<tr> Stacking-Context keine Rolle spielt.
  function handleEnter(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setAnchor({ x: rect.left, y: rect.bottom + 4 });
    setHovered(true);
  }

  return (
    <>
      <div
        className="inline-flex items-center gap-1"
        onMouseEnter={handleEnter}
        onMouseLeave={() => setHovered(false)}
      >
        {shown.map((t) => (
          <div key={t.key} className="flex-shrink-0">
            {t.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.image}
                alt={t.title}
                className="h-9 w-9 rounded-md object-cover bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10"
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="h-9 w-9 rounded-md bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                {t.title.slice(0, 2).toUpperCase() || '?'}
              </div>
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div className="h-9 min-w-[2.25rem] px-1.5 rounded-md bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-[10px] font-semibold text-gray-600 dark:text-gray-300">
            +{overflow}
          </div>
        )}
      </div>

      {/* Popover: position: fixed entgeht dem Table-Stacking-Context komplett.
          Rendering direkt am viewport, hoher z-index, pointer-events-none damit
          er nicht mit der Maus zwischen Hover und Popover interferiert. */}
      {hovered && anchor && (
        <div
          role="tooltip"
          style={{ position: 'fixed', left: anchor.x, top: anchor.y, zIndex: 60 }}
          className="pointer-events-none w-max max-w-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 shadow-lg p-2"
        >
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
            {tiles.length} Artikel
          </div>
          <div className="space-y-1">
            {tiles.map((t) => (
              <div key={t.key} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-gray-800 dark:text-gray-200">{t.title}</span>
                <span className="flex-shrink-0 font-semibold text-gray-900 dark:text-gray-100">×{t.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
