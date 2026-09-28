// Renames a servant everywhere the name is used as a link (names are join keys until the id migration, docs/ID-MIGRATION.md):
// the person (`deacons`), their logins, the kids assigned to them, their attendance and their part assignments.
// Shared by the "edit servant data" popup and the admin screen's rename sheet; the rules of the change are in react/admin/logic.ts.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/firebase';
import { commit, loadNameLinks } from '@/react/admin/data';
import { cleanName, planRename } from '@/react/admin/logic';
import type { AdminAccount, AdminPerson } from '@/react/admin/types';

export interface RenameResult { ok: boolean; error?: string; counts?: { students: number; attendance: number; parts: number; accounts: number }; partsFailed?: boolean; newName?: string }

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export async function renameServant(personId: string, oldName: string, newNameRaw: string): Promise<RenameResult> {
  const newName = cleanName(newNameRaw);
  // who else already has the new name? and the logins of this servant (linked by id, or still carrying the old name)
  const [same, byId, byName, links] = await Promise.all([
    getDocs(query(collection(db, 'deacons'), where('name', '==', newName))),
    getDocs(query(collection(db, 'users'), where('deaconId', '==', personId))),
    getDocs(query(collection(db, 'users'), where('name', '==', oldName))),
    loadNameLinks(oldName),
  ]);
  const people: AdminPerson[] = [{ id: personId, name: oldName, gender: 'male', roleIds: [] }, ...same.docs.map((d) => ({ id: d.id, name: str(d.data().name), gender: 'male' as const, roleIds: [] }))];
  const accounts = new Map<string, AdminAccount>();
  [...byId.docs, ...byName.docs].forEach((d) => accounts.set(d.id, { uid: d.id, name: str(d.data().name), email: str(d.data().email), role: str(d.data().role), deaconId: str(d.data().deaconId) || undefined }));
  const plan = planRename(people[0]!, newName, { roles: [], people, accounts: [...accounts.values()] }, links);
  if (plan.errors.length) return { ok: false, error: plan.errors[0] };
  await commit(plan.main);
  let partsFailed = false;
  if (plan.parts.length) { try { await commit(plan.parts); } catch (e) { console.warn(e); partsFailed = true; } }
  return { ok: true, counts: plan.counts, partsFailed, newName };
}
