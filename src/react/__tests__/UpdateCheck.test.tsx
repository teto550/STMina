import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const fetchLatest = vi.fn();
vi.mock('@/api/version', async (orig) => ({ ...(await orig<typeof import('@/api/version')>()), fetchLatestVersion: () => fetchLatest() }));
vi.mock('@/core/app-version', () => ({ APP_VERSION: '0.1.5', APP_BUILD: 'old-build', APP_BUILT_AT: '2026-10-16T10:00:00Z', IS_DEV_BUILD: false }));
const reload = vi.fn();
vi.mock('@/react/hooks/useAppUpdate', async (orig) => ({ ...(await orig<typeof import('@/react/hooks/useAppUpdate')>()), reloadApp: () => reload() }));

import UpdateBanner from '@/react/screens/update-banner';
import { AppSettings } from '@/react/screens/settings/AppSettings';

const wrap = (node: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

beforeEach(() => {
  fetchLatest.mockReset();
  reload.mockClear();
});

describe('UpdateBanner', () => {
  it('shows nothing while the build is the newest', async () => {
    fetchLatest.mockResolvedValue({ version: '0.1.5', build: 'old-build', builtAt: '' });
    wrap(<UpdateBanner />);
    await waitFor(() => expect(fetchLatest).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows nothing when the server cannot be asked', async () => {
    fetchLatest.mockResolvedValue(null);
    wrap(<UpdateBanner />);
    await waitFor(() => expect(fetchLatest).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers a reload when a newer build exists, and never reloads by itself', async () => {
    const user = userEvent.setup();
    fetchLatest.mockResolvedValue({ version: '0.1.6', build: 'new-build', builtAt: '' });
    wrap(<UpdateBanner />);
    expect(await screen.findByText(/فيه تحديث جديد للتطبيق \(0\.1\.6\)/)).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'تحديث الآن' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('can be hidden for that build', async () => {
    const user = userEvent.setup();
    fetchLatest.mockResolvedValue({ version: '0.1.6', build: 'new-build', builtAt: '' });
    wrap(<UpdateBanner />);
    await screen.findByText(/فيه تحديث جديد/);
    await user.click(screen.getByRole('button', { name: 'إخفاء' }));
    expect(screen.queryByText(/فيه تحديث جديد/)).not.toBeInTheDocument();
  });
});

describe('AppSettings (التطبيق)', () => {
  it('shows the running version, says the app is current and lets the person check again', async () => {
    const user = userEvent.setup();
    fetchLatest.mockResolvedValue({ version: '0.1.5', build: 'old-build', builtAt: '' });
    wrap(<AppSettings />);
    expect(await screen.findByText(/إنت على آخر نسخة/)).toBeInTheDocument();
    expect(screen.getByText(/الإصدار 0\.1\.5/)).toBeInTheDocument();
    fetchLatest.mockResolvedValue({ version: '0.1.6', build: 'new-build', builtAt: '' });
    await user.click(screen.getByRole('button', { name: 'تحقق من التحديث' }));
    expect(await screen.findByText(/فيه نسخة أحدث \(0\.1\.6\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'تحديث الآن' }));
    expect(reload).toHaveBeenCalled();
  });

  it('says when the server cannot be reached, with a retry', async () => {
    const user = userEvent.setup();
    fetchLatest.mockResolvedValue(null);
    wrap(<AppSettings />);
    expect(await screen.findByText(/معرفناش نوصل للسيرفر/)).toBeInTheDocument();
    fetchLatest.mockResolvedValue({ version: '0.1.5', build: 'old-build', builtAt: '' });
    await user.click(screen.getByRole('button', { name: 'حاول تاني' }));
    expect(await screen.findByText(/إنت على آخر نسخة/)).toBeInTheDocument();
  });
});
