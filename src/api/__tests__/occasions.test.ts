import { vi } from 'vitest';

const getDocs = vi.fn();
const addDoc = vi.fn(async (..._a: unknown[]) => ({ id: 'new1' }));
const updateDoc = vi.fn(async (..._a: unknown[]) => undefined);
const deleteDoc = vi.fn(async (..._a: unknown[]) => undefined);
const queries: unknown[][] = [];
vi.mock('@/core/firebase', () => ({ db: {} }));
vi.mock('@/core/firestore-helpers', () => ({ countReads: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_d: unknown, n: string) => n, doc: (_d: unknown, n: string, id: string) => `${n}/${id}`,
  where: (...a: unknown[]) => ['where', ...a], orderBy: (...a: unknown[]) => ['orderBy', ...a], query: (...a: unknown[]) => { queries.push(a); return 'q'; },
  getDocs: (...a: unknown[]) => getDocs(...a), addDoc: (...a: unknown[]) => addDoc(...a), updateDoc: (...a: unknown[]) => updateDoc(...a), deleteDoc: (...a: unknown[]) => deleteDoc(...a),
}));

import { OCCASIONS_TTL_MS, addOccasion, deleteOccasion, fetchOccasions, updateOccasion, yearOf } from '@/api/occasions';

const snap = (rows: [string, string, string][]) => ({ size: rows.length, docs: rows.map(([id, title, date]) => ({ id, data: () => ({ title, date }) })) });
const kept = (year: number) => JSON.parse(localStorage.getItem(`occasions_${year}`) || 'null');

beforeEach(() => {
  localStorage.clear();
  getDocs.mockReset(); addDoc.mockClear(); updateDoc.mockClear(); deleteDoc.mockClear(); queries.length = 0;
  vi.useRealTimers();
});
afterEach(() => vi.useRealTimers());

describe('fetchOccasions: one year at a time, kept for a week', () => {
  it('reads the year from Firestore (a range on the date), sorted by date', async () => {
    getDocs.mockResolvedValue(snap([['b', 'عيد النيروز', '2026-09-11'], ['a', 'صوم الميلاد', '2026-01-07'], ['c', 'عيد الميلاد', '2026-01-07']]));
    const items = await fetchOccasions(2026);
    expect(items.map((x) => x.id)).toEqual(['a', 'c', 'b']); // the same day (7 Jan): by name, صوم before عيد
    expect(queries[0]).toEqual(['occasions', ['where', 'date', '>=', '2026-01-01'], ['where', 'date', '<=', '2026-12-31'], ['orderBy', 'date']]);
    expect(kept(2026).items).toHaveLength(3);
  });

  it('a second opening costs no read (the kept copy is used)', async () => {
    getDocs.mockResolvedValue(snap([['a', 'x', '2026-01-07']]));
    await fetchOccasions(2026);
    await fetchOccasions(2026);
    await fetchOccasions(2026);
    expect(getDocs).toHaveBeenCalledTimes(1);
  });

  it('a different year is its own read', async () => {
    getDocs.mockResolvedValue(snap([]));
    await fetchOccasions(2026);
    await fetchOccasions(2027);
    expect(getDocs).toHaveBeenCalledTimes(2);
  });

  it('after a week the copy is not trusted any more', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1));
    getDocs.mockResolvedValue(snap([['a', 'x', '2026-01-07']]));
    await fetchOccasions(2026);
    vi.setSystemTime(new Date(2026, 9, 1).getTime() + OCCASIONS_TTL_MS - 1000);
    await fetchOccasions(2026);
    expect(getDocs).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(2026, 9, 1).getTime() + OCCASIONS_TTL_MS + 1000);
    await fetchOccasions(2026);
    expect(getDocs).toHaveBeenCalledTimes(2);
  });

  it('"تحديث" (force) reads again whatever is kept', async () => {
    getDocs.mockResolvedValue(snap([['a', 'x', '2026-01-07']]));
    await fetchOccasions(2026);
    await fetchOccasions(2026, { force: true });
    expect(getDocs).toHaveBeenCalledTimes(2);
  });

  it('works when the browser blocks storage (every opening reads)', async () => {
    getDocs.mockResolvedValue(snap([['a', 'x', '2026-01-07']]));
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await expect(fetchOccasions(2026)).resolves.toHaveLength(1);
    await fetchOccasions(2026);
    expect(getDocs).toHaveBeenCalledTimes(2);
    get.mockRestore(); set.mockRestore();
  });
});

describe('changes update the kept copy (and never renew its age)', () => {
  beforeEach(async () => {
    getDocs.mockResolvedValue(snap([['a', 'عيد الميلاد', '2026-01-07']]));
    await fetchOccasions(2026);
  });

  it('add: written to Firestore and put in the kept copy of ITS year', async () => {
    const saved = await addOccasion({ title: 'صوم الميلاد', date: '2026-11-25' });
    expect(addDoc.mock.calls[0]![1]).toEqual({ title: 'صوم الميلاد', date: '2026-11-25' });
    expect(saved).toEqual({ id: 'new1', title: 'صوم الميلاد', date: '2026-11-25' });
    expect(kept(2026).items.map((x: { id: string }) => x.id)).toEqual(['a', 'new1']);
    await fetchOccasions(2026);
    expect(getDocs).toHaveBeenCalledTimes(1); // no new read
  });

  it('add to a year that is not kept leaves nothing behind (it is read when opened)', async () => {
    await addOccasion({ title: 'x', date: '2030-01-01' });
    expect(kept(2030)).toBeNull();
  });

  it('edit: moves it between years too', async () => {
    await updateOccasion({ id: 'a', title: 'عيد الميلاد', date: '2026-01-07' }, { title: 'عيد الميلاد المجيد', date: '2026-01-08' });
    expect(updateDoc.mock.calls[0]).toEqual(['occasions/a', { title: 'عيد الميلاد المجيد', date: '2026-01-08' }]);
    expect(kept(2026).items).toEqual([{ id: 'a', title: 'عيد الميلاد المجيد', date: '2026-01-08' }]);
  });

  it('delete: gone from Firestore and from the kept copy', async () => {
    await deleteOccasion({ id: 'a', title: 'عيد الميلاد', date: '2026-01-07' });
    expect(deleteDoc).toHaveBeenCalledWith('occasions/a');
    expect(kept(2026).items).toEqual([]);
  });
});

describe('yearOf', () => {
  it('is the year of a day', () => expect(yearOf('2027-01-07')).toBe(2027));
});
