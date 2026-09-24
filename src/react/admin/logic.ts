// The rules of the roles admin screen as pure functions (no Firestore, no React): who is in a role, what a change would write,
// what is not allowed. The screen only calls these and hands the resulting writes to one atomic batch (data.ts).
import { computeAccess, invalidCellsFor } from '@/core/access-config';
import type { Access, Gender } from '@/types/access';
import type { AdminAccount, AdminData, AdminPerson, AdminRole, NameLinks, WriteOp } from './types';

export const ADMIN_ROLE_ID = 'admin';

/** Roles in alphabetical (Arabic) order. */
export const sortRoles = (roles: AdminRole[]): AdminRole[] => [...roles].sort((a, b) => a.name.localeCompare(b.name, 'ar'));

/** Local search over role names (spaces ignored, no reads). */
export const filterRoles = (roles: AdminRole[], query: string): AdminRole[] => {
  const q = query.replace(/\s+/g, ' ').trim().toLowerCase();
  return q ? roles.filter((r) => r.name.replace(/\s+/g, ' ').toLowerCase().includes(q)) : roles;
};

export const membersOf = (roleId: string, people: AdminPerson[]): AdminPerson[] => people.filter((p) => p.roleIds.includes(roleId));

export const rolesOfPerson = (person: AdminPerson, roles: AdminRole[]): AdminRole[] => roles.filter((r) => person.roleIds.includes(r.id));

export const accountsOfPerson = (personId: string, accounts: AdminAccount[]): AdminAccount[] => accounts.filter((a) => a.deaconId === personId);

/** The access a person gets from the given role ids. */
export function accessFor(roleIds: string[], roles: AdminRole[]): Access {
  return computeAccess(roles.filter((r) => roleIds.includes(r.id)));
}

/** The reason a person may not be in this role (their gender does not fit the role's classes), or null. */
export function blockedReason(person: AdminPerson, role: Pick<AdminRole, 'cells' | 'admin'>): string | null {
  const bad = invalidCellsFor(person.gender, [{ id: '', name: '', admin: role.admin, cells: role.cells }]);
  return bad.length ? 'نوع الخادم ما يناسبش فصول الدور ده' : null;
}

export interface PersonFilter { query: string; gender: Gender | 'all'; roleId: string | 'all' | 'none' }

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();

export function filterPeople(people: AdminPerson[], f: PersonFilter): AdminPerson[] {
  const q = norm(f.query);
  return people.filter((p) => {
    if (q && !norm(p.name).includes(q)) return false;
    if (f.gender !== 'all' && p.gender !== f.gender) return false;
    if (f.roleId === 'none') return p.roleIds.length === 0;
    if (f.roleId !== 'all') return p.roleIds.includes(f.roleId);
    return true;
  });
}

/**
 * The writes that make each affected person's account carry the fresh access snapshot. `roleIdsByPerson` are the people whose roles
 * change (with their NEW list). The legacy `role` flag (what the security rules read) follows the admin role: it is set to
 * 'admin' when the person now has an admin role, and back to 'deacon' only when an admin role was removed from them.
 */
function accountWrites(changes: Map<string, string[]>, data: AdminData, roles: AdminRole[], removedAdmin: Set<string>): WriteOp[] {
  const ops: WriteOp[] = [];
  for (const [personId, roleIds] of changes) {
    const access = accessFor(roleIds, roles);
    for (const account of accountsOfPerson(personId, data.accounts)) {
      const patch: Record<string, unknown> = { access };
      if (access.admin) patch.role = 'admin';
      else if (removedAdmin.has(personId) && account.role === 'admin') patch.role = 'deacon';
      ops.push({ col: 'users', id: account.uid, data: patch, merge: true });
    }
  }
  return ops;
}

export interface Plan { ops: WriteOp[]; affectedPeople: number; errors: string[] }

/** Saves a role together with its (staged) list of members. Everything in ONE batch. */
export function planRoleSave(role: AdminRole, memberIds: string[], data: AdminData): Plan {
  const members = new Set(memberIds);
  const errors: string[] = [];
  if (!role.name.trim()) errors.push('اكتب اسم الدور');
  if (!role.admin && role.cells.length === 0) errors.push('اختار فصل واحد على الأقل (أو خلّي الدور أدمن)');
  for (const p of data.people) if (members.has(p.id)) {
    const why = blockedReason(p, role);
    if (why) errors.push(`${p.name}: ${why}`);
  }
  const before = new Set(membersOf(role.id, data.people).map((p) => p.id));
  const previous = data.roles.find((r) => r.id === role.id);
  const changed = (a: AdminRole | undefined) => !a || a.admin !== role.admin || a.name !== role.name || a.cells.join() !== [...role.cells].sort().join();
  const roleChanged = changed(previous);
  const touched = new Set<string>();
  for (const id of members) if (!before.has(id) || roleChanged) touched.add(id);
  for (const id of before) if (!members.has(id)) touched.add(id);

  const nextRoles = [...data.roles.filter((r) => r.id !== role.id), { ...role, cells: [...role.cells].sort() as AdminRole['cells'] }];
  const changes = new Map<string, string[]>();
  const removedAdmin = new Set<string>();
  const ops: WriteOp[] = [{ col: 'roles', id: role.id, data: { name: role.name.trim(), admin: role.admin, cells: [...role.cells].sort() }, merge: true }];
  for (const p of data.people) {
    if (!touched.has(p.id)) continue;
    const next = members.has(p.id) ? [...new Set([...p.roleIds, role.id])] : p.roleIds.filter((r) => r !== role.id);
    if (next.join() !== p.roleIds.join()) ops.push({ col: 'deacons', id: p.id, data: { roleIds: next }, merge: true });
    if (!members.has(p.id) && before.has(p.id) && (previous?.admin ?? false)) removedAdmin.add(p.id);
    changes.set(p.id, next);
  }
  ops.push(...accountWrites(changes, data, nextRoles, removedAdmin));
  return { ops, affectedPeople: touched.size, errors };
}

