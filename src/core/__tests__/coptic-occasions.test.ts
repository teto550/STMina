// The generator of the occasions list (tools/firestore/coptic-occasions.mjs) against what the church itself publishes, so a later year can be
// generated without checking every date again.
import { RULES, copticToGregorian, occasionsForYear, occasionsForYears, orthodoxEaster } from '../../../tools/firestore/coptic-occasions.mjs';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const byTitle = (year: number) => new Map(occasionsForYear(year).map((o) => [o.title, o.date]));

describe('Easter', () => {
  it('is the Orthodox Easter of every year (a known list)', () => {
    const known: Record<number, string> = { 2024: '2024-05-05', 2025: '2025-04-20', 2026: '2026-04-12', 2027: '2027-05-02', 2028: '2028-04-16', 2029: '2029-04-08', 2030: '2030-04-28' };
    for (const [year, date] of Object.entries(known)) {
      expect(iso(orthodoxEaster(Number(year)))).toBe(date);
    }
  });
});

describe('the Coptic calendar', () => {
  it('Nayrouz (1 Thout) is 11 September, and 12 September in the year before a Gregorian leap year', () => {
    for (let year = 2024; year <= 2060; year++) {
      const copticYear = year - 283; // the Coptic year that starts in this Gregorian year
      const leapNext = (year + 1) % 4 === 0;
      expect(iso(copticToGregorian(copticYear, 1, 1))).toBe(`${year}-09-${leapNext ? '12' : '11'}`);
    }
  });
});

// what copticchurch.net publishes (2024, 2026, 2027, 2028) and the church calendar app (2027), by the names this app uses
const PUBLISHED: Record<number, Record<string, string>> = {
  2024: { 'عيد الميلاد المجيد': '01-07', 'عيد الغطاس': '01-20', 'عيد الختان': '01-15', 'عرس قانا الجليل': '01-22', 'دخول السيد المسيح الهيكل': '02-16', 'بدء صوم يونان': '02-26', 'بدء الصوم الأربعيني المقدس': '03-11', 'عيد البشارة المجيد': '04-07', 'أحد الشعانين': '04-28', 'خميس العهد': '05-02', 'الجمعة العظيمة': '05-03', 'عيد القيامة المجيد': '05-05', 'عيد الصعود المجيد': '06-13', 'عيد حلول الروح القدس (عيد العنصرة)': '06-23', 'عيد استشهاد القديسين بطرس وبولس (عيد الرسل)': '07-12', 'بدء صوم السيدة العذراء مريم': '08-07', 'عيد التجلي المجيد': '08-19', 'عيد إظهار صعود جسد السيدة العذراء': '08-22', 'بدء صوم الميلاد': '11-25', 'أحد توما': '05-12', 'عيد دخول السيد المسيح أرض مصر': '06-01' },
  2026: { 'عيد الميلاد المجيد': '01-07', 'عيد الغطاس': '01-19', 'بدء صوم يونان': '02-02', 'بدء الصوم الأربعيني المقدس': '02-16', 'أحد الشعانين': '04-05', 'عيد القيامة المجيد': '04-12', 'عيد الصعود المجيد': '05-21', 'عيد حلول الروح القدس (عيد العنصرة)': '05-31', 'بدء صوم الميلاد': '11-25', 'أحد توما': '04-19' },
  2027: { 'عيد الميلاد المجيد': '01-07', 'عيد الغطاس': '01-19', 'عيد الختان': '01-14', 'عرس قانا الجليل': '01-21', 'دخول السيد المسيح الهيكل': '02-15', 'بدء صوم يونان': '02-22', 'فصح يونان': '02-25', 'بدء الصوم الأربعيني المقدس': '03-08', 'عيد ظهور الصليب المقدس': '03-19', 'عيد البشارة المجيد': '04-07', 'ختام الصوم الأربعيني': '04-23', 'سبت لعازر': '04-24', 'أحد الشعانين': '04-25', 'خميس العهد': '04-29', 'الجمعة العظيمة': '04-30', 'سبت الفرح': '05-01', 'عيد القيامة المجيد': '05-02', 'شم النسيم': '05-03', 'أحد توما': '05-09', 'عيد دخول السيد المسيح أرض مصر': '06-01', 'عيد الصعود المجيد': '06-10', 'عيد حلول الروح القدس (عيد العنصرة)': '06-20', 'بدء صوم الرسل': '06-21', 'عيد استشهاد القديسين بطرس وبولس (عيد الرسل)': '07-12', 'بدء صوم السيدة العذراء مريم': '08-07', 'عيد التجلي المجيد': '08-19', 'عيد إظهار صعود جسد السيدة العذراء': '08-22', 'رأس السنة القبطية (عيد النيروز)': '09-12', 'تذكار ظهور الصليب المقدس': '09-28', 'بدء صوم الميلاد': '11-26' },
  2028: { 'عيد الميلاد المجيد': '01-07', 'عيد الغطاس': '01-20', 'عيد الختان': '01-15', 'عرس قانا الجليل': '01-22', 'دخول السيد المسيح الهيكل': '02-16', 'بدء صوم يونان': '02-07', 'بدء الصوم الأربعيني المقدس': '02-21', 'عيد البشارة المجيد': '04-07', 'أحد الشعانين': '04-09', 'خميس العهد': '04-13', 'الجمعة العظيمة': '04-14', 'عيد القيامة المجيد': '04-16', 'أحد توما': '04-23', 'عيد الصعود المجيد': '05-25', 'عيد حلول الروح القدس (عيد العنصرة)': '06-04', 'عيد دخول السيد المسيح أرض مصر': '06-01', 'عيد استشهاد القديسين بطرس وبولس (عيد الرسل)': '07-12', 'عيد التجلي المجيد': '08-19', 'بدء صوم السيدة العذراء مريم': '08-07', 'عيد إظهار صعود جسد السيدة العذراء': '08-22', 'بدء صوم الميلاد': '11-25' },
};

