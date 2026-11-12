'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Boxes } from 'lucide-react';
import { PageHeader, Card, CardBody, Toggle, Input, EmptyState, StatusPill } from '@/components/ds';
import { dropshippingApi, DsSkuRow } from '@/lib/dropshipping';

export default function DropshippingProductsPage() {
  const [rows, setRows] = useState<DsSkuRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setRows(await dropshippingApi.listSkus());
    } catch (e: any) {
      setError(e.message ?? 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.sku.toLowerCase().includes(s) ||
        (r.title ?? '').toLowerCase().includes(s) ||
        r.productTitle.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const activeCount = rows.filter((r) => r.dropship).length;

  const toggle = async (row: DsSkuRow, next: boolean) => {
    setPending((p) => new Set(p).add(row.sku));
    // optimistisch
    setRows((prev) => prev.map((r) => (r.sku === row.sku ? { ...r, dropship: next } : r)));
    try {
      await dropshippingApi.toggleSku({
        sku: row.sku,
        title: row.title ?? row.productTitle,
        variantExternalId: row.variantExternalId,
        active: next,
      });
    } catch (e: any) {
      // zurückrollen
      setRows((prev) => prev.map((r) => (r.sku === row.sku ? { ...r, dropship: !next } : r)));
      setError(e.message ?? 'Konnte nicht speichern');
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(row.sku); return n; });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
      <PageHeader
        eyebrow="Dropshipping"
        title="Produkte / SKUs"
        subtitle="Wähle die SKUs, die über Dropshipping versendet werden. Bestellungen mit diesen Artikeln werden automatisch dem Partner bereitgestellt."
        actions={<StatusPill tone={activeCount > 0 ? 'ok' : 'neutral'}>{activeCount} aktiv</StatusPill>}
      />

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nach SKU, Variante oder Produkt suchen…"
          className="pl-9"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-[rgb(var(--color-error))]/30 bg-[rgb(var(--color-error))]/10 px-4 py-3 text-[14px] text-[rgb(var(--color-error))]">
          {error}
        </div>
      )}

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="px-4 py-10 text-center text-[14px] text-[var(--text-secondary)]">Lädt…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Boxes size={28} />}
              title="Keine Produkte gefunden"
              description="Es wurden keine Varianten mit SKU gefunden. Prüfe die Shopify-Produktsynchronisation."
            />
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {filtered.map((r) => (
                <li key={r.sku} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-[var(--text-primary)] truncate">{r.productTitle || r.title || r.sku}</div>
                    <div className="text-[12.5px] text-[var(--text-secondary)] truncate">
                      {r.title && r.title !== r.productTitle ? `${r.title} · ` : ''}
                      <span className="font-mono">{r.sku}</span>
                    </div>
                  </div>
                  <Toggle
                    checked={r.dropship}
                    onChange={(next) => toggle(r, next)}
                    disabled={pending.has(r.sku)}
                    label={`Dropshipping für ${r.sku}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
