// Links a new account to its person of the servants list when an admin approves it, and gives it the access of that person's roles
// (docs/ROLES-DESIGN.md, "admin adds another admin": the account links when that email registers). Only an admin can write these fields.
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/firebase';
import { computeAccess } from '@/core/access-config';
import type { Access, Cell } from '@/types/access';

export interface LinkUser { email?: string; name?: string; deaconId?: string; section?: string }
export interface LinkPerson { id: string; name: string; email?: string; section?: string; roleIds?: string[] }

const clean = (s: unknown): string => (typeof s === 'string' ? s : '').replace(/\s+/g, ' ').trim().toLowerCase();

/** The person an account belongs to: the recorded link, else the same email, else the same name in the same section (only when unique). */
export function pickPerson(user: LinkUser, people: LinkPerson[]): LinkPerson | null {
  if (user.deaconId) { const p = people.find((x) => x.id === user.deaconId); if (p) return p; }
  const email = clean(user.email);
  if (email) { const m = people.filter((p) => clean(p.email) === email); if (m.length === 1) return m[0]!; }
  const name = clean(user.name);
  if (name) {
    const m = people.filter((p) => clean(p.name) === name && (p.section || 'boys') === (user.section || 'boys'));
    if (m.length === 1) return m[0]!;
  }
  return null;
}

/** What to write on the account when it is approved: the person link and, when the person has roles, the access snapshot (and the admin flag). */
export function approvalPatch(person: LinkPerson | null, roles: { admin: boolean; cells: Cell[] }[]): Record<string, unknown> {
  if (!person) return {};
  const patch: Record<string, unknown> = { deaconId: person.id };
  if (roles.length) {
    const access: Access = computeAccess(roles.map((r, i) => ({ id: String(i), name: '', admin: r.admin, cells: r.cells })));
    patch.access = access;
    if (access.admin) patch.role = 'admin';
  }
  return patch;
}

/** Looks the person and their roles up in Firestore (a few reads) and returns the patch for the account. */
export async function findApprovalPatch(user: LinkUser): Promise<Record<string, unknown>> {
  const found = new Map<string, LinkPerson>();
  const add = (d: { id: string; data: () => Record<string, unknown> }) => {
    const v = d.data();
    found.set(d.id, { id: d.id, name: String(v.name ?? ''), email: v.email as string | undefined, section: v.section as string | undefined, roleIds: (v.roleIds as string[] | undefined) ?? [] });
  };
  if (user.deaconId) { const s = await getDoc(doc(db, 'deacons', user.deaconId)); if (s.exists()) add(s); }
  if (user.email) (await getDocs(query(collection(db, 'deacons'), where('email', '==', clean(user.email))))).docs.forEach(add);
  if (user.name) (await getDocs(query(collection(db, 'deacons'), where('name', '==', user.name)))).docs.forEach(add);
  const person = pickPerson(user, [...found.values()]);
  if (!person) return {};
  const roles = (await Promise.all((person.roleIds ?? []).map((id) => getDoc(doc(db, 'roles', id)))))
    .filter((s) => s.exists()).map((s) => ({ admin: s.data()?.admin === true, cells: (s.data()?.cells ?? []) as Cell[] }));
  return approvalPatch(person, roles);
}
