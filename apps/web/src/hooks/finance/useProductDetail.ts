'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types — shape returned by GET /api/finance/products/catalog/:id
// ---------------------------------------------------------------------------

export interface ProductDetailVariant {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string | number;
  compareAtPrice: string | number | null;
  cogs: string | number | null;
  cogsCurrency: string | null;
  cogsUpdatedAt: string | null;
  vatRate: number;
  inventoryQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail {
  id: string;
  orgId: string;
  shopId: string;
  externalId: string;
  title: string;
  description: string | null;
  handle: string | null;
  sku: string | null;
  imageUrl: string | null;
  status: string;
  category: string | null;
  vendor: string | null;
  internalNotes: string | null;
  internalTags: string[];
  createdAt: string;
  updatedAt: string;
  variants: ProductDetailVariant[];
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api/finance`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, window.location.origin).toString());
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(new URL(path, window.location.origin).toString(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// useProductDetail — fetches a single product with all variants
// ---------------------------------------------------------------------------

export function useProductDetail(productId: string) {
  return useQuery<ProductDetail>({
    queryKey: ['finance', 'products', 'detail', productId],
    queryFn: () => getJson<ProductDetail>(`${API_BASE}/products/catalog/${productId}`),
    enabled: Boolean(productId),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// useUpdateProduct — PATCH internal notes / tags
// ---------------------------------------------------------------------------

export function useUpdateProduct(productId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    ProductDetail,
    Error,
    { internalNotes?: string | null; internalTags?: string[] }
  >({
    mutationFn: (body) =>
      patchJson<ProductDetail>(`${API_BASE}/products/${productId}`, body),
    onMutate: async (next) => {
      await queryClient.cancelQueries({
        queryKey: ['finance', 'products', 'detail', productId],
      });
      const previous = queryClient.getQueryData<ProductDetail>([
        'finance',
        'products',
        'detail',
        productId,
      ]);
      if (previous) {
        queryClient.setQueryData<ProductDetail>(
          ['finance', 'products', 'detail', productId],
          {
            ...previous,
            internalNotes:
              next.internalNotes !== undefined ? next.internalNotes : previous.internalNotes,
            internalTags:
              next.internalTags !== undefined ? next.internalTags : previous.internalTags,
          },
        );
      }
      return { previous } as const;
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: ProductDetail } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(
          ['finance', 'products', 'detail', productId],
          ctx.previous,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['finance', 'products', 'detail', productId],
      });
      queryClient.invalidateQueries({ queryKey: ['finance', 'products', 'catalog'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateVariant — PATCH cogs / cogsCurrency
// ---------------------------------------------------------------------------

export function useUpdateVariant(productId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    ProductDetailVariant,
    Error,
    { variantId: string; cogs?: number | null; cogsCurrency?: string | null; vatRate?: number }
  >({
    mutationFn: ({ variantId, cogs, cogsCurrency, vatRate }) =>
      patchJson<ProductDetailVariant>(`${API_BASE}/variants/${variantId}`, {
        cogs,
        cogsCurrency,
        vatRate,
      }),
    onMutate: async ({ variantId, cogs, cogsCurrency }) => {
      await queryClient.cancelQueries({
        queryKey: ['finance', 'products', 'detail', productId],
      });
      const previous = queryClient.getQueryData<ProductDetail>([
        'finance',
        'products',
        'detail',
        productId,
      ]);
      if (previous) {
        queryClient.setQueryData<ProductDetail>(
          ['finance', 'products', 'detail', productId],
          {
            ...previous,
            variants: previous.variants.map((v) =>
              v.id === variantId
                ? {
                    ...v,
                    cogs: cogs !== undefined ? cogs : v.cogs,
                    cogsCurrency:
                      cogsCurrency !== undefined ? cogsCurrency : v.cogsCurrency,
                  }
                : v,
            ),
          },
        );
      }
      return { previous } as const;
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: ProductDetail } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(
          ['finance', 'products', 'detail', productId],
          ctx.previous,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['finance', 'products', 'detail', productId],
      });
      queryClient.invalidateQueries({ queryKey: ['finance', 'products'] });
    },
  });
}
