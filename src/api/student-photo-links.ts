// The imported photo link of a kid (`students/{id}.photoLink`). Written once by the admin; the rules forbid changing or removing it.
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/core/firebase';

const BATCH = 400;

/** Writes the links (each kid only gets one if it has none; the rules enforce it). `onProgress(done, total)` after every batch. */
export async function saveKidPhotoLinks(ops: { studentId: string; url: string }[], onProgress?: (done: number, total: number) => void): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH).forEach((op) => batch.update(doc(db, 'students', op.studentId), { photoLink: op.url }));
    await batch.commit();
    onProgress?.(Math.min(i + BATCH, ops.length), ops.length);
  }
}
