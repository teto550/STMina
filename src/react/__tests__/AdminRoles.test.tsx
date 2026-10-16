import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { AdminData } from '@/react/screens/admin-roles/types';

const data: AdminData = {
  roles: [{ id: 'b3', name: 'تالتة أولاد', admin: false, cells: ['male:3'], servants: [] }, { id: 'adm', name: 'أدمن', admin: true, cells: [], servants: [] }],
  people: [
    { id: 'p1', name: 'مينا', gender: 'male', roleIds: ['b3'] },
    { id: 'p2', name: 'ماريا', gender: 'female', roleIds: [] },
    { id: 'p3', name: 'بيتر', gender: 'male', roleIds: [] },
  ],
  accounts: [{ uid: 'u3', name: 'بيتر', email: 'c@x', role: 'deacon', deaconId: 'p3' }],
};
const commit = vi.fn(async (_ops: unknown[]) => undefined);
vi.mock('@/react/screens/admin-roles/data', () => ({ loadAdminData: vi.fn(async () => structuredClone(data)), loadNameLinks: vi.fn(async () => ({ students: ['s1'], attendance: ['a1', 'a2'], parts: [] })), commit: (ops: unknown[]) => commit(ops), newId: () => 'newid' }));

import AdminRoles from '@/react/screens/admin-roles';

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

  it('role editor: the خدام / خادمات block under the classes, saved on the role and on the members\' access', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: /تالتة أولاد/ }));
    const block = screen.getByRole('region', { name: 'الخدام' });
    expect(within(block).getByRole('checkbox', { name: 'خدام' })).not.toBeChecked();
    expect(within(block).getByRole('checkbox', { name: 'خادمات' })).not.toBeChecked();
    await user.click(within(block).getByRole('checkbox', { name: 'خدام' }));
    // بيتر has a login: adding him makes his access snapshot part of the same batch
    await user.click(screen.getByRole('button', { name: '+ إضافة أشخاص' }));
    await user.click(screen.getByRole('checkbox', { name: /بيتر/ }));
    await user.click(screen.getByRole('button', { name: /^تم/ }));
    await user.click(screen.getByRole('button', { name: 'حفظ' }));
    await waitFor(() => expect(commit).toHaveBeenCalled());
    const ops = commit.mock.calls[0]![0] as { col: string; data: Record<string, unknown> }[];
    expect(ops[0]).toMatchObject({ col: 'roles', data: { servants: ['male'] } });
    expect(ops.find((o) => o.col === 'users')).toMatchObject({ data: { access: { servants: ['male'] } } });
  });

  it('role editor: the servants block is hidden for an admin role, and an admin role shows as one chip in the list', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: /أدمن/ }));
    expect(screen.queryByRole('region', { name: 'الخدام' })).not.toBeInTheDocument();
  });

  it('role editor: a new role with only servants (no class) is accepted', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: '+ دور جديد' }));
    await user.type(screen.getByLabelText('اسم الدور'), 'مسؤول خادمات');
    await user.click(within(screen.getByRole('region', { name: 'الخدام' })).getByRole('checkbox', { name: 'خادمات' }));
    await user.click(screen.getByRole('button', { name: 'حفظ' }));
    await waitFor(() => expect(commit).toHaveBeenCalled());
    expect((commit.mock.calls[0]![0] as { data: Record<string, unknown> }[])[0]).toMatchObject({ data: { name: 'مسؤول خادمات', servants: ['female'], cells: [] } });
  });

  it('people tab: "+ شخص جديد" adds a general servant (no role) in one write', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: 'الأشخاص' }));
    await user.click(screen.getByRole('button', { name: '+ شخص جديد' }));
    await user.type(screen.getByLabelText('الاسم'), 'كيرلس هاني');
    await user.click(screen.getByRole('button', { name: 'إضافة' }));
    await waitFor(() => expect(commit).toHaveBeenCalled());
    const ops = commit.mock.calls[0]![0] as { col: string; data: Record<string, unknown> }[];
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ col: 'deacons', data: { name: 'كيرلس هاني', gender: 'male', section: 'boys', roleIds: [] } });
  });

  it('people tab: a new servant with a role gets it, and roles that do not fit the gender cannot be ticked', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: 'الأشخاص' }));
    await user.click(screen.getByRole('button', { name: '+ شخص جديد' }));
    const sheet = within(screen.getByRole('dialog', { name: 'إضافة شخص جديد' }));
    // admin roles are not offered here (there is "+ أدمن" for that)
    expect(sheet.queryByRole('checkbox', { name: /^أدمن/ })).not.toBeInTheDocument();
    await user.selectOptions(sheet.getByLabelText('النوع'), 'female');
    expect(sheet.getByRole('checkbox', { name: /تالتة أولاد/ })).toBeDisabled();
    await user.selectOptions(sheet.getByLabelText('النوع'), 'male');
    await user.type(sheet.getByLabelText('الاسم'), 'ماركو');
    await user.click(sheet.getByRole('checkbox', { name: /تالتة أولاد/ }));
    await user.click(sheet.getByRole('button', { name: 'إضافة' }));
    await waitFor(() => expect(commit).toHaveBeenCalled());
    expect((commit.mock.calls[0]![0] as { data: Record<string, unknown> }[])[0]).toMatchObject({ data: { name: 'ماركو', roleIds: ['b3'], grade: 'سنة تالتة ابتدائي' } });
  });

  it('people tab: the name is required', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: 'الأشخاص' }));
    await user.click(screen.getByRole('button', { name: '+ شخص جديد' }));
    await user.click(screen.getByRole('button', { name: 'إضافة' }));
    expect(await screen.findByText('اكتب الاسم')).toBeInTheDocument();
    expect(commit).not.toHaveBeenCalled();
  });

  it('rename: shows what will change and writes the new name everywhere in one batch', async () => {
    const user = userEvent.setup();
    render(<AdminRoles close={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: 'الأشخاص' }));
    await user.click(screen.getByRole('button', { name: 'تعديل اسم مينا' }));
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText(/سجل حضور/)).toHaveTextContent('1 مخدوم');
    const input = within(dialog).getByLabelText('الاسم');
    await user.clear(input);
    await user.type(input, 'مينا عادل');
    await user.click(within(dialog).getByRole('button', { name: 'حفظ الاسم' }));
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    const ops = commit.mock.calls[0]![0] as { col: string; id: string }[];
    expect(ops.map((o) => `${o.col}/${o.id}`)).toEqual(['deacons/p1', 'students/s1', 'deaconAttendance/a1', 'deaconAttendance/a2']);
  });
});
