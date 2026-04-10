'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ImageIcon, Loader2, Save, Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useProductDetail,
  useUpdateProduct,
  useUpdateVariant,
  type ProductDetailVariant,
} from '@/hooks/finance/useProductDetail';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatPrice(amount: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function stripHtml(html: string | null): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Read-only field wrapper (visual "Aus Shopify" hint)
// ---------------------------------------------------------------------------

function ReadOnlyField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wider text-gray-500">
        {label}
      </label>
      <div
        title="Aus Shopify synchronisiert"
        className={cn(
          'w-full cursor-not-allowed rounded-lg border border-white/5 bg-[#0a0a0a] px-3 py-2',
          'text-sm text-gray-300 opacity-60',
          multiline ? 'min-h-[120px] whitespace-pre-wrap' : 'truncate',
        )}
      >
        {value || <span className="italic text-gray-600">—</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tags input
// ---------------------------------------------------------------------------

function TagsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    // Support comma-separated batch paste
    const pieces = trimmed
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const next = Array.from(new Set([...value, ...pieces]));
    onChange(next);
    setDraft('');
  };

  const removeAt = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-[#0a0a0a] px-2 py-2',
        'focus-within:border-white/30 transition-colors',
      )}
    >
      {value.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#161616] px-2 py-0.5 text-xs text-gray-200"
        >
          <Tag className="h-3 w-3 text-gray-500" />
          {tag}
          <button
            type="button"
            onClick={() => removeAt(idx)}
            className="ml-0.5 text-gray-500 hover:text-white"
            aria-label={`Tag ${tag} entfernen`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !draft && value.length > 0) {
            removeAt(value.length - 1);
          }
        }}
        onBlur={commit}
        placeholder={value.length ? '' : 'Tag hinzufügen, Enter drücken...'}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-white outline-none placeholder-gray-500"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant Row
// ---------------------------------------------------------------------------

