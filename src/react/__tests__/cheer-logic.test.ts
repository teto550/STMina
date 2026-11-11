import { cheerSteps, shuffled } from '@/react/screens/spiritual-notes-ranking/cheer';

const kid = (id: string, name = `ولد ${id}`, rank = 1, month = 10) => ({ id, name, rank, month, week: 0 });

/** A random generator that always gives the same numbers, so the shuffles are the same in every run. */
const seeded = () => {
  let seed = 7;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
};

describe('shuffled', () => {
  it('keeps every item once and leaves the original list alone', () => {
    const list = [1, 2, 3, 4, 5, 6];
    const out = shuffled(list, seeded());
    expect([...out].sort()).toEqual(list);
    expect(list).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('cheerSteps', () => {
  const ranked = [kid('a', 'بيتر ماهر جرجس', 1, 90), kid('b', 'مارك عادل فوزي', 2, 70), kid('c', 'مينا سامح عادل', 3, 50), kid('d', 'يوسف', 4, 10)];

  it('has every kid once, with no place, no points and no sentence', () => {
    const steps = cheerSteps(ranked, {}, seeded());
    expect(steps.map((s) => s.kid.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    steps.forEach((s) => {
      expect(Object.keys(s).sort()).toEqual(['face', 'kid', 'photo', 'stars']);
      expect(Object.keys(s.kid).sort()).toEqual(['id', 'name']);
    });
  });

  it('is not in the order of the ranking (shuffled), a different order for different random numbers', () => {
    const many = Array.from({ length: 12 }, (_, i) => kid(`k${i}`, `ولد ${i}`, i + 1, 100 - i));
    const ids = (r: () => number) => cheerSteps(many, {}, r).map((s) => s.kid.id);
    expect(ids(seeded())).not.toEqual(many.map((k) => k.id));
    expect(ids(() => 0.99)).not.toEqual(ids(() => 0));
  });

  it('carries the photo of each kid (empty when he has none) and a different face for every step', () => {
    const steps = cheerSteps(ranked, { a: 'data:image/png;base64,AAA' }, seeded());
    expect(steps.find((s) => s.kid.id === 'a')?.photo).toBe('data:image/png;base64,AAA');
    expect(steps.find((s) => s.kid.id === 'b')?.photo).toBe('');
    expect(steps.map((s) => s.face)).toEqual([0, 1, 2, 3]);
  });

  it('gives each kid the stars the servant gave him (0 when none, never over six, only whole or half stars)', () => {
    const steps = cheerSteps(ranked, {}, seeded(), { a: 2.5, b: 9, c: 0.7 });
    const stars = (id: string) => steps.find((s) => s.kid.id === id)?.stars;
    expect(stars('a')).toBe(2.5);
    expect(stars('b')).toBe(6);
    expect(stars('c')).toBe(0.5);
    expect(stars('d')).toBe(0);
  });

  it('works with nobody', () => {
    expect(cheerSteps([], {}, seeded())).toEqual([]);
  });
});
