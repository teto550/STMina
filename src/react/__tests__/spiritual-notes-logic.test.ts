import { addDays, weekDays, weekStart, dayLabel, didAnything, filterKids, isFastDay, lastDays, monthOf, normalizeName, summaryOf } from '@/react/screens/spiritual-notes/logic';

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

describe('spiritual notes: the week runs from Friday to Thursday', () => {
  it('the week starts on the Friday on or before the day', () => {
    expect(weekStart('2030-10-18')).toBe('2030-10-18'); // Friday
    expect(weekStart('2030-10-20')).toBe('2030-10-18'); // Sunday
    expect(weekStart('2030-10-24')).toBe('2030-10-18'); // Thursday: the last day of that week
    expect(weekStart('2030-10-17')).toBe('2030-10-11'); // the Thursday before belongs to the week before
  });
  it('has 7 days, Friday first and Thursday last, across a month change', () => {
    expect(weekDays('2030-10-30')).toEqual(['2030-10-25', '2030-10-26', '2030-10-27', '2030-10-28', '2030-10-29', '2030-10-30', '2030-10-31']);
    expect(weekDays('2030-11-01')).toEqual(['2030-11-01', '2030-11-02', '2030-11-03', '2030-11-04', '2030-11-05', '2030-11-06', '2030-11-07']);
    expect(addDays('2030-11-01', -1)).toBe('2030-10-31');
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
