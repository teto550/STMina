// The parts of the programme (توزيع الفقرات): `parts_distribution`, one document per part. A part needs only a title and a day; the type
// and the servant it is given to are optional and can be set later. Plain functions (no React): src/react/hooks/useParts.ts wraps them.
import { addDoc, collection, deleteDoc, doc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '@/core/firebase';
import { getDocsFast } from '@/core/firestore-helpers';
import { http, workerUrl } from '@/core/http';
import { deaconIdOfName } from '@/core/servants-index';
import type { Section } from '@/types/access';

export interface Part {
  id: string;
  grade: string;
  /** '' = no type yet */
  type: string;
  title: string;
  /** the day, YYYY-MM-DD */
  date: string;
  /** '' = nobody yet */
  deaconName: string;
  deaconId?: string | null;
  section?: string;
  createdAt?: { seconds: number };
}

export interface PartInput {
  type: string;
  title: string;
  date: string;
  deaconName: string;
}

const PUSH_WORKER_URL: string = import.meta.env.VITE_PUSH_WORKER_URL || '';
const pushReady = () => !!PUSH_WORKER_URL && !PUSH_WORKER_URL.includes('REPLACE');

/** The parts of one class, newest first. Rejects when Firestore cannot be read. */
export async function fetchParts(grade: string, section: Section): Promise<Part[]> {
  const snap = (await getDocsFast(query(collection(db, 'parts_distribution'), where('grade', '==', grade)))) as { docs: { id: string; data: () => Omit<Part, 'id'> }[] };
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id }) as Part)
    .filter((p) => (p.section || 'boys') === section)
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

/** Tells the servant a part was given to them: a push on their phone (when notifications are on). Never throws. */
async function tellServant(input: PartInput, grade: string): Promise<void> {
  if (!input.deaconName || !pushReady() || !auth.currentUser) {
    return;
  }
  try {
    const idToken = await auth.currentUser.getIdToken();
    // the push service wants a type: a part without one is announced as "فقرة"
    await http.post(workerUrl(PUSH_WORKER_URL, '/new-part'), { deaconName: input.deaconName, type: input.type || 'فقرة', title: input.title, date: input.date, grade }, { headers: { Authorization: `Bearer ${idToken}` }, timeout: 10000 });
  } catch (e) {
    console.warn('part push notify error:', e);
  }
}

export interface Author {
  uid: string;
  name: string;
}

export async function createPart({ grade, section, input, by }: { grade: string; section: Section; input: PartInput; by: Author }): Promise<Part> {
  const data = {
    grade,
    type: input.type,
    deaconName: input.deaconName,
    deaconId: input.deaconName ? deaconIdOfName(input.deaconName, section) : null,
    title: input.title,
    date: input.date,
    section,
    createdByUid: by.uid,
    createdByName: by.name,
  };
  const ref = await addDoc(collection(db, 'parts_distribution'), { ...data, createdAt: serverTimestamp() });
  void tellServant(input, grade);
  return { ...data, id: ref.id, createdAt: { seconds: Math.floor(Date.now() / 1000) } };
}

/** Edits a part: its day, title, type or servant (the class never changes). The servant is told only when they are newly given it. */
export async function updatePart({ before, section, input }: { before: Part; section: Section; input: PartInput }): Promise<Part> {
  const deaconId = input.deaconName ? deaconIdOfName(input.deaconName, section) : null;
  await updateDoc(doc(db, 'parts_distribution', before.id), { type: input.type, title: input.title, date: input.date, deaconName: input.deaconName, deaconId, updatedAt: serverTimestamp() });
  if (input.deaconName && input.deaconName !== before.deaconName) {
    void tellServant(input, before.grade);
  }
  return { ...before, ...input, deaconId };
}

export async function deletePart(id: string): Promise<void> {
  await deleteDoc(doc(db, 'parts_distribution', id));
}
