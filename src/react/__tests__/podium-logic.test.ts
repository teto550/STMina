import { cheerOf, faceOf, PODIUM_ORDER, podiumSteps, shortName } from '@/react/screens/spiritual-notes-ranking/podium';

const kid = (id: string, rank: number, month: number) => ({ id, name: `ولد ${id}`, rank, month, week: 0 });
const places = (steps: { place: number }[]) => steps.map((s) => s.place);
const ids = (steps: { kid: { id: string } }[]) => steps.map((s) => s.kid.id);

describe('podiumSteps', () => {
  it('reveals third place first and the winner last, one kid per step', () => {
    const steps = podiumSteps([kid('a', 1, 90), kid('b', 2, 70), kid('c', 3, 50), kid('d', 4, 10)]);
    expect(places(steps)).toEqual([3, 2, 1]);
    expect(ids(steps)).toEqual(['c', 'b', 'a']);
    expect(steps[2]?.kid.month).toBe(90);
  });

  it('gives every kid of a tie his own step in the same place, the later ones marked `again`', () => {
    const steps = podiumSteps([kid('a', 1, 90), kid('b', 2, 70), kid('c', 2, 70), kid('d', 4, 10)]);
    expect(places(steps)).toEqual([2, 2, 1]); // the place after a tie is skipped, like in the list (1, 2, 2, 4)
    expect(ids(steps)).toEqual(['b', 'c', 'a']);
    expect(steps.map((s) => s.again)).toEqual([false, true, false]);
  });

  it('a place of 3 kids (3, 3, 3) is three steps of the third place', () => {
    const steps = podiumSteps([kid('a', 1, 90), kid('b', 1, 90), kid('c', 3, 50), kid('d', 3, 50), kid('e', 3, 50)]);
    expect(places(steps)).toEqual([3, 3, 3, 1, 1]);
    expect(steps.map((s) => s.again)).toEqual([false, true, true, false, true]);
  });

  it('skips second place when two kids share the first (1, 1, 3)', () => {
    const steps = podiumSteps([kid('a', 1, 90), kid('b', 1, 90), kid('c', 3, 50)]);
    expect(places(steps)).toEqual([3, 1, 1]);
  });

  it('works with fewer than three kids, and with nobody', () => {
    expect(places(podiumSteps([kid('a', 1, 40), kid('b', 2, 30)]))).toEqual([2, 1]);
    expect(places(podiumSteps([kid('a', 1, 40)]))).toEqual([1]);
    expect(podiumSteps([])).toEqual([]);
  });

  it('takes each kid\'s photo from the card; a kid without one gets an empty photo', () => {
    const steps = podiumSteps([kid('a', 1, 90), kid('b', 2, 70)], { a: 'data:image/png;base64,AAA' });
    expect(steps.map((s) => s.photo)).toEqual(['', 'data:image/png;base64,AAA']);
  });

  it('numbers the steps, so every kid of the show gets a different face and a different sound', () => {
    const steps = podiumSteps([kid('a', 1, 90), kid('b', 2, 70), kid('c', 3, 50)]);
    expect(steps.map((s) => s.face)).toEqual([0, 1, 2]);
  });

  it('draws the finished podium as second, first, third', () => {
    expect(PODIUM_ORDER).toEqual([2, 1, 3]);
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
