import type { ReactElement } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { createQueryClient } from '@/react/lib/query-client';

/** Render a screen the way the app mounts it (inside a React Query provider), with a fresh client and no retries so failures show at once. */
export function renderWithQuery(ui: ReactElement, options?: RenderOptions) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity }, mutations: { retry: false } });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>, options) };
}
