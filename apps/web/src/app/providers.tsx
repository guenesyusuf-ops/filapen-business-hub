'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';

/**
 * Globaler Error-Logger für ALLE React-Query Mutations und Queries.
 * Liest die Fehler-Message vom Backend und loggt sie strukturiert.
 *
 * Triggert ein CustomEvent('filapen:error') das von der Toast-Bridge
 * (siehe app/(dashboard)/layout.tsx) abgefangen wird und einen Toast zeigt.
 * Damit kann KEINE Backend-Mutation mehr silently failen.
 */
function dispatchError(scope: string, error: unknown, ctx?: string) {
  const message = (error as any)?.message ?? String(error);
  // eslint-disable-next-line no-console
  console.error(`[filapen/${scope}]`, ctx ?? '', message, error);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('filapen:error', {
      detail: { scope, message, ctx },
    }));
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000,        // Data fresh for 2 min
            gcTime: 10 * 60 * 1000,          // Keep unused data for 10 min
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
        queryCache: new QueryCache({
          onError: (error, query) => {
            dispatchError('query', error, query.queryKey?.join?.('.') ?? '');
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _vars, _ctx, mutation) => {
            const key = mutation.options.mutationKey?.join?.('.') ?? '';
            dispatchError('mutation', error, key);
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
