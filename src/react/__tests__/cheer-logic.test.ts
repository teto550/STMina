import { CHEER_LINES, cheerSteps, fillLine, shuffled } from '@/react/screens/spiritual-notes-ranking/cheer';

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

describe('fillLine', () => {
  it('puts the name in every place of the rhyme', () => {
    expect(fillLine('{name} و{name}', 'مينا')).toBe('مينا ومينا');
  });
});

describe('cheerSteps', () => {
  const ranked = [kid('a', 'بيتر ماهر جرجس', 1, 90), kid('b', 'مارك عادل فوزي', 2, 70), kid('c', 'مينا سامح عادل', 3, 50), kid('d', 'يوسف', 4, 10)];

  it('has every kid once, with no place and no points', () => {
    const steps = cheerSteps(ranked, {}, seeded());
    expect(steps.map((s) => s.kid.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    steps.forEach((s) => {
      expect(Object.keys(s).sort()).toEqual(['face', 'kid', 'line', 'photo']);
      expect(Object.keys(s.kid).sort()).toEqual(['id', 'name']);
    });
  });

  it('is not in the order of the ranking (shuffled), a different order for different random numbers', () => {
    const many = Array.from({ length: 12 }, (_, i) => kid(`k${i}`, `ولد ${i}`, i + 1, 100 - i));
    const ids = (r: () => number) => cheerSteps(many, {}, r).map((s) => s.kid.id);
    expect(ids(seeded())).not.toEqual(many.map((k) => k.id));
    expect(ids(() => 0.99)).not.toEqual(ids(() => 0));
  });

  it('gives each kid a rhyme with his first two names in it, and no rhyme is left with an empty {name}', () => {
    const steps = cheerSteps(ranked, {}, seeded());
    steps.forEach((s) => {
      expect(s.line).not.toContain('{name}');
    });
    expect(steps.find((s) => s.kid.id === 'a')?.line).toContain('بيتر ماهر');
    expect(steps.find((s) => s.kid.id === 'a')?.line).not.toContain('جرجس');
  });

  it('uses a different rhyme for each kid while there are enough, and repeats only after that', () => {
    const few = cheerSteps(ranked, {}, seeded(), ['{name} 1', '{name} 2', '{name} 3', '{name} 4']);
    expect(new Set(few.map((s) => s.line.replace(/^.* /, ''))).size).toBe(4);
    const crowd = Array.from({ length: CHEER_LINES.length + 3 }, (_, i) => kid(`k${i}`));
    const steps = cheerSteps(crowd, {}, seeded());
    expect(steps).toHaveLength(crowd.length);
    expect(steps.every((s) => s.line.length > 0)).toBe(true);
  });

  it('carries the photo of each kid (empty when he has none) and a different face for every step', () => {
    const steps = cheerSteps(ranked, { a: 'data:image/png;base64,AAA' }, seeded());
    expect(steps.find((s) => s.kid.id === 'a')?.photo).toBe('data:image/png;base64,AAA');
    expect(steps.find((s) => s.kid.id === 'b')?.photo).toBe('');
    expect(steps.map((s) => s.face)).toEqual([0, 1, 2, 3]);
  });

  it('works with nobody', () => {
    expect(cheerSteps([], {}, seeded())).toEqual([]);
  });

  it('every rhyme in the list has a place for the name', () => {
    CHEER_LINES.forEach((line) => expect(line).toContain('{name}'));
  });
});
