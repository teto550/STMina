import { cheerOf, faceOf, isTop, lookOf, PODIUM_ORDER, podiumSteps, shortName } from '@/react/screens/spiritual-notes-ranking/podium';

const kid = (id: string, rank: number, stars: number) => ({ id, name: `ولد ${id}`, rank, stars });
const places = (steps: { place: number }[]) => steps.map((s) => s.place);
const ids = (steps: { kid: { id: string } }[]) => steps.map((s) => s.kid.id);

describe('podiumSteps', () => {
  it('reveals from the THIRD place up to the first, one kid per step', () => {
    const steps = podiumSteps([kid('a', 1, 6), kid('b', 2, 4), kid('c', 3, 2.5)]);
    expect(places(steps)).toEqual([3, 2, 1]);
    expect(ids(steps)).toEqual(['c', 'b', 'a']);
    expect(steps.at(-1)?.kid.stars).toBe(6);
  });

  it('is only the first three places: a long list is cut after the third place', () => {
    const ranked = Array.from({ length: 8 }, (_, i) => kid(`k${i + 1}`, i + 1, 6 - i * 0.5));
    const steps = podiumSteps(ranked);
    expect(places(steps)).toEqual([3, 2, 1]);
    expect(ids(steps)).toEqual(['k3', 'k2', 'k1']);
  });

  it('keeps every kid of a tie inside the first three places, the later ones marked `again`', () => {
    const steps = podiumSteps([kid('a', 1, 6), kid('b', 2, 4), kid('c', 2, 4), kid('d', 3, 0.5), kid('e', 4, 0.5)]);
    expect(places(steps)).toEqual([3, 2, 2, 1]);
    expect(ids(steps)).toEqual(['d', 'b', 'c', 'a']);
    expect(steps.map((s) => s.again)).toEqual([false, false, true, false]);
  });

  it('four kids with the same stars are four steps of the first place; nobody is left for the second', () => {
    const steps = podiumSteps([kid('a', 1, 4), kid('b', 1, 4), kid('c', 1, 4), kid('d', 1, 4), kid('e', 2, 3.5)]);
    expect(places(steps)).toEqual([2, 1, 1, 1, 1]);
    expect(steps.map((s) => s.again)).toEqual([false, false, true, true, true]);
  });

  it('works with fewer than three kids, and with nobody', () => {
    expect(places(podiumSteps([kid('a', 1, 4), kid('b', 2, 3)]))).toEqual([2, 1]);
    expect(places(podiumSteps([kid('a', 1, 4)]))).toEqual([1]);
    expect(podiumSteps([])).toEqual([]);
  });

  it('takes each kid\'s photo from the card; a kid without one gets an empty photo', () => {
    const steps = podiumSteps([kid('a', 1, 6), kid('b', 2, 4)], { b: 'data:image/png;base64,AAA' });
    expect(steps.map((s) => s.photo)).toEqual(['data:image/png;base64,AAA', '']);
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
