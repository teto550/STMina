import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { AdminData } from '@/react/admin/types';

const data: AdminData = {
  roles: [{ id: 'b3', name: 'تالتة أولاد', admin: false, cells: ['male:3'] }, { id: 'adm', name: 'أدمن', admin: true, cells: [] }],
  people: [
    { id: 'p1', name: 'مينا', gender: 'male', roleIds: ['b3'] },
    { id: 'p2', name: 'ماريا', gender: 'female', roleIds: [] },
    { id: 'p3', name: 'بيتر', gender: 'male', roleIds: [] },
  ],
  accounts: [{ uid: 'u3', name: 'بيتر', email: 'c@x', role: 'deacon', deaconId: 'p3' }],
};
const commit = vi.fn(async (_ops: unknown[]) => undefined);
vi.mock('@/react/admin/data', () => ({ loadAdminData: vi.fn(async () => structuredClone(data)), commit: (ops: unknown[]) => commit(ops), newId: () => 'newid' }));

import AdminRoles from '@/react/screens/AdminRoles';

beforeEach(() => commit.mockClear());

describe('AdminRoles screen', () => {
  it('shows the roles with their classes and member counts', async () => {
    render(<AdminRoles close={() => undefined} />);
    const card = (await screen.findByRole('button', { name: /تالتة أولاد/ }));
    expect(card).toHaveTextContent('1 شخص');
    expect(card).toHaveTextContent('تالتة أولاد');
  });

  it('roles tab: search filters the list and shows a message when nothing matches', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await screen.findByRole('button', { name: /تالتة أولاد/ });
    await user.type(screen.getByLabelText('بحث في الأدوار'), 'أدم');
    expect(screen.queryByRole('button', { name: /تالتة أولاد/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /أدمن/ })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('بحث في الأدوار'));
    await user.type(screen.getByLabelText('بحث في الأدوار'), 'زززز');
    expect(screen.getByText('مفيش دور بالاسم ده')).toBeInTheDocument();
  });

  it('people tab: lists everyone, filters by gender and by name in the browser', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: 'الأشخاص' }));
    expect(screen.getByText('مينا')).toBeInTheDocument();
    expect(screen.getByText('ماريا')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'خادمات' }));
    expect(screen.queryByText('مينا')).not.toBeInTheDocument();
    expect(screen.getByText('ماريا')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'الكل' }));
    await user.type(screen.getByLabelText('بحث بالاسم'), 'بيت');
    expect(screen.queryByText('مينا')).not.toBeInTheDocument();
    expect(screen.getByText('بيتر')).toBeInTheDocument();
  });

  it('batch add: select a servant, add to a role, one batch is committed', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: 'الأشخاص' }));
    await user.click(screen.getByRole('checkbox', { name: /بيتر/ }));
    await user.click(screen.getByRole('button', { name: 'إضافة لدور' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'تالتة أولاد' }));
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    const ops = commit.mock.calls[0]![0] as { col: string; id: string }[];
    expect(ops.map((o) => `${o.col}/${o.id}`)).toEqual(['deacons/p3', 'users/u3']);
  });

  it('role editor: a role with members cannot be deleted', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: /تالتة أولاد/ }));
    await user.click(screen.getByRole('button', { name: 'حذف' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('انقلهم');
    expect(commit).not.toHaveBeenCalled();
  });

  it('role editor: the member picker disables people whose gender does not fit', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: /تالتة أولاد/ }));
    await user.click(screen.getByRole('button', { name: '+ إضافة أشخاص' }));
    expect(screen.getByRole('checkbox', { name: /ماريا/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /بيتر/ })).toBeEnabled();
  });
});
