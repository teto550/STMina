import { dayLabel, didAnything, filterKids, isFastDay, lastDays, monthOf, normalizeName, summaryOf } from '@/react/screens/spiritual-notes/logic';

describe('spiritual notes: the days', () => {
  it('lastDays gives today first and the days before it, across a month change', () => {
    expect(lastDays(3, new Date(2030, 10, 1))).toEqual(['2030-11-01', '2030-10-31', '2030-10-30']);
  });
  it('names the day and the month', () => {
    expect(dayLabel('2030-10-18')).toBe('الجمعة 18-10');
    expect(monthOf('2030-10-18')).toBe('2030-10');
  });
  it('the kids fast on Wednesday and Friday only', () => {
    expect(isFastDay('2030-10-16')).toBe(true); // Wednesday
    expect(isFastDay('2030-10-18')).toBe(true); // Friday
    expect(isFastDay('2030-10-17')).toBe(false); // Thursday
  });
});

describe('spiritual notes: searching a name', () => {
  it('matches the spelling variants of the same name', () => {
    expect(normalizeName('  أنطونيوس ')).toBe(normalizeName('انطونيوس'));
    const kids = [{ name: 'إبراهيم سامح' }, { name: 'مينا' }];
    expect(filterKids(kids, 'ابراهيم')).toEqual([{ name: 'إبراهيم سامح' }]);
    expect(filterKids(kids, '')).toEqual(kids);
    expect(filterKids(kids, 'xyz')).toEqual([]);
  });
});

describe('spiritual notes: what a day says', () => {
  it('a day with nothing ticked or written is not a day done', () => {
    expect(didAnything({ day: '2030-10-18', prayerMorning: false, gospel: '  ' })).toBe(false);
    expect(didAnything({ day: '2030-10-18', mass: true })).toBe(true);
    expect(didAnything({ day: '2030-10-18', gospel: 'لوقا ١٥' })).toBe(true);
  });
  it('lists what was done', () => {
    expect(summaryOf({ day: 'x', prayerMorning: true, prayerNight: true, mass: true, fast: true, gospel: 'لوقا' })).toBe('الصبح · بليل · القداس · صام · الإنجيل');
    expect(summaryOf({ day: 'x', prayerNight: true })).toBe('بليل');
  });
});
