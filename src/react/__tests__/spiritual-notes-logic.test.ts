import { dayPoints, monthPoints, monthRange, pointsBetween, rangeFor, readGospel, weekPoints, addDays, weekDays, weekStart, dayLabel, didAnything, filterKids, isFastDay, lastDays, monthOf, normalizeName, rankKids, summaryOf, clampStars, monthStars, weekStarsOf, starsText } from '@/react/screens/spiritual-notes/logic';

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
  it('the month is the last 4 weeks (Friday to Thursday) and adds the confession (25) once', () => {
    const notes = [
      { day: '2030-09-26', mass: true }, // Thursday before the 4 weeks: out
      { day: '2030-09-27', mass: true }, // first Friday of the 4 weeks: in
      { day: '2030-10-18', mass: true }, // the open week
      { day: '2030-10-24', mass: true }, // last Thursday of the open week: in
      { day: '2030-10-25', mass: true }, // the next week: out
    ];
    expect(monthPoints(notes, '2030-10-20', false)).toBe(60);
    expect(monthPoints(notes, '2030-10-20', true)).toBe(85);
  });
  it('with one week written, the month equals the week (no confession)', () => {
    const notes = [{ day: '2030-10-18', mass: true }, { day: '2030-10-20', prayerNight: true }];
    expect(monthPoints(notes, '2030-10-20', false)).toBe(weekPoints(notes, '2030-10-20'));
  });
  it('the month range is 4 whole weeks ending on the Thursday of the open week, even across months and years', () => {
    expect(monthRange('2030-10-18')).toEqual({ from: '2030-09-27', to: '2030-10-24' });
    expect(monthRange('2030-10-30')).toEqual({ from: '2030-10-04', to: '2030-10-31' });
    expect(monthRange('2031-01-03')).toEqual({ from: '2030-12-13', to: '2031-01-09' });
  });
  it('reads one range that covers both the week and the month', () => {
    expect(rangeFor('2030-10-18')).toEqual({ from: '2030-09-27', to: '2030-10-24' });
    expect(rangeFor('2030-10-24')).toEqual({ from: '2030-09-27', to: '2030-10-24' }); // Thursday: same week as Friday 18
  });
});

describe('spiritual notes: the ranking', () => {
  const kids = [{ id: 'a', name: 'مينا' }, { id: 'b', name: 'أنطونيوس' }, { id: 'c', name: 'بيشوي' }, { id: 'd', name: 'كيرلس' }, { id: 'e', name: 'يوسف' }];
  const data = {
    a: { days: [{ day: '2030-10-18', mass: true }], confessed: false }, // 20
    b: { days: [{ day: '2030-10-18', mass: true }], confessed: false }, // 20: same place as a
    c: { days: [{ day: '2030-10-04', mass: true }, { day: '2030-10-20', mass: true }], confessed: false }, // 40
    d: { days: [{ day: '2030-09-26', mass: true }], confessed: false }, // before the 4 weeks: no points
    // e has nothing written at all
  };
  it('lists the kids with points from the first place, and kids with the same score share the place (1, 2, 2, 4)', () => {
    const out = rankKids([...kids, { id: 'f', name: 'جرجس' }], { ...data, f: { days: [{ day: '2030-10-18', prayerNight: true }], confessed: false } }, '2030-10-20');
    expect(out.map((k) => [k.name, k.rank, k.month])).toEqual([['بيشوي', 1, 40], ['أنطونيوس', 2, 20], ['مينا', 2, 20], ['جرجس', 4, 5]]);
  });
  it('leaves out kids with no points, and counts the confession in the points', () => {
    const out = rankKids(kids, { ...data, e: { days: [], confessed: true } }, '2030-10-20');
    expect(out.find((k) => k.name === 'يوسف')).toMatchObject({ month: 25, week: 0 });
    expect(out.find((k) => k.name === 'كيرلس')).toBeUndefined();
  });
  it('says nothing for an empty class', () => {
    expect(rankKids([], {}, '2030-10-20')).toEqual([]);
  });
});

describe('custom points (set by the admin)', () => {
  const custom = { prayerMorning: 1, prayerNight: 2, gospel: 3, mass: 4, fast: 5, confession: 6 };
  // Friday 18 October 2030: a fasting day
  const all = { day: '2030-10-18', prayerMorning: true, prayerNight: true, gospel: true, mass: true, fast: true };

  it('dayPoints counts each thing with the points it is given, and with the starting ones when none are given', () => {
    expect(dayPoints(all)).toBe(5 + 5 + 15 + 20 + 10);
    expect(dayPoints(all, custom)).toBe(1 + 2 + 3 + 4 + 5);
  });

  it('the week, the month (with the confession) and the ranking use them too', () => {
    expect(weekPoints([all], '2030-10-18', custom)).toBe(15);
    expect(monthPoints([all], '2030-10-18', true, custom)).toBe(15 + 6);
    const ranked = rankKids([{ id: 'a', name: 'أ' }], { a: { days: [all], confessed: true } }, '2030-10-18', custom);
    expect(ranked[0]?.month).toBe(21);
  });

  it('a thing worth 0 earns nothing, and a kid with only that thing is left out of the ranking', () => {
    const zero = { ...custom, mass: 0 };
    expect(dayPoints({ day: '2030-10-18', mass: true }, zero)).toBe(0);
    expect(rankKids([{ id: 'a', name: 'أ' }], { a: { days: [{ day: '2030-10-18', mass: true }], confessed: false } }, '2030-10-18', zero)).toEqual([]);
  });
});


describe('spiritual notes: the stars the servant gives for a week', () => {
  // Friday 18/10/2030: the last 4 weeks start on Friday 27/9 and end on Thursday 24/10
  const weeks = [
    { week: '2030-10-18', stars: 2 },
    { week: '2030-10-04', stars: 1.5 },
    { week: '2030-09-27', stars: 3 },
    { week: '2030-09-20', stars: 5 }, // the week before the 4 weeks: not counted
  ];

  it('clampStars keeps whole and half stars between 0 and six', () => {
    expect(clampStars(1.5)).toBe(1.5);
    expect(clampStars(0.7)).toBe(0.5);
    expect(clampStars(9)).toBe(6);
    expect(clampStars(-2)).toBe(0);
    expect(clampStars(undefined)).toBe(0);
    expect(clampStars('3')).toBe(0);
    expect(clampStars(NaN)).toBe(0);
  });

  it('weekStarsOf gives the stars of the week the day is in (Friday to Thursday), 0 when none', () => {
    expect(weekStarsOf(weeks, '2030-10-18')).toBe(2); // the Friday itself
    expect(weekStarsOf(weeks, '2030-10-24')).toBe(2); // the Thursday of the same week
    expect(weekStarsOf(weeks, '2030-10-12')).toBe(0); // the week of 11/10 has none
    expect(weekStarsOf([], '2030-10-18')).toBe(0);
  });

  it('monthStars adds up the 4 weeks and never goes over the six of the card', () => {
    expect(monthStars(weeks, '2030-10-18')).toBe(6); // 2 + 1.5 + 3 = 6.5, the card has six
    expect(monthStars(weeks.slice(0, 2), '2030-10-18')).toBe(3.5);
    expect(monthStars([], '2030-10-18')).toBe(0);
  });

  it('stars are not points and do not make a day "written"', () => {
    expect(dayPoints({ day: '2030-10-18' })).toBe(0);
    expect(didAnything({ day: '2030-10-18' })).toBe(false);
  });

  it('starsText writes halves in Arabic digits', () => {
    expect(starsText(2.5)).toBe('٢٫٥');
    expect(starsText(6)).toBe('٦');
  });
});
