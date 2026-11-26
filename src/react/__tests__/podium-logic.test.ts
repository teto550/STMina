import { cheerOf, faceOf, isTop, lookOf, PODIUM_ORDER, podiumSteps, shortName } from '@/react/screens/spiritual-notes-ranking/podium';

const kid = (id: string, rank: number, stars: number) => ({ id, name: `ولد ${id}`, rank, stars });
const places = (steps: { place: number }[]) => steps.map((s) => s.place);
const ids = (steps: { kid: { id: string } }[]) => steps.map((s) => s.kid.id);

describe('podiumSteps', () => {
  it('reveals from the FIRST place down to the last, one kid per step', () => {
    const steps = podiumSteps([kid('a', 1, 6), kid('b', 2, 4), kid('c', 3, 2.5), kid('d', 4, 0.5)]);
    expect(places(steps)).toEqual([1, 2, 3, 4]);
    expect(ids(steps)).toEqual(['a', 'b', 'c', 'd']);
    expect(steps[0]?.kid.stars).toBe(6);
  });

  it('includes every ranked kid, a long list too, starting on the first place', () => {
    const ranked = Array.from({ length: 8 }, (_, i) => kid(`k${i + 1}`, i + 1, 6 - i * 0.5));
    const steps = podiumSteps(ranked);
    expect(places(steps)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(steps[0]?.kid.id).toBe('k1');
    expect(steps.at(-1)?.kid.id).toBe('k8');
  });

  it('gives every kid of a tie his own step in the same place, the later ones marked `again`', () => {
    const steps = podiumSteps([kid('a', 1, 6), kid('b', 2, 4), kid('c', 2, 4), kid('d', 4, 0.5)]);
    expect(places(steps)).toEqual([1, 2, 2, 4]); // the place after a tie is skipped (1, 2, 2, 4)
    expect(ids(steps)).toEqual(['a', 'b', 'c', 'd']);
    expect(steps.map((s) => s.again)).toEqual([false, false, true, false]);
  });

  it('a place of 3 kids (3, 3, 3) is three steps of the third place', () => {
    const steps = podiumSteps([kid('a', 1, 6), kid('b', 1, 6), kid('c', 3, 2), kid('d', 3, 2), kid('e', 3, 2)]);
    expect(places(steps)).toEqual([1, 1, 3, 3, 3]);
    expect(steps.map((s) => s.again)).toEqual([false, true, false, true, true]);
  });

  it('skips second place when two kids share the first (1, 1, 3)', () => {
    const steps = podiumSteps([kid('a', 1, 6), kid('b', 1, 6), kid('c', 3, 2)]);
    expect(places(steps)).toEqual([1, 1, 3]);
  });

  it('works with fewer than three kids, and with nobody', () => {
    expect(places(podiumSteps([kid('a', 1, 4), kid('b', 2, 3)]))).toEqual([1, 2]);
    expect(places(podiumSteps([kid('a', 1, 4)]))).toEqual([1]);
    expect(podiumSteps([])).toEqual([]);
  });

  it('takes each kid\'s photo from the card; a kid without one gets an empty photo', () => {
    const steps = podiumSteps([kid('a', 1, 6), kid('b', 2, 4)], { b: 'data:image/png;base64,AAA' });
    expect(steps.map((s) => s.photo)).toEqual(['', 'data:image/png;base64,AAA']);
  });

  it('numbers the steps, so every kid of the show gets a different face and a different sound', () => {
    const steps = podiumSteps([kid('a', 1, 6), kid('b', 2, 4), kid('c', 3, 2)]);
    expect(steps.map((s) => s.face)).toEqual([0, 1, 2]);
  });

  it('draws the finished podium as second, first, third', () => {
    expect(PODIUM_ORDER).toEqual([2, 1, 3]);
  });
});

describe('isTop / lookOf', () => {
  it('only the first three places get the podium', () => {
    expect([1, 2, 3].every(isTop)).toBe(true);
    expect([0, 4, 10].some(isTop)).toBe(false);
  });

  it('the places under the third get their own label and a shared look', () => {
    expect(lookOf(3).label).toBe('المركز التالت');
    expect(lookOf(4).label).toBe('المركز ٤');
    expect(lookOf(12).label).toBe('المركز ١٢');
    expect(lookOf(5).medal).toBe(lookOf(9).medal);
  });
});

describe('shortName', () => {
  it('keeps the first two names only', () => {
    expect(shortName('بيتر ماهر جرجس')).toBe('بيتر ماهر');
    expect(shortName('بيتر ماهر جرجس عبد المسيح')).toBe('بيتر ماهر');
  });

  it('keeps a short name as it is, and ignores extra spaces', () => {
    expect(shortName('بيتر')).toBe('بيتر');
    expect(shortName('بيتر ماهر')).toBe('بيتر ماهر');
    expect(shortName('  بيتر   ماهر   جرجس ')).toBe('بيتر ماهر');
    expect(shortName('')).toBe('');
  });
});

describe('faceOf', () => {
  it('gives the first ten kids ten different faces', () => {
    const faces = Array.from({ length: 10 }, (_, i) => faceOf(i).emoji);
    expect(new Set(faces).size).toBe(10);
  });

  it('starts again after the last one, and never fails', () => {
    expect(faceOf(10)).toEqual(faceOf(0));
    expect(faceOf(1234).emoji).toBeTruthy();
  });
});

describe('cheerOf', () => {
  it('has a cheer for every place, different from kid to kid', () => {
    for (const place of [1, 2, 3] as const) {
      expect(new Set([0, 1, 2].map((i) => cheerOf(place, i))).size).toBe(3);
      expect(cheerOf(place, 3)).toBe(cheerOf(place, 0));
    }
  });
});
