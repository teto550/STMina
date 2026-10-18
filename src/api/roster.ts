// The servants list, as the registration form needs it: a new servant picks their own name from it.
import { collection } from 'firebase/firestore';
import { db } from '@/core/firebase';
import { getDocsTtl } from '@/core/firestore-helpers';
import type { Section } from '@/types/access';

export interface RosterEntry { name: string; grade: string }

/** The servants of one section. Rejects when Firestore cannot be read (the screen shows the error and a retry button). */
export async function fetchRoster(section: Section): Promise<RosterEntry[]> {
  type Doc = { data: () => { name?: string; grade?: string; section?: string } };
  const snap = (await getDocsTtl(collection(db, 'deacons'), `deacons:${section}`)) as { docs: Doc[] };
  return snap.docs
    .map((d) => d.data())
    .filter((x): x is { name: string; grade?: string; section?: string } => !!x.name && (x.section || 'boys') === section)
    .map((x) => ({ name: x.name, grade: x.grade || '' }));
}
