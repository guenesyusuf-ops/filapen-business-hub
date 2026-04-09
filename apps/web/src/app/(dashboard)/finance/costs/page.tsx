'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Receipt,
  Truck,
  Clock,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@filapen/shared/src/utils/money';
import type {
  PaymentMethod,
  FixedCost,
  CostFrequency,
  CostCategory,
} from '@filapen/shared/src/types/finance';
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  useFixedCosts,
  useCreateFixedCost,
  useUpdateFixedCost,
  useDeleteFixedCost,
} from '@/hooks/finance/useCosts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREQUENCIES: { label: string; value: CostFrequency }[] = [
  { label: 'One-time', value: 'one-time' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
];

const CATEGORIES: { label: string; value: CostCategory }[] = [
  { label: 'Software', value: 'software' },
  { label: 'Payroll', value: 'payroll' },
  { label: 'Rent', value: 'rent' },
  { label: 'Marketing', value: 'marketing' },
  { label: 'Shipping', value: 'shipping' },
  { label: 'Other', value: 'other' },
];

const CATEGORY_COLORS: Record<CostCategory, string> = {
  software: 'bg-blue-50 text-blue-700',
  payroll: 'bg-green-50 text-green-700',
  rent: 'bg-purple-50 text-purple-700',
  marketing: 'bg-orange-50 text-orange-700',
  shipping: 'bg-yellow-50 text-yellow-700',
  other: 'bg-gray-50 text-gray-600',
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="animate-pulse p-5 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 rounded bg-gray-100" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Form Field
// ---------------------------------------------------------------------------

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-semantic-error">{error}</p>}
    </div>
  );
}

const inputClass = cn(
  'w-full rounded-lg border border-border px-3 py-2 text-sm text-gray-700',
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  'placeholder-gray-400 transition-colors',
);

const selectClass = cn(
  'w-full rounded-lg border border-border px-3 py-2 text-sm text-gray-700 bg-white',
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  'transition-colors appearance-none',
);

// ---------------------------------------------------------------------------
// Payment Methods Tab
// ---------------------------------------------------------------------------

const paymentMethodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  fixedFeePerTransaction: z.coerce.number().min(0, 'Must be >= 0'),
  percentageFee: z.coerce.number().min(0, 'Must be >= 0').max(100, 'Must be <= 100'),
  currency: z.string().min(3, 'Required'),
});

type PaymentMethodForm = z.infer<typeof paymentMethodSchema>;

function PaymentMethodModal({
  existingMethod,
  onClose,
}: {
  existingMethod?: PaymentMethod | null;
  onClose: () => void;
}) {
  const createMutation = useCreatePaymentMethod();
  const updateMutation = useUpdatePaymentMethod();
  const isEdit = !!existingMethod;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentMethodForm>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: existingMethod
      ? {
          name: existingMethod.name,
          fixedFeePerTransaction: existingMethod.fixedFeePerTransaction / 100,
          percentageFee: existingMethod.percentageFee,
          currency: existingMethod.currency,
        }
      : {
          name: '',
          fixedFeePerTransaction: 0,
          percentageFee: 0,
          currency: 'USD',
        },
  });

  const onSubmit = useCallback(
    (formData: PaymentMethodForm) => {
      const payload = {
        name: formData.name,
        fixedFeePerTransaction: Math.round(formData.fixedFeePerTransaction * 100),
        percentageFee: formData.percentageFee,
        currency: formData.currency,
      };

      if (isEdit && existingMethod) {
        updateMutation.mutate(
          { id: existingMethod.id, ...payload },
          {
            onSuccess: () => {
              toast.success('Payment method updated');
              onClose();
            },
            onError: (err) => toast.error(err.message),
          },
        );
      } else {
        createMutation.mutate(payload, {
          onSuccess: () => {
            toast.success('Payment method added');
            onClose();
          },
          onError: (err) => toast.error(err.message),
        });
      }
    },
    [isEdit, existingMethod, createMutation, updateMutation, onClose],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField label="Gateway Name" error={errors.name?.message}>
        <input {...register('name')} placeholder="e.g. Shopify Payments" className={inputClass} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Percentage Fee (%)" error={errors.percentageFee?.message}>
          <input
            {...register('percentageFee')}
            type="number"
            step="0.01"
            min="0"
            placeholder="2.9"
            className={inputClass}
          />
        </FormField>
        <FormField label="Fixed Fee (per txn)" error={errors.fixedFeePerTransaction?.message}>
          <input
            {...register('fixedFeePerTransaction')}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.30"
            className={inputClass}
          />
        </FormField>
      </div>
      <FormField label="Currency" error={errors.currency?.message}>
        <select {...register('currency')} className={selectClass}>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="CAD">CAD</option>
        </select>
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-surface-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white',
            'transition-colors hover:bg-primary-700',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isEdit ? 'Update' : 'Add'} Payment Method
        </button>
      </div>
    </form>
  );
}

