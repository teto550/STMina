import type { Occasion } from '@/api/occasions';
import { countdownLabel, daysUntil, splitOccasions } from '@/react/screens/parts/occasions/logic';

const o = (id: string, date: string, title = id): Occasion => ({ id, title, date });

describe('splitOccasions', () => {
  const items = [o('c', '2026-12-25'), o('a', '2026-01-07'), o('b', '2026-10-17', 'ب'), o('d', '2026-10-17', 'ت'), o('e', '2026-03-01')];
  it('the coming ones (today included) nearest first, the ones that passed most recent first; several on one day are fine', () => {
    const { upcoming, past } = splitOccasions(items, '2026-10-17');
    expect(upcoming.map((x) => x.id)).toEqual(['b', 'd', 'c']);
    expect(past.map((x) => x.id)).toEqual(['e', 'a']);
  });
  it('an empty list is empty on both sides', () => {
    expect(splitOccasions([], '2026-10-17')).toEqual({ upcoming: [], past: [] });
  });
});

describe('daysUntil / countdownLabel', () => {
  it('counts whole days, across months and years', () => {
    expect(daysUntil('2026-10-17', '2026-10-17')).toBe(0);
    expect(daysUntil('2026-10-18', '2026-10-17')).toBe(1);
    expect(daysUntil('2027-01-07', '2026-12-25')).toBe(13);
    expect(daysUntil('2026-10-14', '2026-10-17')).toBe(-3);
  });
  it('says it in Egyptian Arabic', () => {
    expect(countdownLabel(0)).toBe('النهاردة');
    expect(countdownLabel(1)).toBe('بكرة');
    expect(countdownLabel(-1)).toBe('امبارح');
    expect(countdownLabel(2)).toBe('بعد يومين');
    expect(countdownLabel(5)).toBe('بعد 5 أيام');
    expect(countdownLabel(13)).toBe('بعد 13 يوم');
    expect(countdownLabel(-3)).toBe('من 3 أيام');
  });
});
