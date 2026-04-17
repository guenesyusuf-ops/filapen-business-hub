'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,           // Data considered fresh for 30s
            gcTime: 5 * 60 * 1000,          // Keep unused data for 5 min
            refetchOnWindowFocus: true,      // Auto-refresh when user returns
            refetchOnReconnect: true,        // Auto-refresh after network reconnect
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
