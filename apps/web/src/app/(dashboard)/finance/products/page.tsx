'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, ImageIcon, Barcode, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CatalogVariant {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  compareAtPrice: number | null;
  inventoryQuantity: number;
}

interface CatalogProduct {
  id: string;
  title: string;
  description: string | null;
  handle: string | null;
  imageUrl: string | null;
  status: string;
  category: string | null;
  vendor: string | null;
  createdAt: string;
  updatedAt: string;
  variants: CatalogVariant[];
  minPrice: number;
  maxPrice: number;
  totalInventory: number;
}

interface CatalogResponse {
  items: CatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type SortBy = 'title' | 'price' | 'createdAt';
type SortOrder = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

async function fetchCatalog(params: {
  search: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
}): Promise<CatalogResponse> {
  const url = new URL('/api/finance/products/catalog', window.location.origin);
  if (params.search) url.searchParams.set('search', params.search);
  url.searchParams.set('sortBy', params.sortBy);
  url.searchParams.set('sortOrder', params.sortOrder);
  url.searchParams.set('pageSize', '100');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Product Card
// ---------------------------------------------------------------------------

function ProductCard({ product }: { product: CatalogProduct }) {
  const description = useMemo(() => stripHtml(product.description), [product.description]);
  const primaryVariant = product.variants[0];
  const ean = product.variants.find((v) => v.barcode)?.barcode ?? null;
  const hasPriceRange = product.minPrice !== product.maxPrice;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-[#222] bg-[#111] transition-all duration-200 hover:border-[#333] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#0a0a0a]">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-[#333]" />
          </div>
        )}
        {product.status !== 'active' && (
          <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-300 backdrop-blur">
            {product.status === 'draft' ? 'Entwurf' : 'Archiviert'}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold text-white leading-snug" title={product.title}>
          {product.title}
        </h3>

        {/* Description */}
        {description && (
          <p className="line-clamp-2 text-xs text-gray-400 leading-relaxed">
            {truncate(description, 140)}
          </p>
        )}

        {/* Price */}
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          {primaryVariant ? (
            <>
              <span className="text-base font-semibold text-white">
                {formatPrice(product.minPrice)}
              </span>
              {hasPriceRange && (
                <span className="text-xs text-gray-500">
                  – {formatPrice(product.maxPrice)}
                </span>
              )}
              {primaryVariant.compareAtPrice && primaryVariant.compareAtPrice > primaryVariant.price && (
                <span className="text-xs text-gray-500 line-through">
                  {formatPrice(primaryVariant.compareAtPrice)}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-500">Kein Preis</span>
          )}
        </div>

        {/* Meta row: variants + inventory */}
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span>
            {product.variants.length === 1
              ? '1 Variante'
              : `${product.variants.length} Varianten`}
          </span>
          <span className="h-1 w-1 rounded-full bg-[#333]" />
          <span>
            {product.totalInventory} auf Lager
          </span>
        </div>

        {/* EAN badge */}
        {ean && (
          <div className="flex items-center gap-1.5 pt-1">
            <div className="inline-flex items-center gap-1 rounded-md border border-[#222] bg-[#0a0a0a] px-2 py-0.5 text-[10px] font-mono text-gray-400">
              <Barcode className="h-3 w-3" />
              <span>{ean}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#222] bg-[#111]">
      <div className="aspect-square w-full animate-pulse bg-[#1a1a1a]" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[#1a1a1a]" />
        <div className="h-3 w-full animate-pulse rounded bg-[#1a1a1a]" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-[#1a1a1a]" />
        <div className="h-5 w-20 animate-pulse rounded bg-[#1a1a1a]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort Button
// ---------------------------------------------------------------------------

function SortButton({
  label,
  field,
  currentSortBy,
  currentOrder,
  onSort,
}: {
  label: string;
  field: SortBy;
  currentSortBy: SortBy;
  currentOrder: SortOrder;
  onSort: (field: SortBy) => void;
}) {
  const active = currentSortBy === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-[#333] bg-[#1a1a1a] text-white'
          : 'border-[#222] bg-[#111] text-gray-400 hover:border-[#333] hover:text-gray-200',
      )}
    >
      {label}
      {active && (
        <span className="text-[10px] text-gray-500">
          {currentOrder === 'asc' ? '↑' : '↓'}
        </span>
      )}
      {!active && <ArrowUpDown className="h-3 w-3 text-gray-600" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Products Catalog Page
// ---------------------------------------------------------------------------

export default function ProductsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch } = useQuery<CatalogResponse>({
    queryKey: ['finance', 'products', 'catalog', debouncedSearch, sortBy, sortOrder],
    queryFn: () => fetchCatalog({ search: debouncedSearch, sortBy, sortOrder }),
    staleTime: 60 * 1000,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const products = data?.items ?? [];
  const total = data?.total ?? 0;

  const handleSort = (field: SortBy) => {
    if (field === sortBy) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'title' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="min-h-full bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-[1600px] space-y-6 p-1">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-400" />
              <h1 className="text-2xl font-semibold tracking-tight text-white">Produkte</h1>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              {isLoading
                ? 'Lade Produktkatalog...'
                : `${total} ${total === 1 ? 'Produkt' : 'Produkte'} aus Shopify synchronisiert`}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Produkte suchen (Titel, SKU, EAN, Marke)..."
              className={cn(
                'w-full rounded-lg border border-[#222] bg-[#111] py-2 pl-9 pr-3',
                'text-sm text-white placeholder-gray-500',
                'focus:border-[#444] focus:outline-none focus:ring-1 focus:ring-[#444]',
                'transition-colors',
              )}
            />
          </div>
        </div>

        {/* Filter / Sort toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#222] pb-4">
          <span className="mr-1 text-xs uppercase tracking-wider text-gray-500">Sortieren:</span>
          <SortButton
            label="Name"
            field="title"
            currentSortBy={sortBy}
            currentOrder={sortOrder}
            onSort={handleSort}
          />
          <SortButton
            label="Preis"
            field="price"
            currentSortBy={sortBy}
            currentOrder={sortOrder}
            onSort={handleSort}
          />
          <SortButton
            label="Neueste"
            field="createdAt"
            currentSortBy={sortBy}
            currentOrder={sortOrder}
            onSort={handleSort}
          />
        </div>

        {/* Error */}
        {isError && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-center">
            <p className="text-sm text-red-300">
              Fehler beim Laden der Produkte: {(error as Error)?.message ?? 'Unbekannter Fehler'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 rounded-lg border border-red-800 bg-red-950/40 px-4 py-1.5 text-xs text-red-200 hover:bg-red-900/40"
            >
              Erneut versuchen
            </button>
          </div>
        )}

        {/* Grid */}
        {isLoading && !data ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#222] bg-[#0a0a0a] py-20 text-center">
            <Package className="mb-3 h-10 w-10 text-[#333]" />
            <p className="text-sm text-gray-400">
              {debouncedSearch
                ? `Keine Produkte für "${debouncedSearch}" gefunden`
                : 'Noch keine Produkte synchronisiert'}
            </p>
            {debouncedSearch && (
              <button
                onClick={() => setSearchInput('')}
                className="mt-3 text-xs text-gray-500 hover:text-gray-300 underline"
              >
                Suche zurücksetzen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
