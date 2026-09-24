import { filterPeople, planAddAdmin, planMembership, planRoleDelete, planRoleSave } from '@/react/admin/logic';
import type { AdminData } from '@/react/admin/types';

const data = (): AdminData => ({
  roles: [
    { id: 'b3', name: 'تالتة أولاد', admin: false, cells: ['male:3'] },
    { id: 'adm', name: 'أدمن', admin: true, cells: [] },
  ],
  people: [
    { id: 'p1', name: 'مينا', gender: 'male', roleIds: ['b3'] },
    { id: 'p2', name: 'ماريا', gender: 'female', roleIds: [] },
    { id: 'p3', name: 'بيتر', gender: 'male', roleIds: [] },
  ],
  accounts: [
    { uid: 'u1', name: 'مينا', email: 'a@x', role: 'deacon', deaconId: 'p1' },
    { uid: 'u3', name: 'بيتر', email: 'c@x', role: 'deacon', deaconId: 'p3' },
  ],
});

describe('filterPeople', () => {
  it('filters by name, gender and role', () => {
    const d = data();
    expect(filterPeople(d.people, { query: 'ماري', gender: 'all', roleId: 'all' }).map((p) => p.id)).toEqual(['p2']);
    expect(filterPeople(d.people, { query: '', gender: 'male', roleId: 'none' }).map((p) => p.id)).toEqual(['p3']);
    expect(filterPeople(d.people, { query: '', gender: 'all', roleId: 'b3' }).map((p) => p.id)).toEqual(['p1']);
  });
});

describe('planMembership', () => {
  it('adds people and refreshes their account snapshot in the same plan', () => {
    const plan = planMembership('add', 'b3', ['p3'], data());
    expect(plan.errors).toEqual([]);
    expect(plan.ops).toContainEqual({ col: 'deacons', id: 'p3', data: { roleIds: ['b3'] }, merge: true });
    const acc = plan.ops.find((o) => o.col === 'users' && o.id === 'u3');
    expect(acc && 'data' in acc && (acc.data.access as { cells: string[] }).cells).toEqual(['male:3']);
  });
  it('refuses a person whose gender does not fit the role', () => {
    const plan = planMembership('add', 'b3', ['p2'], data());
    expect(plan.ops).toEqual([]);
    expect(plan.errors[0]).toContain('ماريا');
  });
  it('makes the account admin when the admin role is added, and back to deacon only when it is removed', () => {
    const added = planMembership('add', 'adm', ['p3'], data());
    const acc = added.ops.find((o) => o.col === 'users');
    expect(acc && 'data' in acc && acc.data.role).toBe('admin');
    const d = data();
    d.people[2]!.roleIds = ['adm'];
    d.accounts[1]!.role = 'admin';
    const removed = planMembership('remove', 'adm', ['p3'], d);
    const acc2 = removed.ops.find((o) => o.col === 'users');
    expect(acc2 && 'data' in acc2 && acc2.data.role).toBe('deacon');
  });
  it('never demotes when the person was not touched by an admin role', () => {
    const removed = planMembership('remove', 'b3', ['p1'], data());
    const acc = removed.ops.find((o) => o.col === 'users');
    expect(acc && 'data' in acc && 'role' in acc.data).toBe(false);
  });
});

describe('planRoleSave', () => {
  it('needs a name and at least one class (unless admin)', () => {
    expect(planRoleSave({ id: 'n', name: ' ', admin: false, cells: [] }, [], data()).errors).toHaveLength(2);
    expect(planRoleSave({ id: 'n', name: 'أدمن 2', admin: true, cells: [] }, [], data()).errors).toEqual([]);
  });
  it('refreshes the accounts of every member when the classes change, in one plan', () => {
    const plan = planRoleSave({ id: 'b3', name: 'تالتة ورابعة', admin: false, cells: ['male:3', 'male:4'] }, ['p1'], data());
    expect(plan.errors).toEqual([]);
    expect(plan.affectedPeople).toBe(1);
    const acc = plan.ops.find((o) => o.col === 'users' && o.id === 'u1');
    expect(acc && 'data' in acc && (acc.data.access as { cells: string[] }).cells).toEqual(['male:3', 'male:4']);
  });
  it('blocks a member whose gender does not fit', () => {
    expect(planRoleSave({ id: 'b3', name: 'x', admin: false, cells: ['male:3'] }, ['p1', 'p2'], data()).errors[0]).toContain('ماريا');
  });
  it('a removed member loses the role and gets a refreshed snapshot', () => {
    const plan = planRoleSave({ id: 'b3', name: 'تالتة أولاد', admin: false, cells: ['male:3'] }, [], data());
    expect(plan.ops).toContainEqual({ col: 'deacons', id: 'p1', data: { roleIds: [] }, merge: true });
  });
});

describe('planRoleDelete', () => {
  it('blocks deleting a role that has members', () => {
    const r = planRoleDelete('b3', data());
    expect(r.ops).toEqual([]);
    expect(r.error).toContain('1');
  });
  it('deletes an empty role', () => expect(planRoleDelete('adm', data()).ops).toEqual([{ col: 'roles', id: 'adm', delete: true }]));
});

describe('planAddAdmin', () => {
  it('creates the admin role when there is none, the person, and links an existing account with that email', () => {
    const d = data();
    d.roles = d.roles.filter((r) => !r.admin);
    d.accounts.push({ uid: 'u9', name: 'x', email: 'New@X.com', role: 'deacon' });
    const plan = planAddAdmin({ id: 'p9', name: ' سارة  ', gender: 'female', email: 'new@x.com' }, d);
    expect(plan.errors).toEqual([]);
    expect(plan.ops[0]).toMatchObject({ col: 'roles', id: 'admin', data: { admin: true } });
    expect(plan.ops).toContainEqual({ col: 'deacons', id: 'p9', data: { name: 'سارة', gender: 'female', roleIds: ['admin'], email: 'new@x.com' }, merge: false });
    expect(plan.ops.find((o) => o.col === 'users')).toMatchObject({ id: 'u9', data: { deaconId: 'p9', role: 'admin' } });
  });
  it('reuses the existing admin role and refuses a duplicate name', () => {
    const plan = planAddAdmin({ id: 'p9', name: 'مينا', gender: 'male', email: 'a@b.c' }, data());
    expect(plan.errors[0]).toContain('بنفس الاسم');
    expect(plan.ops.some((o) => o.col === 'roles')).toBe(false);
  });
});
