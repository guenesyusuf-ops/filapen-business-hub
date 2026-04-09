'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Upload,
  X,
  Package,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent, formatNumber } from '@filapen/shared/src/utils/money';
import { DateRangePicker } from '@/components/finance/shared/DateRangePicker';
import { useProducts, useUpdateCogs, useImportCogs, type SortField } from '@/hooks/finance/useProducts';
import type { ProductProfitability } from '@filapen/shared/src/types/finance';

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="rounded-lg bg-white shadow-card overflow-hidden animate-pulse">
      <div className="p-5">
        <div className="h-4 w-44 rounded bg-gray-200 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-10 w-10 rounded bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-full rounded bg-gray-100" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline COGS Editor
// ---------------------------------------------------------------------------

function InlineCogsEditor({
  productId,
  currentCogs,
}: {
  productId: string;
  currentCogs: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const updateCogs = useUpdateCogs();

  const startEditing = useCallback(() => {
    setValue(String(currentCogs / 100));
    setEditing(true);
  }, [currentCogs]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Invalid COGS value');
      setEditing(false);
      return;
    }
    const cents = Math.round(parsed * 100);
    updateCogs.mutate(
      { productId, cogs: cents },
      {
        onSuccess: () => {
          toast.success('COGS updated');
          setEditing(false);
        },
        onError: (err) => {
          toast.error(`Failed to update COGS: ${err.message}`);
          setEditing(false);
        },
      },
    );
  }, [productId, value, updateCogs]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        setEditing(false);
      }
    },
    [handleSave],
  );

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-gray-400 text-xs">$</span>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setEditing(false)}
          className="w-20 rounded border border-primary px-1.5 py-0.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {updateCogs.isPending && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
      </div>
    );
  }

  return (
    <span
      className="cursor-pointer rounded px-1 py-0.5 text-gray-900 transition-colors hover:bg-primary-50 hover:text-primary"
      onDoubleClick={startEditing}
      title="Double-click to edit"
    >
      {formatCurrency(currentCogs)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Import COGS Modal
// ---------------------------------------------------------------------------

function ImportCogsModal() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importCogs = useImportCogs();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith('.csv')) {
      setFile(dropped);
    } else {
      toast.error('Please upload a CSV file');
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
    }
  }, []);

  const handleImport = useCallback(() => {
    if (!file) return;
    importCogs.mutate(file, {
      onSuccess: (result: { imported: number }) => {
        toast.success(`Imported COGS for ${result.imported} products`);
        setFile(null);
        setOpen(false);
      },
      onError: (err) => {
        toast.error(`Import failed: ${err.message}`);
      },
    });
  }, [file, importCogs]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2',
            'text-sm text-gray-700 shadow-sm transition-colors',
            'hover:bg-surface-secondary hover:border-border-strong',
          )}
        >
          <Upload className="h-4 w-4" />
          Import COGS
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-border bg-white p-6 shadow-xl animate-fade-in',
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Import COGS from CSV
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 text-gray-400 hover:bg-surface-secondary hover:text-gray-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-gray-500 mb-4">
            Upload a CSV file with columns: <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">sku</code> and{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">cogs</code> (in dollars).
          </Dialog.Description>

          {/* Drop zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
              file ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300 bg-surface-secondary',
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-primary">
                <Check className="h-5 w-5" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Drop a CSV file here, or click to browse
                </p>
              </div>
            )}
          </div>

          {/* Sample format */}
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs font-mono text-gray-600">
            <p className="text-gray-400 mb-1">Example:</p>
            <p>sku,cogs</p>
            <p>SKU-001,12.50</p>
            <p>SKU-002,8.75</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <button className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-surface-secondary transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleImport}
              disabled={!file || importCogs.isPending}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white',
                'transition-colors hover:bg-primary-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {importCogs.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Import
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Sort Header Button
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  field,
  currentSort,
  currentOrder,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentOrder: 'asc' | 'desc';
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;
  return (
    <button
      className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
      onClick={() => onSort(field)}
    >
      {label}
      {isActive ? (
        currentOrder === 'asc' ? (
          <ArrowUp className="h-3 w-3 text-primary" />
        ) : (
          <ArrowDown className="h-3 w-3 text-primary" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Margin Color
// ---------------------------------------------------------------------------

function marginColor(margin: number): string {
  if (margin >= 0.5) return 'text-semantic-success';
  if (margin >= 0.2) return 'text-gray-900';
  if (margin >= 0) return 'text-semantic-warning';
  return 'text-semantic-error';
}

// ---------------------------------------------------------------------------
// Products Page
// ---------------------------------------------------------------------------

export default function ProductsPage() {
  const {
    data,
    isLoading,
    page,
    setPage,
    search,
    setSearch,
    sortBy,
    sortOrder,
    handleSort,
  } = useProducts();

  const products = data?.products ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const columns = useMemo<ColumnDef<ProductProfitability>[]>(
    () => [
      {
        accessorKey: 'title',
        header: () => (
          <SortHeader
            label="Product"
            field="title"
            currentSort={sortBy}
            currentOrder={sortOrder}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) => {
          const { title, sku, imageUrl } = row.original;
          return (
            <div className="flex items-center gap-3 min-w-[200px]">
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    className="h-10 w-10 object-cover rounded-lg"
                  />
                ) : (
                  <ImageIcon className="h-4 w-4 text-gray-300" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate max-w-[240px]">
                  {title}
                </div>
                {sku && (
                  <div className="text-xs text-gray-400 font-mono">{sku}</div>
                )}
              </div>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'grossRevenue',
        header: () => (
          <SortHeader
            label="Revenue"
            field="revenue"
            currentSort={sortBy}
            currentOrder={sortOrder}
            onSort={handleSort}
          />
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-900 font-medium">
            {formatCurrency(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'totalCogs',
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            COGS
          </span>
        ),
        cell: ({ row }) => (
          <InlineCogsEditor
            productId={row.original.productId}
            currentCogs={row.original.totalCogs}
          />
        ),
      },
      {
        accessorKey: 'grossProfit',
        header: () => (
          <SortHeader
            label="Gross Profit"
            field="grossProfit"
            currentSort={sortBy}
            currentOrder={sortOrder}
            onSort={handleSort}
          />
        ),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span className={cn('font-medium', val >= 0 ? 'text-semantic-success' : 'text-semantic-error')}>
              {formatCurrency(val)}
            </span>
          );
        },
      },
      {
        accessorKey: 'grossMarginPercent',
        header: () => (
          <SortHeader
            label="Margin %"
            field="grossMarginPercent"
            currentSort={sortBy}
            currentOrder={sortOrder}
            onSort={handleSort}
          />
        ),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span className={cn('font-medium', marginColor(val))}>
              {formatPercent(val, 1)}
            </span>
          );
        },
      },
      {
        accessorKey: 'unitsSold',
        header: () => (
          <SortHeader
            label="Units Sold"
            field="unitsSold"
            currentSort={sortBy}
            currentOrder={sortOrder}
            onSort={handleSort}
          />
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-700">{formatNumber(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'refundRate',
        header: () => (
          <SortHeader
            label="Refund Rate"
            field="refundRate"
            currentSort={sortBy}
            currentOrder={sortOrder}
            onSort={handleSort}
          />
        ),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span className={cn('text-sm', val > 0.05 ? 'text-semantic-error font-medium' : 'text-gray-500')}>
              {formatPercent(val, 1)}
            </span>
          );
        },
      },
    ],
    [sortBy, sortOrder, handleSort],
  );

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Product Profitability</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Analyze revenue, costs, and margins by product
          </p>
        </div>
        <DateRangePicker />
      </div>

      {/* Card wrapper */}
      <div className="rounded-lg bg-white shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full sm:w-72 rounded-lg border border-border bg-surface-secondary pl-9 pr-3 py-2',
                'text-sm text-gray-700 placeholder-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white',
                'transition-colors',
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {total} product{total !== 1 ? 's' : ''}
            </span>
            <ImportCogsModal />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton />
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {search ? 'No products match your search' : 'No product data available for this period'}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-border">
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
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border-subtle transition-colors hover:bg-surface-secondary"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-5 py-3 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className={cn(
                    'rounded-md p-1.5 text-gray-400 transition-colors',
                    page > 1
                      ? 'hover:bg-surface-secondary hover:text-gray-600'
                      : 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {/* Page number buttons */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        pageNum === page
                          ? 'bg-primary text-white'
                          : 'text-gray-500 hover:bg-surface-secondary hover:text-gray-700',
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className={cn(
                    'rounded-md p-1.5 text-gray-400 transition-colors',
                    page < totalPages
                      ? 'hover:bg-surface-secondary hover:text-gray-600'
                      : 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
