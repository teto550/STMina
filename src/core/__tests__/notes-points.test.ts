import { cleanPoints, DEFAULT_POINTS, isValidPoint, MAX_NOTE_POINT, NOTE_POINT_ITEMS } from '@/core/notes-points';

describe('notes points', () => {
  it('the starting points are the ones the programme began with', () => {
    expect(DEFAULT_POINTS).toEqual({ prayerMorning: 5, prayerNight: 5, gospel: 15, mass: 20, fast: 10, confession: 25 });
  });

  it('every point has a label in the settings sheet', () => {
    expect(NOTE_POINT_ITEMS.map((i) => i.key).sort()).toEqual(Object.keys(DEFAULT_POINTS).sort());
  });

  it('accepts whole numbers from 0 to the maximum only', () => {
    expect([0, 1, 25, MAX_NOTE_POINT].every(isValidPoint)).toBe(true);
    expect([-1, 1.5, MAX_NOTE_POINT + 1, NaN, '5', null, undefined].some(isValidPoint)).toBe(false);
  });

  it('keeps the valid values and falls back to the default for the rest, so a hand-edited document never breaks the screens', () => {
    expect(cleanPoints({ mass: 40, gospel: -3, fast: '10', prayerNight: 0, junk: 9 })).toEqual({ ...DEFAULT_POINTS, mass: 40, prayerNight: 0 });
    expect(cleanPoints(null)).toEqual(DEFAULT_POINTS);
    expect(cleanPoints('x')).toEqual(DEFAULT_POINTS);
  });
});
