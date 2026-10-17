import type { Part } from '@/api/parts';
import { dateToStr, daysLabel, formatDateHeader, groupByDate, iconOf, nextFridayStr, nextOlderPage, olderPages, pageKeyOf, upcomingDate, visibleGroups, weekdayOf } from '@/react/screens/parts/logic';

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
  it('one group per day, the OLDEST day first, parts without a day before all of them, the given order kept inside a day', () => {
    const groups = groupByDate([part('a', '2026-10-23'), part('b', '2026-10-16'), part('c', ''), part('d', '2026-10-23'), part('e', '2026-10-17')]);
    expect(groups.map((g) => g.date)).toEqual(['', '2026-10-16', '2026-10-17', '2026-10-23']);
    expect(groups.find((g) => g.date === '2026-10-23')?.parts.map((p) => p.id)).toEqual(['a', 'd']);
  });

  it('any day works, not only Fridays', () => {
    expect(groupByDate([part('a', '2026-10-19')]).map((g) => g.date)).toEqual(['2026-10-19']); // a Monday
  });
});

describe('upcomingDate (the green day: the first one from today on)', () => {
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

describe('older days, one page per year', () => {
  const groups = groupByDate([part('a', '2024-03-01'), part('b', '2025-12-05'), part('c', '2025-12-12'), part('d', '2025-01-10'), part('e', '2026-09-04'), part('f', ''), part('g', '2026-10-18'), part('h', '2026-10-25'), part('i', '2027-01-08')]);
  const today = '2026-10-18';

  it('names the page of a day by its year, and none for a part without a day', () => {
    expect(pageKeyOf('2025-12-05')).toBe('2025');
    expect(pageKeyOf('')).toBe('');
  });

  it('only the days before today are older pages, the most recent year first, the parts without a day last', () => {
    expect(olderPages(groups, today)).toEqual([{ key: '2026', days: 1 }, { key: '2025', days: 3 }, { key: '2024', days: 1 }, { key: '', days: 1 }]);
    expect(olderPages(groupByDate([part('a', '2026-10-18')]), today)).toEqual([]); // today is not older
  });

  it('the button loads the most recent year not shown yet', () => {
    const pages = olderPages(groups, today);
    expect(nextOlderPage(pages, null)?.key).toBe('2026');
    expect(nextOlderPage(pages, '2026')?.key).toBe('2025');
    expect(nextOlderPage(pages, '2024')?.key).toBe('');
    expect(nextOlderPage(pages, '')).toBeUndefined();
  });

  it('shows today and later by default (today stays on top for the whole day), then the loaded years, oldest first', () => {
    expect(visibleGroups(groups, today, null).map((g) => g.date)).toEqual(['2026-10-18', '2026-10-25', '2027-01-08']);
    expect(visibleGroups(groups, '2026-10-19', null).map((g) => g.date)).toEqual(['2026-10-25', '2027-01-08']);
    expect(visibleGroups(groups, today, '2025').map((g) => g.date)).toEqual(['2025-01-10', '2025-12-05', '2025-12-12', '2026-09-04', '2026-10-18', '2026-10-25', '2027-01-08']);
    expect(visibleGroups(groups, today, '').map((g) => g.date)).toHaveLength(9);
  });

  it('counts the days of a page in Arabic', () => {
    expect([1, 2, 3, 10, 11].map(daysLabel)).toEqual(['يوم', 'يومين', '3 أيام', '10 أيام', '11 يوم']);
  });
});

describe('iconOf', () => {
  it('has an icon per type and a pin for a part without one', () => {
    expect(iconOf('الدرس')).toBe('📖');
    expect(iconOf('')).toBe('📌');
  });
});