function VariantRow({
  variant,
  productId,
}: {
  variant: ProductDetailVariant;
  productId: string;
}) {
  const [cogs, setCogs] = useState<string>(
    variant.cogs != null ? String(toNumber(variant.cogs)) : '',
  );
  const [currency, setCurrency] = useState<string>(variant.cogsCurrency || 'EUR');
  const updateVariant = useUpdateVariant(productId);

  useEffect(() => {
    setCogs(variant.cogs != null ? String(toNumber(variant.cogs)) : '');
    setCurrency(variant.cogsCurrency || 'EUR');
  }, [variant.cogs, variant.cogsCurrency]);

  const isDirty =
    String(variant.cogs ?? '') !== cogs.trim() ||
    (variant.cogsCurrency || 'EUR') !== currency;

  const handleSave = () => {
    const parsed = cogs.trim() === '' ? null : Number(cogs.replace(',', '.'));
    if (parsed != null && Number.isNaN(parsed)) return;
    updateVariant.mutate({
      variantId: variant.id,
      cogs: parsed,
      cogsCurrency: currency,
    });
  };

  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02]">
      <td className="px-3 py-3 text-sm text-white">{variant.title}</td>
      <td className="px-3 py-3 text-xs font-mono text-gray-400">
        {variant.sku || <span className="italic text-gray-600">—</span>}
      </td>
      <td className="px-3 py-3 text-xs font-mono text-gray-400">
        {variant.barcode || <span className="italic text-gray-600">—</span>}
      </td>
      <td
        className="px-3 py-3 text-sm text-gray-300 opacity-60"
        title="Aus Shopify synchronisiert"
      >
        {formatPrice(toNumber(variant.price))}
      </td>
      <td
        className="px-3 py-3 text-sm text-gray-300 opacity-60"
        title="Aus Shopify synchronisiert"
      >
        {variant.inventoryQuantity}
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={cogs}
          onChange={(e) => setCogs(e.target.value)}
          placeholder="0.00"
          className={cn(
            'w-24 rounded-md border border-white/10 bg-[#0a0a0a] px-2 py-1.5',
            'text-sm text-white placeholder-gray-600',
            'focus:border-white/30 focus:outline-none',
          )}
        />
      </td>
      <td className="px-3 py-3">
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className={cn(
            'rounded-md border border-white/10 bg-[#0a0a0a] px-2 py-1.5',
            'text-sm text-white focus:border-white/30 focus:outline-none',
          )}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || updateVariant.isPending}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium',
            'transition-colors',
            isDirty && !updateVariant.isPending
              ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
              : 'cursor-not-allowed border-white/5 bg-transparent text-gray-600',
          )}
        >
          {updateVariant.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Speichern
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id ?? '';

  const { data: product, isLoading, isError, error } = useProductDetail(productId);
  const updateProduct = useUpdateProduct(productId);

  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (product) {
      setNotes(product.internalNotes ?? '');
      setTags(product.internalTags ?? []);
    }
  }, [product]);

  const description = useMemo(
    () => stripHtml(product?.description ?? null),
    [product?.description],
  );

  const isProductDirty =
    product != null &&
    ((product.internalNotes ?? '') !== notes ||
      JSON.stringify(product.internalTags ?? []) !== JSON.stringify(tags));

  const handleSaveProduct = () => {
    updateProduct.mutate({
      internalNotes: notes,
      internalTags: tags,
    });
  };

  // -------------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-full bg-[#0a0a0a] p-6 text-white">
        <div className="mx-auto max-w-[1400px] space-y-4">
          <div className="h-5 w-32 animate-pulse rounded bg-white/5" />
          <div className="h-8 w-96 animate-pulse rounded bg-white/5" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-96 animate-pulse rounded-xl border border-white/5 bg-[#111]" />
            <div className="h-96 animate-pulse rounded-xl border border-white/5 bg-[#111]" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="min-h-full bg-[#0a0a0a] p-6 text-white">
        <div className="mx-auto max-w-[1400px]">
          <Link
            href="/finance/products"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Übersicht
          </Link>
          <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-center">
            <p className="text-sm text-red-300">
              {isError
                ? `Fehler beim Laden: ${(error as Error)?.message ?? 'Unbekannt'}`
                : 'Produkt nicht gefunden.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main layout
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-full bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-[1400px] space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <Link
              href="/finance/products"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück zu Produkten
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {product.title}
            </h1>
            <p className="text-xs text-gray-500">
              {product.variants.length}{' '}
              {product.variants.length === 1 ? 'Variante' : 'Varianten'}
              {product.vendor ? ` · ${product.vendor}` : ''}
              {product.category ? ` · ${product.category}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveProduct}
            disabled={!isProductDirty || updateProduct.isPending}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
              isProductDirty && !updateProduct.isPending
                ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                : 'cursor-not-allowed border-white/5 bg-transparent text-gray-600',
            )}
          >
            {updateProduct.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Speichern
          </button>
        </div>

        {/* Grid: left = read-only Shopify info, right = editable internal fields */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT: Shopify read-only side */}
          <div className="space-y-4 rounded-xl border border-white/5 bg-[#111] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Shopify Daten</h2>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">
                Read-only
              </span>
            </div>

            {/* Image */}
            <div className="aspect-square w-full overflow-hidden rounded-lg border border-white/5 bg-[#0a0a0a]">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-[#333]" />
                </div>
              )}
            </div>

            <ReadOnlyField label="Titel" value={product.title} />
            <ReadOnlyField
              label="Beschreibung"
              value={description}
              multiline
            />
          </div>

          {/* RIGHT: editable */}
          <div className="space-y-4 rounded-xl border border-white/5 bg-[#111] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Interne Daten</h2>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">
                Editierbar
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-gray-500">
                Interne Notizen
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                placeholder="Interne Notizen zu diesem Produkt..."
                className={cn(
                  'w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2',
                  'text-sm text-white placeholder-gray-600',
                  'focus:border-white/30 focus:outline-none',
                  'min-h-[180px] resize-y',
                )}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-gray-500">
                Interne Tags
              </label>
              <TagsInput value={tags} onChange={setTags} />
              <p className="text-[10px] text-gray-600">
                Enter oder Komma zum Hinzufügen · Backspace zum Entfernen
              </p>
            </div>
          </div>
        </div>

        {/* Variants table */}
        <div className="rounded-xl border border-white/5 bg-[#111]">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
            <h2 className="text-sm font-semibold text-white">Varianten</h2>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">
              COGS pro Variante editierbar
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-[#0d0d0d] text-left">
                  <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    Titel
                  </th>
                  <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    SKU
                  </th>
                  <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    EAN
                  </th>
                  <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    Preis
                  </th>
                  <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    Lager
                  </th>
                  <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    COGS
                  </th>
                  <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    Währung
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    Aktion
                  </th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map((variant) => (
                  <VariantRow
                    key={variant.id}
                    variant={variant}
                    productId={productId}
                  />
                ))}
                {product.variants.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-sm text-gray-500"
                    >
                      Keine Varianten vorhanden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
