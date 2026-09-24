// Firestore access of the roles admin screen: one read of the three small collections, and ONE atomic batch per change.
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '@/core/firebase';
import { countReads } from '@/core/firestore-helpers';
import type { Cell, Gender } from '@/types/access';
import type { AdminAccount, AdminData, AdminPerson, AdminRole, NameLinks, WriteOp } from './types';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** roles + servants list + accounts (about 70 reads for the whole school; read again only when the screen is opened). */
export async function loadAdminData(): Promise<AdminData> {
  const [roles, people, accounts] = await Promise.all([getDocs(collection(db, 'roles')), getDocs(collection(db, 'deacons')), getDocs(collection(db, 'users'))]);
  countReads('admin/roles', Math.max(roles.size, 1));
  countReads('admin/deacons', Math.max(people.size, 1));
  countReads('admin/users', Math.max(accounts.size, 1));
  return {
    roles: roles.docs.map((d) => ({ id: d.id, name: str(d.data().name), admin: d.data().admin === true, cells: (d.data().cells ?? []) as Cell[] }) satisfies AdminRole).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    people: people.docs
      .map((d): AdminPerson => ({ id: d.id, name: str(d.data().name), gender: (d.data().gender === 'female' ? 'female' : 'male') as Gender, roleIds: (d.data().roleIds ?? []) as string[], email: str(d.data().email) || undefined }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    accounts: accounts.docs.map((d): AdminAccount => ({
      uid: d.id, name: str(d.data().name), email: str(d.data().email), role: str(d.data().role), deaconId: str(d.data().deaconId) || undefined, access: d.data().access,
    })),
  };
}

/** Writes all operations in ONE batch (all or nothing). Firestore allows 500 per batch; the school has far fewer people. */
export async function commit(ops: WriteOp[]): Promise<void> {
  if (ops.length === 0) return;
  if (ops.length > 490) throw new Error('عدد التعديلات كبير جدًا مرة واحدة');
  const batch = writeBatch(db);
  for (const op of ops) {
    const ref = doc(db, op.col, op.id);
    if ('delete' in op) batch.delete(ref);
    else if (op.merge) batch.set(ref, op.col === 'roles' ? { ...op.data, updatedAt: serverTimestamp() } : op.data, { merge: true });
    else batch.set(ref, op.data);
  }
  await batch.commit();
}

/** A new document id (roles and people created from the screen). */
export const newId = (col: 'roles' | 'deacons'): string => doc(collection(db, col)).id;

/** The kids, attendance records and part assignments that still refer to a servant by name. */
export async function loadNameLinks(name: string): Promise<NameLinks> {
  const [students, attendance, parts] = await Promise.all([
    getDocs(query(collection(db, 'students'), where('deacon', '==', name))),
    getDocs(query(collection(db, 'deaconAttendance'), where('name', '==', name))),
    getDocs(query(collection(db, 'parts_distribution'), where('deaconName', '==', name))),
  ]);
  countReads('admin/nameLinks', Math.max(students.size + attendance.size + parts.size, 1));
  return { students: students.docs.map((d) => d.id), attendance: attendance.docs.map((d) => d.id), parts: parts.docs.map((d) => d.id) };
}
