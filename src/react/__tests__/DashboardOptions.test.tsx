import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import DashboardOptions from '@/react/screens/dashboard-options';

const sections = [
  { id: 'kpi', name: 'ملخص عام', desc: 'أرقام' },
  { id: 'late', name: 'متأخرين', desc: 'افتقاد' },
  { id: 'list', name: 'قائمة', desc: 'تليفونات' },
];

const open = (onShow: (ids: string[]) => Promise<void>, close = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DashboardOptions sections={sections} selected={['kpi', 'late']} onShow={onShow} close={close} />
    </QueryClientProvider>,
  );
  return close;
};

describe('DashboardOptions', () => {
  it('starts with the last choice and sends the chosen ids in list order, then closes', async () => {
    const user = userEvent.setup();
    const onShow = vi.fn(async () => undefined);
    const close = open(onShow);
    expect(screen.getByLabelText(/ملخص عام/)).toBeChecked();
    expect(screen.getByLabelText(/قائمة/)).not.toBeChecked();
    await user.click(screen.getByLabelText(/قائمة/));
    await user.click(screen.getByLabelText(/ملخص عام/));
    await user.click(screen.getByRole('button', { name: /اعرض الداشبورد/ }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(onShow).toHaveBeenCalledWith(['late', 'list']);
  });

  it('shows a loader on the button while loading', async () => {
    const user = userEvent.setup();
    let done: () => void = () => undefined;
    const onShow = vi.fn(() => new Promise<void>((r) => { done = r; }));
    open(onShow);
    await user.click(screen.getByRole('button', { name: /اعرض الداشبورد/ }));
    expect(await screen.findByRole('button', { name: 'جاري التحميل…' })).toBeDisabled();
    done();
  });

  it('shows an error and stays open when loading fails', async () => {
    const user = userEvent.setup();
    const close = open(vi.fn(async () => { throw new Error('quota'); }));
    await user.click(screen.getByRole('button', { name: /اعرض الداشبورد/ }));
    expect(await screen.findByText(/معرفناش نحمّل الداشبورد/)).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});
