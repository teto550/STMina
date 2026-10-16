import { sessionDates, statusOn, tally } from '@/features/servants/attendance-stats';

const att = {
  '2026-10-03': { مينا: 'a1', بولا: 'a2' },
  '2026-09-26': { مينا: 'a3' },
  '2026-09-19': { مينا: 'a4', بولا: 'a5', ماركو: 'a6' },
};
const exc = {
  '2026-09-26': { بولا: 'e1' },
  '2026-09-12': { ماركو: 'e2' }, // excuse-only day: the meeting still happened
};
const names = new Set(['مينا', 'بولا', 'ماركو']);

describe('servants attendance stats', () => {
  it('lists session days newest first, counting excuse-only days', () => {
    expect(sessionDates(att, exc, names)).toEqual(['2026-10-03', '2026-09-26', '2026-09-19', '2026-09-12']);
  });
  it('keeps only the newest N days', () => {
    expect(sessionDates(att, exc, names, 2)).toEqual(['2026-10-03', '2026-09-26']);
  });
  it('ignores days that only involve servants outside the given names', () => {
    expect(sessionDates(att, exc, new Set(['ماركو']))).toEqual(['2026-09-19', '2026-09-12']);
  });
  it('status: present, excused, or absent (neither)', () => {
    expect(statusOn(att, exc, 'مينا', '2026-10-03')).toBe('present');
    expect(statusOn(att, exc, 'بولا', '2026-09-26')).toBe('excuse');
    expect(statusOn(att, exc, 'ماركو', '2026-10-03')).toBe('absent');
    expect(statusOn(att, exc, 'مينا', '2020-01-01')).toBe('absent');
  });
  it('tallies present / excused / absent per servant over the given days', () => {
    const dates = sessionDates(att, exc, names);
    expect(tally(att, exc, ['مينا', 'بولا', 'ماركو'], dates)).toEqual({
      مينا: { present: 3, excuse: 0, absent: 1 },
      بولا: { present: 2, excuse: 1, absent: 1 },
      ماركو: { present: 1, excuse: 1, absent: 2 },
    });
  });
  it('"present in each of the last 3" and "absent in each of the last 3" are decided day by day', () => {
    const last3 = sessionDates(att, exc, names, 3);
    const every = (n: string, s: string) => last3.every((d) => statusOn(att, exc, n, d) === s);
    expect(every('مينا', 'present')).toBe(true);
    expect(every('بولا', 'present')).toBe(false); // excused on 09-26
    expect(every('بولا', 'absent')).toBe(false);
    expect(every('ماركو', 'absent')).toBe(false); // present on 09-19
  });
});
