'use client';

import { useEffect, useState } from 'react';
import { Boxes, Search, Save, Ban, CheckCircle2 } from 'lucide-react';
import { shippingApi } from '@/lib/shipping';
import { PageHeader, Empty, btn, input as inputCls, label as labelCls, Badge } from '@/components/shipping/ShippingUI';

interface Row {
  variantId: string;
  productId: string;
  productTitle: string;
  productImage: string | null;
  variantTitle: string;
  sku: string | null;
  price: string;
  shippingProfile: null | {
    id: string;
    weightG: number;
    lengthMm: number | null;
    widthMm: number | null;
    heightMm: number | null;
    hsCode: string | null;
    countryOfOrigin: string | null;
    excludeFromShipping: boolean;
  };
}

export default function ShippingProductsPage() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    shippingApi.listProductProfiles(search || undefined)
      .then((d: any) => { setRows(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search]);

  const setField = (variantId: string, field: string, value: any) => {
    setEdits((prev) => ({ ...prev, [variantId]: { ...prev[variantId], [field]: value } }));
  };

  const hasEdits = (variantId: string) => Object.keys(edits[variantId] || {}).length > 0;

  const save = async (row: Row) => {
    const patch = edits[row.variantId];
    if (!patch) return;
    setSaving(row.variantId);
    try {
      // Merge with existing
      const body = {
        weightG: row.shippingProfile?.weightG ?? 0,
        lengthMm: row.shippingProfile?.lengthMm ?? null,
        widthMm: row.shippingProfile?.widthMm ?? null,
        heightMm: row.shippingProfile?.heightMm ?? null,
        hsCode: row.shippingProfile?.hsCode ?? null,
        countryOfOrigin: row.shippingProfile?.countryOfOrigin ?? null,
        excludeFromShipping: row.shippingProfile?.excludeFromShipping ?? false,
        ...patch,
      };
      await shippingApi.upsertVariantProfile(row.variantId, body);
      setEdits((prev) => { const next = { ...prev }; delete next[row.variantId]; return next; });
      // Reload this row
      const fresh = await shippingApi.listProductProfiles(search || undefined);
      setRows(fresh as any);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Produkte & Versanddaten" subtitle="Gewicht, Maße, Zoll-Codes pro Variante" />

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Produktname, Variante oder SKU …" className={inputCls('pl-9')} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : rows.length === 0 ? (
          <Empty icon={<Boxes className="h-10 w-10" />} title="Keine Produktvarianten gefunden" hint="Produkte werden automatisch aus Shopify importiert (wenn Shop verbunden)." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
                <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-3 py-2.5 text-left">Produkt / Variante</th>
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-right">Gewicht (g)</th>
                  <th className="px-3 py-2.5 text-right">L×B×H (mm)</th>
                  <th className="px-3 py-2.5 text-left">HS-Code</th>
                  <th className="px-3 py-2.5 text-left">Herkunft</th>
                  <th className="px-3 py-2.5 text-center">Ausschluss</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {rows.map((row) => {
                  const edit = edits[row.variantId] || {};
                  const profile = row.shippingProfile;
                  const val = (field: string, fallback: any) => edit[field] !== undefined ? edit[field] : (profile?.[field as keyof typeof profile] ?? fallback);
                  const hasProfile = !!profile;
                  return (
                    <tr key={row.variantId} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900 dark:text-white truncate max-w-[280px]">{row.productTitle}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[280px]">{row.variantTitle}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 font-mono">{row.sku || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <input type="number" min="0" className={inputCls('w-24 text-right')} value={val('weightG', '')} onChange={(e) => setField(row.variantId, 'weightG', Number(e.target.value))} placeholder="0" />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <input type="number" min="0" className={inputCls('w-16 text-right')} value={val('lengthMm', '') as any} onChange={(e) => setField(row.variantId, 'lengthMm', e.target.value ? Number(e.target.value) : null)} placeholder="L" title="Länge" />
                          <input type="number" min="0" className={inputCls('w-16 text-right')} value={val('widthMm', '') as any} onChange={(e) => setField(row.variantId, 'widthMm', e.target.value ? Number(e.target.value) : null)} placeholder="B" title="Breite" />
                          <input type="number" min="0" className={inputCls('w-16 text-right')} value={val('heightMm', '') as any} onChange={(e) => setField(row.variantId, 'heightMm', e.target.value ? Number(e.target.value) : null)} placeholder="H" title="Höhe" />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input className={inputCls('w-24 text-xs font-mono')} value={val('hsCode', '') as any || ''} onChange={(e) => setField(row.variantId, 'hsCode', e.target.value || null)} placeholder="z.B. 3926.90" />
                      </td>
                      <td className="px-3 py-3">
                        <input maxLength={2} className={inputCls('w-12 uppercase text-xs')} value={val('countryOfOrigin', '') as any || ''} onChange={(e) => setField(row.variantId, 'countryOfOrigin', e.target.value.toUpperCase() || null)} placeholder="DE" />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input type="checkbox" checked={Boolean(val('excludeFromShipping', false))} onChange={(e) => setField(row.variantId, 'excludeFromShipping', e.target.checked)} title="Nicht versenden" />
                      </td>
                      <td className="px-3 py-3 text-right">
                        {hasEdits(row.variantId) ? (
                          <button onClick={() => save(row)} disabled={saving === row.variantId} className={btn('primary', 'h-8 px-2 py-1 text-xs')}>
                            <Save className="h-3.5 w-3.5" /> {saving === row.variantId ? '…' : 'Speichern'}
                          </button>
                        ) : hasProfile ? (
                          <Badge color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"><CheckCircle2 className="h-3 w-3 inline mr-1" /> Gepflegt</Badge>
                        ) : (
                          <Badge color="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Nicht gepflegt</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