describe('generated dates agree with what the church publishes', () => {
  for (const [year, expected] of Object.entries(PUBLISHED)) {
    it(`${year}`, () => {
      const got = byTitle(Number(year));
      for (const [title, monthDay] of Object.entries(expected)) {
        expect({ title, date: got.get(title) }).toEqual({ title, date: `${year}-${monthDay}` });
      }
    });
  }
});

describe('the list of a year', () => {
  it('has every kept occasion once, in date order', () => {
    const list = occasionsForYear(2029);
    expect(list).toHaveLength(RULES.length);
    expect(new Set(list.map((o) => o.title)).size).toBe(RULES.length);
    expect(list.map((o) => o.date)).toEqual([...list.map((o) => o.date)].sort());
    expect(list.every((o) => o.date.startsWith('2029-') && o.note.length > 0)).toBe(true);
  });

  it('Christmas is 7 January every year, even when 29 Koiak would be the 8th', () => {
    for (let year = 2024; year <= 2060; year++) {
      expect(byTitle(year).get('عيد الميلاد المجيد')).toBe(`${year}-01-07`);
    }
  });

  it('St Mina (15 Hatour) is the day before the Nativity Fast starts (16 Hatour)', () => {
    for (let year = 2026; year <= 2040; year++) {
      const mina = new Date(`${byTitle(year).get('عيد استشهاد القديس مارمينا العجايبي')}T00:00:00`);
      const fast = new Date(`${byTitle(year).get('بدء صوم الميلاد')}T00:00:00`);
      expect((fast.getTime() - mina.getTime()) / 86_400_000).toBe(1);
    }
  });

  it('the days around Easter follow it (Holy Week, Ascension on a Thursday, Pentecost on a Sunday)', () => {
    for (let year = 2026; year <= 2040; year++) {
      const g = byTitle(year);
      const day = (title: string) => new Date(`${g.get(title)}T00:00:00`).getDay();
      expect(day('عيد القيامة المجيد')).toBe(0);
      expect(day('أحد الشعانين')).toBe(0);
      expect(day('خميس العهد')).toBe(4);
      expect(day('الجمعة العظيمة')).toBe(5);
      expect(day('عيد الصعود المجيد')).toBe(4);
      expect(day('عيد حلول الروح القدس (عيد العنصرة)')).toBe(0);
      expect(day('بدء الصوم الأربعيني المقدس')).toBe(1);
      expect(day('بدء صوم يونان')).toBe(1);
    }
  });

  it('several years in one list, optionally from a day on', () => {
    const all = occasionsForYears([2026, 2027], { from: '2026-10-18' });
    expect(all[0]!.date >= '2026-10-18').toBe(true);
    expect(all.length).toBe(33);
    expect(all.some((o) => o.date.startsWith('2028'))).toBe(false);
  });
});