function PaymentMethodsTab() {
  const { data, isLoading } = usePaymentMethods();
  const deleteMutation = useDeletePaymentMethod();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);

  const methods = data ?? [];

  const handleEdit = useCallback((method: PaymentMethod) => {
    setEditingMethod(method);
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback(
    (method: PaymentMethod) => {
      if (!confirm(`Delete "${method.name}"?`)) return;
      deleteMutation.mutate(method.id, {
        onSuccess: () => toast.success(`"${method.name}" deleted`),
        onError: (err) => toast.error(err.message),
      });
    },
    [deleteMutation],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingMethod(null);
  }, []);

  const columns = useMemo<ColumnDef<PaymentMethod>[]>(
    () => [
      {
        accessorKey: 'name',
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Gateway
          </span>
        ),
        cell: ({ getValue }) => (
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-900">{getValue<string>()}</span>
          </div>
        ),
      },
      {
        accessorKey: 'percentageFee',
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Percentage Fee
          </span>
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-700">{getValue<number>().toFixed(2)}%</span>
        ),
      },
      {
        accessorKey: 'fixedFeePerTransaction',
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Fixed Fee
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-gray-700">
            {formatCurrency(row.original.fixedFeePerTransaction, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'currency',
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Currency
          </span>
        ),
        cell: ({ getValue }) => (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {getValue<string>()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => handleEdit(row.original)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-surface-secondary hover:text-gray-600 transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleDelete(row.original)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-semantic-error transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDelete],
  );

  const table = useReactTable({
    data: methods,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <TableSkeleton />;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <span className="text-xs text-gray-400">
          {methods.length} payment method{methods.length !== 1 ? 's' : ''}
        </span>
        <Dialog.Root open={modalOpen} onOpenChange={(open) => { if (!open) handleCloseModal(); else setModalOpen(true); }}>
          <Dialog.Trigger asChild>
            <button
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2',
                'text-sm font-medium text-white transition-colors hover:bg-primary-700',
              )}
            >
              <Plus className="h-4 w-4" />
              Add Payment Method
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
                  {editingMethod ? 'Edit' : 'Add'} Payment Method
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="rounded-md p-1 text-gray-400 hover:bg-surface-secondary hover:text-gray-600 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
              <PaymentMethodModal
                existingMethod={editingMethod}
                onClose={handleCloseModal}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {/* Table */}
      {methods.length === 0 ? (
        <div className="py-16 text-center">
          <CreditCard className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No payment methods configured</p>
          <p className="text-xs text-gray-400 mt-1">
            Add your payment gateways to track processing fees
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fixed Costs Tab
// ---------------------------------------------------------------------------

const fixedCostSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be > 0'),
  currency: z.string().min(3),
  frequency: z.string().min(1, 'Frequency is required'),
  category: z.string().min(1, 'Category is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
});

type FixedCostForm = z.infer<typeof fixedCostSchema>;

function FixedCostModal({
  existingCost,
  onClose,
}: {
  existingCost?: FixedCost | null;
  onClose: () => void;
}) {
  const createMutation = useCreateFixedCost();
  const updateMutation = useUpdateFixedCost();
  const isEdit = !!existingCost;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FixedCostForm>({
    resolver: zodResolver(fixedCostSchema),
    defaultValues: existingCost
      ? {
          name: existingCost.name,
          amount: existingCost.amount / 100,
          currency: existingCost.currency,
          frequency: existingCost.frequency,
          category: existingCost.category,
          startDate: existingCost.startDate.split('T')[0],
          endDate: existingCost.endDate?.split('T')[0] ?? '',
        }
      : {
          name: '',
          amount: 0,
          currency: 'USD',
          frequency: 'monthly',
          category: 'software',
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
        },
  });

  const onSubmit = useCallback(
    (formData: FixedCostForm) => {
      const payload = {
        name: formData.name,
        amount: Math.round(formData.amount * 100),
        currency: formData.currency,
        frequency: formData.frequency,
        category: formData.category,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
      };

      if (isEdit && existingCost) {
        updateMutation.mutate(
          { id: existingCost.id, ...payload },
          {
            onSuccess: () => {
              toast.success('Fixed cost updated');
              onClose();
            },
            onError: (err) => toast.error(err.message),
          },
        );
      } else {
        createMutation.mutate(payload, {
          onSuccess: () => {
            toast.success('Fixed cost added');
            onClose();
          },
          onError: (err) => toast.error(err.message),
        });
      }
    },
    [isEdit, existingCost, createMutation, updateMutation, onClose],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField label="Name" error={errors.name?.message}>
        <input {...register('name')} placeholder="e.g. Shopify subscription" className={inputClass} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount ($)" error={errors.amount?.message}>
          <input
            {...register('amount')}
            type="number"
            step="0.01"
            min="0"
            placeholder="29.99"
            className={inputClass}
          />
        </FormField>
        <FormField label="Currency" error={errors.currency?.message}>
          <select {...register('currency')} className={selectClass}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
          </select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Frequency" error={errors.frequency?.message}>
          <select {...register('frequency')} className={selectClass}>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Category" error={errors.category?.message}>
          <select {...register('category')} className={selectClass}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Start Date" error={errors.startDate?.message}>
          <input {...register('startDate')} type="date" className={inputClass} />
        </FormField>
        <FormField label="End Date (optional)" error={errors.endDate?.message}>
          <input {...register('endDate')} type="date" className={inputClass} />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-surface-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white',
            'transition-colors hover:bg-primary-700',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isEdit ? 'Update' : 'Add'} Fixed Cost
        </button>
      </div>
    </form>
  );
}

function FixedCostsTab() {
  const { data, isLoading } = useFixedCosts();
  const deleteMutation = useDeleteFixedCost();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<FixedCost | null>(null);

  const costs = data ?? [];

  const handleEdit = useCallback((cost: FixedCost) => {
    setEditingCost(cost);
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback(
    (cost: FixedCost) => {
      if (!confirm(`Delete "${cost.name}"?`)) return;
      deleteMutation.mutate(cost.id, {
        onSuccess: () => toast.success(`"${cost.name}" deleted`),
        onError: (err) => toast.error(err.message),
      });
    },
    [deleteMutation],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingCost(null);
  }, []);

  // Compute monthly total
  const monthlyTotal = useMemo(() => {
    return costs.reduce((sum, cost) => {
      const amount = cost.amount;
      switch (cost.frequency) {
        case 'daily': return sum + amount * 30;
        case 'weekly': return sum + amount * 4.33;
        case 'monthly': return sum + amount;
        case 'quarterly': return sum + amount / 3;
        case 'yearly': return sum + amount / 12;
        case 'one-time': return sum; // don't include one-time in monthly
        default: return sum;
      }
    }, 0);
  }, [costs]);

  const columns = useMemo<ColumnDef<FixedCost>[]>(
    () => [
      {
        accessorKey: 'name',
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Name
          </span>
        ),
        cell: ({ getValue }) => (
          <span className="font-medium text-gray-900">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'amount',
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Amount
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-gray-900 font-medium">
            {formatCurrency(row.original.amount, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'frequency',
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Frequency
          </span>
        ),
        cell: ({ getValue }) => {
          const freq = getValue<CostFrequency>();
          const label = FREQUENCIES.find((f) => f.value === freq)?.label ?? freq;
          return (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {label}
            </span>
          );
        },
      },
      {
        accessorKey: 'category',
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Category
          </span>
        ),
        cell: ({ getValue }) => {
          const cat = getValue<CostCategory>();
          const label = CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
          const colorClass = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other;
          return (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', colorClass)}>
              {label}
            </span>
          );
        },
      },
      {
        accessorKey: 'startDate',
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Start Date
          </span>
        ),
        cell: ({ getValue }) => (
          <span className="text-gray-600 text-xs">
            {new Date(getValue<string>()).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        ),
      },
      {
        accessorKey: 'endDate',
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            End Date
          </span>
        ),
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          return val ? (
            <span className="text-gray-600 text-xs">
              {new Date(val).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          ) : (
            <span className="text-gray-300 text-xs">Ongoing</span>
          );
        },
      },
      {
        id: 'actions',
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => handleEdit(row.original)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-surface-secondary hover:text-gray-600 transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleDelete(row.original)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-semantic-error transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDelete],
  );

  const table = useReactTable({
    data: costs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <TableSkeleton />;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">
            {costs.length} fixed cost{costs.length !== 1 ? 's' : ''}
          </span>
          {monthlyTotal > 0 && (
            <span className="text-xs text-gray-500">
              Monthly total:{' '}
              <span className="font-medium text-gray-700">
                {formatCurrency(Math.round(monthlyTotal))}
              </span>
            </span>
          )}
        </div>
        <Dialog.Root open={modalOpen} onOpenChange={(open) => { if (!open) handleCloseModal(); else setModalOpen(true); }}>
          <Dialog.Trigger asChild>
            <button
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2',
                'text-sm font-medium text-white transition-colors hover:bg-primary-700',
              )}
            >
              <Plus className="h-4 w-4" />
              Add Fixed Cost
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
                  {editingCost ? 'Edit' : 'Add'} Fixed Cost
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="rounded-md p-1 text-gray-400 hover:bg-surface-secondary hover:text-gray-600 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
              <FixedCostModal
                existingCost={editingCost}
                onClose={handleCloseModal}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {/* Table */}
      {costs.length === 0 ? (
        <div className="py-16 text-center">
          <Receipt className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No fixed costs configured</p>
          <p className="text-xs text-gray-400 mt-1">
            Track recurring expenses like software subscriptions, payroll, and rent
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shipping Rules Tab (Placeholder)
// ---------------------------------------------------------------------------

function ShippingRulesTab() {
  return (
    <div className="py-16 text-center">
      <Truck className="h-10 w-10 text-gray-200 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-700">Shipping Rules</p>
      <p className="text-sm text-gray-400 mt-1">Coming soon</p>
      <p className="text-xs text-gray-400 mt-3 max-w-sm mx-auto">
        Configure shipping cost rules by zone, weight, and carrier to accurately
        track fulfillment expenses in your P&L.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Costs Page
// ---------------------------------------------------------------------------

export default function CostsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Cost Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure payment fees, fixed costs, and shipping rules
        </p>
      </div>

      {/* Tabs card */}
      <Tabs.Root defaultValue="payment-methods">
        <div className="rounded-lg bg-white shadow-card overflow-hidden">
          <Tabs.List
            className="flex border-b border-border px-5"
            aria-label="Cost categories"
          >
            <Tabs.Trigger
              value="payment-methods"
              className={cn(
                'relative px-4 py-3 text-sm font-medium transition-colors',
                'text-gray-500 hover:text-gray-700',
                'data-[state=active]:text-primary',
                'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5',
                'after:bg-transparent data-[state=active]:after:bg-primary',
                'after:transition-colors',
              )}
            >
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Methods
              </span>
            </Tabs.Trigger>
            <Tabs.Trigger
              value="fixed-costs"
              className={cn(
                'relative px-4 py-3 text-sm font-medium transition-colors',
                'text-gray-500 hover:text-gray-700',
                'data-[state=active]:text-primary',
                'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5',
                'after:bg-transparent data-[state=active]:after:bg-primary',
                'after:transition-colors',
              )}
            >
              <span className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Fixed Costs
              </span>
            </Tabs.Trigger>
            <Tabs.Trigger
              value="shipping-rules"
              className={cn(
                'relative px-4 py-3 text-sm font-medium transition-colors',
                'text-gray-500 hover:text-gray-700',
                'data-[state=active]:text-primary',
                'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5',
                'after:bg-transparent data-[state=active]:after:bg-primary',
                'after:transition-colors',
              )}
            >
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Shipping Rules
              </span>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="payment-methods">
            <PaymentMethodsTab />
          </Tabs.Content>

          <Tabs.Content value="fixed-costs">
            <FixedCostsTab />
          </Tabs.Content>

          <Tabs.Content value="shipping-rules">
            <ShippingRulesTab />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
