import { dayPoints, monthPoints, pointsBetween, rangeFor, readGospel, weekPoints, addDays, weekDays, weekStart, dayLabel, didAnything, filterKids, isFastDay, lastDays, monthOf, normalizeName, summaryOf } from '@/react/screens/spiritual-notes/logic';

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
    expect(readGospel({ day: 'x', gospel: false })).toBe(false);
    expect(didAnything({ day: '2030-10-18', mass: true })).toBe(true);
    expect(didAnything({ day: '2030-10-18', gospel: 'لوقا ١٥' })).toBe(true); // an old note with the text
    expect(didAnything({ day: '2030-10-18', gospel: true })).toBe(true);
  });
  it('lists what was done', () => {
    expect(summaryOf({ day: 'x', prayerMorning: true, prayerNight: true, mass: true, fast: true, gospel: 'لوقا' })).toBe('الصبح · بليل · القداس · صام · الإنجيل');
    expect(summaryOf({ day: 'x', prayerNight: true })).toBe('بليل');
  });
});

describe('spiritual notes: the points', () => {
  it('a day adds prayers 5+5, gospel 15, mass 20 and fasting 10 (fasting only on Wednesday and Friday)', () => {
    expect(dayPoints({ day: '2030-10-18', prayerMorning: true, prayerNight: true, gospel: true, mass: true, fast: true })).toBe(55); // Friday
    expect(dayPoints({ day: '2030-10-17', prayerMorning: true, fast: true })).toBe(5); // Thursday: no fasting points
    expect(dayPoints({ day: '2030-10-16', fast: true })).toBe(10); // Wednesday
    expect(dayPoints({ day: '2030-10-18', gospel: 'لوقا' })).toBe(15); // an old note with text
    expect(dayPoints(null)).toBe(0);
  });
  it('the week runs Friday to Thursday', () => {
    const notes = [
      { day: '2030-10-17', mass: true }, // the week before
      { day: '2030-10-18', mass: true },
      { day: '2030-10-24', prayerNight: true },
      { day: '2030-10-25', mass: true }, // the week after
    ];
    expect(weekPoints(notes, '2030-10-20')).toBe(25);
    expect(pointsBetween(notes, '2030-10-01', '2030-10-31')).toBe(65);
  });
  it('the month adds the confession (25) once', () => {
    const notes = [{ day: '2030-10-18', mass: true }, { day: '2030-11-01', mass: true }];
    expect(monthPoints(notes, '2030-10-20', false)).toBe(20);
    expect(monthPoints(notes, '2030-10-20', true)).toBe(45);
  });
  it('reads one range that covers both the week and the month, even when the week crosses months', () => {
    expect(rangeFor('2030-10-18')).toEqual({ from: '2030-10-01', to: '2030-10-31' });
    expect(rangeFor('2030-10-30')).toEqual({ from: '2030-10-01', to: '2030-10-31' }); // week 25-10 .. 31-10
    expect(rangeFor('2030-11-03')).toEqual({ from: '2030-11-01', to: '2030-11-31' });
    expect(rangeFor('2030-11-30')).toEqual({ from: '2030-11-01', to: '2030-12-05' }); // week 29-11 .. 05-12
  });
});
