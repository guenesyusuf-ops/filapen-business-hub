'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000,        // Data fresh for 2 min (avoids excessive refetches)
            gcTime: 10 * 60 * 1000,         // Keep unused data for 10 min
            refetchOnWindowFocus: false,     // Don't refetch on tab switch (mutations handle freshness)
            refetchOnReconnect: true,        // Refresh after network reconnect
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
