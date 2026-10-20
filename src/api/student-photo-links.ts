// The imported photo link of a kid (`students/{id}.photoLink`). Written once by the admin; the rules forbid changing or removing it.
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/core/firebase';

const IN_LIMIT = 30; // Firestore `in` limit
const BATCH = 400;

export type KidForPhotoLink = { id: string; kidId?: unknown; photoLink?: unknown; name?: string; section?: string; grade?: string };

/** The kids whose ID is one of the given IDs (reads only the kids found, not every kid). Rejects when Firestore refuses. */
export async function findKidsByKidIds(kidIds: string[]): Promise<KidForPhotoLink[]> {
  const out: KidForPhotoLink[] = [];
  for (let i = 0; i < kidIds.length; i += IN_LIMIT) {
    const snap = await getDocs(query(collection(db, 'students'), where('kidId', 'in', kidIds.slice(i, i + IN_LIMIT))));
    snap.docs.forEach((d) => out.push({ id: d.id, ...d.data() } as KidForPhotoLink));
  }
  return out;
}

/** Writes the links (each kid only gets one if it has none; the rules enforce it). `onProgress(done, total)` after every batch. */
export async function saveKidPhotoLinks(ops: { studentId: string; url: string }[], onProgress?: (done: number, total: number) => void): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH).forEach((op) => batch.update(doc(db, 'students', op.studentId), { photoLink: op.url }));
    await batch.commit();
    onProgress?.(Math.min(i + BATCH, ops.length), ops.length);
  }
}