/** Adds (or removes) many people to/from one role at once (the batch bar of the People tab). */
export function planMembership(mode: 'add' | 'remove', roleId: string, personIds: string[], data: AdminData): Plan {
  const role = data.roles.find((r) => r.id === roleId);
  const errors: string[] = [];
  if (!role) return { ops: [], affectedPeople: 0, errors: ['الدور مش موجود'] };
  const ids = new Set(personIds);
  const ops: WriteOp[] = [];
  const changes = new Map<string, string[]>();
  const removedAdmin = new Set<string>();
  for (const p of data.people) {
    if (!ids.has(p.id)) continue;
    if (mode === 'add') {
      if (p.roleIds.includes(roleId)) continue;
      const why = blockedReason(p, role);
      if (why) { errors.push(`${p.name}: ${why}`); continue; }
      const next = [...p.roleIds, roleId];
      ops.push({ col: 'deacons', id: p.id, data: { roleIds: next }, merge: true });
      changes.set(p.id, next);
    } else {
      if (!p.roleIds.includes(roleId)) continue;
      const next = p.roleIds.filter((r) => r !== roleId);
      ops.push({ col: 'deacons', id: p.id, data: { roleIds: next }, merge: true });
      changes.set(p.id, next);
      if (role.admin) removedAdmin.add(p.id);
    }
  }
  ops.push(...accountWrites(changes, data, data.roles, removedAdmin));
  return { ops, affectedPeople: changes.size, errors };
}

/** A role can be deleted only when nobody is in it. */
export function planRoleDelete(roleId: string, data: AdminData): { ops: WriteOp[]; error: string | null } {
  const n = membersOf(roleId, data.people).length;
  if (n > 0) return { ops: [], error: `الدور فيه ${n} شخص. انقلهم لدور تاني الأول وبعدين احذفه.` };
  return { ops: [{ col: 'roles', id: roleId, delete: true }], error: null };
}

export interface NewAdmin { id: string; name: string; gender: Gender; email: string }

/**
 * "+ أدمن": creates a person (name, gender, email) holding the admin role, and creates the admin role when there is none yet.
 * An account that already uses this email is linked right away; otherwise the account links when that email logs in.
 */
export function planAddAdmin(input: NewAdmin, data: AdminData): Plan {
  const name = input.name.replace(/\s+/g, ' ').trim();
  const email = input.email.trim().toLowerCase();
  const errors: string[] = [];
  if (!name) errors.push('اكتب الاسم');
  if (data.people.some((p) => norm(p.name) === norm(name))) errors.push('فيه شخص بنفس الاسم في قايمة الخدام');
  const adminRole = data.roles.find((r) => r.admin);
  const roleId = adminRole?.id ?? ADMIN_ROLE_ID;
  const roles = adminRole ? data.roles : [...data.roles, { id: roleId, name: 'أدمن', admin: true, cells: [] }];
  const ops: WriteOp[] = [];
  if (!adminRole) ops.push({ col: 'roles', id: roleId, data: { name: 'أدمن', admin: true, cells: [] }, merge: true });
  ops.push({ col: 'deacons', id: input.id, data: { name, gender: input.gender, roleIds: [roleId], email }, merge: false });
  const existing = data.accounts.filter((a) => a.email.trim().toLowerCase() === email);
  for (const a of existing) ops.push({ col: 'users', id: a.uid, data: { deaconId: input.id, access: accessFor([roleId], roles), role: 'admin' }, merge: true });
  return { ops, affectedPeople: 1, errors };
}

/** Names are compared and stored with single spaces and no spaces at the ends. */
export const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim();

export interface RenamePlan { main: WriteOp[]; parts: WriteOp[]; errors: string[]; counts: { students: number; attendance: number; parts: number; accounts: number } }

/**
 * Renames a servant everywhere the name is used as a link. `main` is one atomic batch (the person, their logins, their kids and their
 * attendance records); `parts` (part assignments) is separate because its security rule may not allow edits yet.
 */
export function planRename(person: AdminPerson, newNameRaw: string, data: AdminData, links: NameLinks): RenamePlan {
  const newName = cleanName(newNameRaw);
  const errors: string[] = [];
  if (!newName) errors.push('اكتب الاسم الجديد');
  else if (newName === person.name) errors.push('ده نفس الاسم الحالي');
  else if (data.people.some((p) => p.id !== person.id && cleanName(p.name).toLowerCase() === newName.toLowerCase())) errors.push('فيه خادم تاني بنفس الاسم ده');
  // logins of this person: linked by id, or (not linked yet) carrying the old name
  const accounts = data.accounts.filter((a) => a.deaconId === person.id || (!a.deaconId && cleanName(a.name) === cleanName(person.name)));
  const main: WriteOp[] = [{ col: 'deacons', id: person.id, data: { name: newName }, merge: true }];
  accounts.forEach((a) => main.push({ col: 'users', id: a.uid, data: { name: newName }, merge: true }));
  links.students.forEach((id) => main.push({ col: 'students', id, data: { deacon: newName }, merge: true }));
  links.attendance.forEach((id) => main.push({ col: 'deaconAttendance', id, data: { name: newName }, merge: true }));
  const parts: WriteOp[] = links.parts.map((id) => ({ col: 'parts_distribution', id, data: { deaconName: newName }, merge: true }));
  return { main, parts, errors, counts: { students: links.students.length, attendance: links.attendance.length, parts: links.parts.length, accounts: accounts.length } };
}
