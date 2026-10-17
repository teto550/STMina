// Christian occasions (feasts, fasts, ...): `occasions/{id}` = { title, date }. ONE list for the whole app (all classes, both sections),
// changed rarely, so it is read only when the occasions popup is opened, ONE YEAR AT A TIME, and each year is kept in this browser for
// a week: opening it again costs no reads. Adding, editing or deleting updates the kept copy at once; other phones see a change when
// their copy expires or when the person taps "تحديث". Several occasions may share a day.
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/core/firebase';
import { countReads } from '@/core/firestore-helpers';

export interface Occasion {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
}

export interface OccasionInput {
  title: string;
  date: string;
}

/** How long a kept year is trusted. */
export const OCCASIONS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const keyOf = (year: number) => `occasions_${year}`;

export const yearOf = (date: string): number => Number(date.slice(0, 4));

type Kept = { at: number; items: Occasion[] };

const readKept = (year: number): Kept | null => {
  try {
    const kept = JSON.parse(localStorage.getItem(keyOf(year)) || 'null') as Kept | null;
    return kept && Array.isArray(kept.items) && typeof kept.at === 'number' ? kept : null;
  } catch {
    return null;
  }
};

const writeKept = (year: number, items: Occasion[]): void => {
  try {
    localStorage.setItem(keyOf(year), JSON.stringify({ at: Date.now(), items } satisfies Kept));
  } catch {
    // blocked storage: every opening simply reads again
  }
};

export const sortOccasions = (items: Occasion[]): Occasion[] => [...items].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'ar'));

/** Applies a change to the kept copy of a year, when there is one (the age of the copy is not renewed). */
function patchKept(year: number, change: (items: Occasion[]) => Occasion[]): void {
  const kept = readKept(year);
  if (!kept) {
    return;
  }
  try {
    localStorage.setItem(keyOf(year), JSON.stringify({ at: kept.at, items: sortOccasions(change(kept.items)) } satisfies Kept));
  } catch {
    // see writeKept
  }
}

/** The occasions of one year, by date. From the copy kept in this browser when it is fresh, otherwise (or with `force`) read from Firestore. */
export async function fetchOccasions(year: number, { force = false }: { force?: boolean } = {}): Promise<Occasion[]> {
  if (!force) {
    const kept = readKept(year);
    if (kept && Date.now() - kept.at < OCCASIONS_TTL_MS) {
      return kept.items;
    }
  }
  const snap = await getDocs(query(collection(db, 'occasions'), where('date', '>=', `${year}-01-01`), where('date', '<=', `${year}-12-31`), orderBy('date')));
  countReads(`occasions/${year}`, Math.max(snap.size, 1));
  const items = sortOccasions(snap.docs.map((d) => ({ id: d.id, title: String(d.data().title ?? ''), date: String(d.data().date ?? '') })));
  writeKept(year, items);
  return items;
}

export async function addOccasion(input: OccasionInput): Promise<Occasion> {
  const ref = await addDoc(collection(db, 'occasions'), { title: input.title, date: input.date });
  const saved = { id: ref.id, ...input };
  patchKept(yearOf(input.date), (items) => [...items, saved]);
  return saved;
}

export async function updateOccasion(before: Occasion, input: OccasionInput): Promise<Occasion> {
  await updateDoc(doc(db, 'occasions', before.id), { title: input.title, date: input.date });
  const saved = { id: before.id, ...input };
  patchKept(yearOf(before.date), (items) => items.filter((o) => o.id !== before.id));
  patchKept(yearOf(input.date), (items) => [...items.filter((o) => o.id !== before.id), saved]);
  return saved;
}

export async function deleteOccasion(occasion: Occasion): Promise<void> {
  await deleteDoc(doc(db, 'occasions', occasion.id));
  patchKept(yearOf(occasion.date), (items) => items.filter((o) => o.id !== occasion.id));
}
