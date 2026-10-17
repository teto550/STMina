import type { Part } from '@/api/parts';
import { dateToStr, formatDateHeader, groupByDate, iconOf, nextFridayStr, upcomingDate, weekdayOf } from '@/react/screens/parts/logic';

const part = (id: string, date: string, over: Partial<Part> = {}): Part => ({ id, grade: 'g', type: '', title: id, date, deaconName: '', ...over });

describe('days', () => {
  it('formats a day like "الجمعة 25-9"', () => {
    expect(formatDateHeader('2026-10-16')).toBe('الجمعة 16-10');
    expect(formatDateHeader('2026-10-18')).toBe('الأحد 18-10');
    expect(formatDateHeader('')).toBe('');
    expect(weekdayOf('2026-10-17')).toBe('السبت');
  });

  it('the default day is the coming Friday, or today when it is Friday', () => {
    expect(nextFridayStr(new Date(2026, 9, 14))).toBe('2026-10-16'); // Wednesday
    expect(nextFridayStr(new Date(2026, 9, 16))).toBe('2026-10-16'); // Friday
    expect(nextFridayStr(new Date(2026, 9, 17))).toBe('2026-10-23'); // Saturday
    expect(dateToStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('groupByDate', () => {
  it('one group per day, the LATEST day first, parts without a day last, the given order kept inside a day', () => {
    const groups = groupByDate([part('a', '2026-10-23'), part('b', '2026-10-16'), part('c', ''), part('d', '2026-10-23'), part('e', '2026-10-17')]);
    expect(groups.map((g) => g.date)).toEqual(['2026-10-23', '2026-10-17', '2026-10-16', '']);
    expect(groups.find((g) => g.date === '2026-10-23')?.parts.map((p) => p.id)).toEqual(['a', 'd']);
  });

  it('any day works, not only Fridays', () => {
    expect(groupByDate([part('a', '2026-10-19')]).map((g) => g.date)).toEqual(['2026-10-19']); // a Monday
  });
});

describe('upcomingDate (the green day, wherever it falls in the newest-first list)', () => {
  const groups = groupByDate([part('a', '2026-10-10'), part('b', '2026-10-17'), part('c', '2026-10-24'), part('d', '')]);
  it('is the nearest day that is today or later', () => {
    expect(upcomingDate(groups, '2026-10-16')).toBe('2026-10-17');
    expect(upcomingDate(groups, '2026-10-17')).toBe('2026-10-17');
    expect(upcomingDate(groups, '2026-10-18')).toBe('2026-10-24');
  });
  it('is null when every day has passed', () => {
    expect(upcomingDate(groups, '2026-11-01')).toBeNull();
  });
});

describe('iconOf', () => {
  it('has an icon per type and a pin for a part without one', () => {
    expect(iconOf('الدرس')).toBe('📖');
    expect(iconOf('')).toBe('📌');
  });
});
