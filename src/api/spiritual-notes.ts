// النوتة الروحية: what each kid did in his spiritual life, written by the servants. Plain functions (no React):
// src/react/hooks/useSpiritualNotes.ts wraps them.
//   spiritualNotes/{studentId}/days/{YYYY-MM-DD}   { day, prayerMorning, prayerNight, gospel, mass, fast?, updatedAt, updatedBy }
//   spiritualNotes/{studentId}/months/{YYYY-MM}    { confession, updatedAt, updatedBy }
// Errors are NOT swallowed here (unlike getDocsFast): a refusal by the rules must reach the screen, not look like "nothing written yet".
import { collection, doc, documentId, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '@/core/firebase';

export interface NoteValues {
  prayerMorning: boolean;
  prayerNight: boolean;
  mass: boolean;
  /** did he read the gospel that day (older notes may still hold the text he wrote: any non-empty text counts as read) */
  gospel: boolean;
  /** only on the fasting days (Wednesday and Friday); left out on the other days */
  fast?: boolean;
}

export interface NoteDay extends Omit<Partial<NoteValues>, 'gospel'> {
  /** true, or (old notes) the text that was written */
  gospel?: boolean | string;
  /** YYYY-MM-DD */
  day: string;
}

type Raw = { id: string; data: () => Omit<Partial<NoteValues>, 'gospel'> & { gospel?: boolean | string } };

/** The days written since `since` (YYYY-MM-DD) for one kid, newest first. */
export async function fetchKidDays(childId: string, since: string): Promise<NoteDay[]> {
  const snap = await getDocs(query(collection(db, 'spiritualNotes', childId, 'days'), where(documentId(), '>=', since)));
  return (snap.docs as unknown as Raw[]).map((d) => ({ ...d.data(), day: d.id })).sort((a, b) => (a.day < b.day ? 1 : -1));
}

/** The days written from `from` to `to` (both YYYY-MM-DD, included) for one kid, newest first: one query for the week and the month totals. */
export async function fetchKidDaysBetween(childId: string, from: string, to: string): Promise<NoteDay[]> {
  const snap = await getDocs(query(collection(db, 'spiritualNotes', childId, 'days'), where(documentId(), '>=', from), where(documentId(), '<=', to)));
  return (snap.docs as unknown as Raw[]).map((d) => ({ ...d.data(), day: d.id })).sort((a, b) => (a.day < b.day ? 1 : -1));
}

/** One day of one kid; null when nothing was written that day. */
export async function fetchKidDay(childId: string, day: string): Promise<NoteDay | null> {
  const snap = await getDoc(doc(db, 'spiritualNotes', childId, 'days', day));
  return snap.exists() ? { ...(snap.data() as Omit<NoteDay, 'day'>), day } : null;
}

/** Did the kid confess in `month` (YYYY-MM)? */
export async function fetchConfession(childId: string, month: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'spiritualNotes', childId, 'months', month));
  return snap.exists() && snap.data().confession === true;
}

/** Saves one day of one kid (the fields not sent are kept). `by` is the servant who wrote it. */
export async function saveNoteDay({ childId, day, values, by }: { childId: string; day: string; values: NoteValues; by: string }): Promise<NoteDay> {
  await setDoc(doc(db, 'spiritualNotes', childId, 'days', day), { ...values, day, updatedAt: serverTimestamp(), updatedBy: by }, { merge: true });
  return { ...values, day };
}

export async function saveConfession({ childId, month, value, by }: { childId: string; month: string; value: boolean; by: string }): Promise<void> {
  await setDoc(doc(db, 'spiritualNotes', childId, 'months', month), { confession: value, updatedAt: serverTimestamp(), updatedBy: by }, { merge: true });
}

export type KidMonthData = { days: NoteDay[]; confessed: boolean };

/** For many kids at once: the days from `from` to `to` and whether each confessed in `month` (YYYY-MM). A few kids are read at a time; a failure reaches the caller. */
export async function fetchKidsMonthData(kidIds: string[], from: string, to: string, month: string): Promise<Record<string, KidMonthData>> {
  const out: Record<string, KidMonthData> = {};
  const AT_A_TIME = 8;
  for (let i = 0; i < kidIds.length; i += AT_A_TIME) {
    const chunk = kidIds.slice(i, i + AT_A_TIME);
    const results = await Promise.all(chunk.map(async (id) => ({ id, days: await fetchKidDaysBetween(id, from, to), confessed: await fetchConfession(id, month) })));
    for (const r of results) {
      out[r.id] = { days: r.days, confessed: r.confessed };
    }
  }
  return out;
}
