import { PODIUM_ORDER, podiumSteps } from '@/react/screens/spiritual-notes-ranking/podium';

const kid = (id: string, rank: number, month: number) => ({ id, name: `ولد ${id}`, rank, month, week: 0 });

describe('podiumSteps', () => {
  it('reveals third place first and the winner last', () => {
    const steps = podiumSteps([kid('a', 1, 90), kid('b', 2, 70), kid('c', 3, 50), kid('d', 4, 10)]);
    expect(steps.map((s) => s.place)).toEqual([3, 2, 1]);
    expect(steps[0]?.kids.map((k) => k.id)).toEqual(['c']);
    expect(steps[2]?.points).toBe(90);
  });

  it('keeps kids with the same score together in one place', () => {
    const steps = podiumSteps([kid('a', 1, 90), kid('b', 2, 70), kid('c', 2, 70), kid('d', 4, 10)]);
    expect(steps.map((s) => s.place)).toEqual([2, 1]); // the place after a tie is skipped, like in the list (1, 2, 2, 4)
    expect(steps[0]?.kids.map((k) => k.id)).toEqual(['b', 'c']);
  });

  it('skips second place when two kids share the first (1, 1, 3)', () => {
    const steps = podiumSteps([kid('a', 1, 90), kid('b', 1, 90), kid('c', 3, 50)]);
    expect(steps.map((s) => s.place)).toEqual([3, 1]);
    expect(steps[1]?.kids.map((k) => k.id)).toEqual(['a', 'b']);
  });

  it('works with fewer than three kids, and with nobody', () => {
    expect(podiumSteps([kid('a', 1, 40), kid('b', 2, 30)]).map((s) => s.place)).toEqual([2, 1]);
    expect(podiumSteps([kid('a', 1, 40)]).map((s) => s.place)).toEqual([1]);
    expect(podiumSteps([])).toEqual([]);
  });

  it('draws the finished podium as second, first, third', () => {
    expect(PODIUM_ORDER).toEqual([2, 1, 3]);
  });
});
