// Which kids already have a password. Admin only: Firestore rules let only an admin list `student_secrets`.
// Only the existence is returned, never the password itself.
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/firebase';

const CHUNK = 30; // Firestore `in` limit
const TTL_MS = 2 * 60 * 1000;

let cache: { key: string; at: number; ids: Set<string> } | null = null;

/**
 * Of the given kid ids, the ones that have a password. Reads only those documents (one read per kid that has a password),
 * and keeps the answer for two minutes so flipping the filter does not read again.
 * Rejects when Firestore refuses or cannot be reached (the screen shows an error).
 */
export async function fetchStudentIdsWithPassword(studentIds: string[], { force = false } = {}): Promise<Set<string>> {
  const key = [...studentIds].sort().join('|');
  if (!force && cache && cache.key === key && Date.now() - cache.at < TTL_MS) {
    return cache.ids;
  }
  const ids = new Set<string>();
  for (let i = 0; i < studentIds.length; i += CHUNK) {
    const chunk = studentIds.slice(i, i + CHUNK);
    const snap = await getDocs(query(collection(db, 'student_secrets'), where(documentId(), 'in', chunk)));
    snap.docs.forEach((d) => ids.add(d.id));
  }
  cache = { key, at: Date.now(), ids };
  return ids;
}
