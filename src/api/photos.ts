// Saving a person's photo. The photo is a small JPEG data URL stored on the person's own document, so changing or deleting one is a
// single write: nothing is read again (the screens update from the data they already hold).
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/core/firebase';

/** Who a photo belongs to: a kid (`students/{id}`) or a servant's account (`users/{uid}`). */
export type PhotoTarget = { kind: 'student' | 'servant'; id: string };

const COLLECTIONS: Record<PhotoTarget['kind'], string> = { student: 'students', servant: 'users' };

/** "student:abc123" -> { kind: 'student', id: 'abc123' }; null when it is not one. */
export function parsePhotoTarget(value: string | undefined): PhotoTarget | null {
  const at = (value ?? '').indexOf(':');
  if (at < 1) {
    return null;
  }
  const kind = (value as string).slice(0, at);
  const id = (value as string).slice(at + 1);
  if ((kind !== 'student' && kind !== 'servant') || !id) {
    return null;
  }
  return { kind, id };
}

/** Stores the photo of a person; an empty string deletes it. Rejects when it cannot be saved. */
export async function savePhoto(target: PhotoTarget, photo: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS[target.kind], target.id), { photo });
}
