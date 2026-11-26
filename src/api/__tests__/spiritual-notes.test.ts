import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ active: 0, peak: 0 }));

vi.mock('@/core/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => {
  // every read takes a moment; `peak` is the most reads that were running at the same time
  const slow = async <T>(value: T): Promise<T> => {
    h.active += 1;
    h.peak = Math.max(h.peak, h.active);
    await new Promise((r) => setTimeout(r, 5));
    h.active -= 1;
    return value;
  };
  return {
    collection: vi.fn((_db: unknown, ...path: string[]) => ({ path })),
    doc: vi.fn((_db: unknown, ...path: string[]) => ({ path })),
    documentId: vi.fn(() => '__name__'),
    where: vi.fn(),
    query: vi.fn((c: unknown) => c),
    getDocs: vi.fn(() => slow({ docs: [] })),
    getDoc: vi.fn(() => slow({ exists: () => false })),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(),
  };
});

import { fetchKidsMonthData } from '../spiritual-notes';

describe('fetchKidsMonthData', () => {
  beforeEach(() => {
    h.active = 0;
    h.peak = 0;
  });

  it('reads every kid and gives each one an entry', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `k${i}`);
    const out = await fetchKidsMonthData(ids, '2030-10-01', '2030-10-28', '2030-10');
    expect(Object.keys(out).sort()).toEqual([...ids].sort());
    expect(out.k0).toEqual({ days: [], confessed: false, starWeeks: [] });
  });

  it('runs the reads of a kid, and of many kids, together (not one after the other)', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `k${i}`);
    await fetchKidsMonthData(ids, '2030-10-01', '2030-10-28', '2030-10');
    expect(h.peak).toBeGreaterThan(8);
  });

  it('returns nothing for no kids', async () => {
    expect(await fetchKidsMonthData([], '2030-10-01', '2030-10-28', '2030-10')).toEqual({});
  });
});
