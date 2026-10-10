import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const fetchJoinRequests = vi.fn();
const approveJoinRequest = vi.fn(async (..._a: unknown[]) => undefined);
const rejectJoinRequest = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock('@/api/join-requests', () => ({
  fetchJoinRequests: (...a: unknown[]) => fetchJoinRequests(...a),
  approveJoinRequest: (...a: unknown[]) => approveJoinRequest(...a),
  rejectJoinRequest: (...a: unknown[]) => rejectJoinRequest(...a),
}));

import JoinRequests from '@/react/screens/join-requests';

const mina = { id: 'u1', name: 'مينا باسم', email: 'mina@x.com', grade: 'الصف الرابع', phones: ['0100'], address: 'القاهرة', graduated: false, college: 'هندسة', university: 'القاهرة' };
const mark = { id: 'u2', name: 'مارك', email: 'mark@x.com', grade: 'الصف الرابع' };

const open = (onCount = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <JoinRequests section="boys" grades={['الصف الرابع']} isAdmin onCount={onCount} close={() => undefined} />
    </QueryClientProvider>,
  );
  return onCount;
};

beforeEach(() => {
  fetchJoinRequests.mockReset();
  approveJoinRequest.mockClear();
  rejectJoinRequest.mockClear();
});

describe('JoinRequests', () => {
  it('shows a loader, then each request with its details', async () => {
    fetchJoinRequests.mockResolvedValue([mina, mark]);
    const onCount = open();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(await screen.findByText('مينا باسم')).toBeInTheDocument();
    expect(screen.getByText('mina@x.com')).toBeInTheDocument();
    expect(screen.getByText('القاهرة')).toBeInTheDocument();
    expect(fetchJoinRequests).toHaveBeenCalledWith({ section: 'boys', grades: ['الصف الرابع'] });
    await waitFor(() => expect(onCount).toHaveBeenCalledWith(2));
  });

  it('approving removes the request and reports the new count', async () => {
    fetchJoinRequests.mockResolvedValue([mina, mark]);
    const user = userEvent.setup();
    const onCount = open();
    await screen.findByText('مينا باسم');
    await user.click(screen.getAllByRole('button', { name: /قبول/ })[0]!);
    await waitFor(() => expect(screen.queryByText('مينا باسم')).not.toBeInTheDocument());
    expect(approveJoinRequest).toHaveBeenCalledWith('u1', true);
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1));
  });

  it('rejecting needs a second tap', async () => {
    fetchJoinRequests.mockResolvedValue([mina]);
    const user = userEvent.setup();
    open();
    await screen.findByText('مينا باسم');
    await user.click(screen.getByRole('button', { name: /رفض/ }));
    expect(rejectJoinRequest).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /أكيد/ }));
    await waitFor(() => expect(rejectJoinRequest).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText(/مفيش طلبات/)).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    fetchJoinRequests.mockResolvedValue([]);
    const onCount = open();
    expect(await screen.findByText(/مفيش طلبات/)).toBeInTheDocument();
    await waitFor(() => expect(onCount).toHaveBeenCalledWith(0));
  });

  it('shows the error with a retry that loads again', async () => {
    fetchJoinRequests.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([mina]);
    const user = userEvent.setup();
    open();
    expect(await screen.findByText('معرفناش نحمّل الطلبات.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'حاول تاني' }));
    expect(await screen.findByText('مينا باسم')).toBeInTheDocument();
  });

  it('shows a message when a decision cannot be saved and keeps the request', async () => {
    fetchJoinRequests.mockResolvedValue([mina]);
    approveJoinRequest.mockRejectedValueOnce(new Error('denied'));
    const user = userEvent.setup();
    open();
    await screen.findByText('مينا باسم');
    await user.click(screen.getByRole('button', { name: /قبول/ }));
    expect(await screen.findByText(/معرفناش نسجّل القرار/)).toBeInTheDocument();
    expect(screen.getByText('مينا باسم')).toBeInTheDocument();
  });
});
