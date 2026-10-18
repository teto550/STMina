import { QueryClient } from '@tanstack/react-query';

// The ONE React Query client shared by every React screen (mountIsland wraps each screen in its provider), so a result fetched by
// one screen can be reused by another and the app has a single cache.
//
// Defaults are chosen for Firestore's free quota (50,000 reads a day): no refetch when the window gets focus or the network comes
// back, and one retry only. A hook that wants fresh data every time sets its own `staleTime`.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false, refetchOnReconnect: false },
      mutations: { retry: 0 },
    },
  });
}

export const queryClient = createQueryClient();
