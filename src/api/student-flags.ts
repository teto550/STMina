// "بيانات خاطئة" (see src/core/bad-data.ts): saves the list of wrong fields of a student, together with any corrected values.
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/core/firebase';

/**
 * Writes `patch` (corrected values) and `badFields` (the fields still marked wrong, [] to clear the mark) to the student's file.
 * Offline, Firestore keeps the write on the device and sends it when the connection is back, so the call does not wait for the server.
 */
export async function saveStudentBadData(
  studentId: string,
  patch: Record<string, string>,
  badFields: string[],
): Promise<void> {
  const write = updateDoc(doc(db, 'students', studentId), { ...patch, badFields });
  if (navigator.onLine) {
    await write;
  } else {
    write.catch(console.error);
  }
}
