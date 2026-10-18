// The Coptic Orthodox occasions the church keeps in the `occasions` collection, worked out for ANY year (no web lookups): the fixed feasts
// from the Coptic calendar and the moving ones (Lent, Holy Week, Easter, Ascension, ...) from the date of Easter.
//
//   node tools/firestore/coptic-occasions.mjs 2028                       the list of 2028, as JSON on the screen
//   node tools/firestore/coptic-occasions.mjs 2028 2029 --out my.json    two years into a file
//   node tools/firestore/coptic-occasions.mjs 2026 2027 --from 2026-10-18    only from that day on
// then check the file and import it (dry run first):  node tools/firestore/add-occasions.cjs my.json   (see README.md)
//
// RULES is the list the church chose (2026-10-18, after it reviewed the first import): add or remove a line to change what is generated.
// Egypt, Coptic Orthodox. The dates agree with copticchurch.net and with the church calendar app for 2026 and 2027 (src/core/__tests__/coptic-occasions.test.ts).
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

/** Coptic months: Thout 1, Paopi 2, Hathor 3, Koiak 4, Tobi 5, Meshir 6, Paremhat 7, Paremoude 8, Pashons 9, Paoni 10, Epip 11, Mesori 12. */
const MONTHS_AR = ['توت', 'بابة', 'هاتور', 'كيهك', 'طوبة', 'أمشير', 'برمهات', 'برمودة', 'بشنس', 'بؤونة', 'أبيب', 'مسرى', 'النسيء'];

/**
 * `coptic: [month, day]` = a fixed day of the Coptic calendar; `easter: n` = n days after Easter (negative: before it);
 * `gregorian: [month, day]` = the same Gregorian day every year (Christmas: the church keeps 25 December of the Julian calendar, which is
 * 7 January until 2100, even in the years when 29 Koiak would fall on the 8th).
 */
export const RULES = [
  { title: 'عيد استشهاد القديس مارمينا العجايبي', coptic: [3, 15] },
  { title: 'بدء صوم الميلاد', coptic: [3, 16] },
  { title: 'عيد الميلاد المجيد', gregorian: [1, 7] },
  { title: 'عيد الختان', coptic: [5, 6] },
  { title: 'عيد الغطاس', coptic: [5, 11] },
  { title: 'عرس قانا الجليل', coptic: [5, 13] },
  { title: 'دخول السيد المسيح الهيكل', coptic: [6, 8] },
  { title: 'بدء صوم يونان', easter: -69 },
  { title: 'فصح يونان', easter: -66 },
  { title: 'بدء الصوم الأربعيني المقدس', easter: -55 },
  { title: 'عيد ظهور الصليب المقدس', coptic: [7, 10] },
  { title: 'عيد البشارة المجيد', coptic: [7, 29] },
  { title: 'ختام الصوم الأربعيني', easter: -9 },
  { title: 'سبت لعازر', easter: -8 },
  { title: 'أحد الشعانين', easter: -7 },
  { title: 'خميس العهد', easter: -3 },
  { title: 'الجمعة العظيمة', easter: -2 },
  { title: 'سبت الفرح', easter: -1 },
  { title: 'عيد القيامة المجيد', easter: 0 },
  { title: 'شم النسيم', easter: 1 },
  { title: 'أحد توما', easter: 7 },
  { title: 'عيد دخول السيد المسيح أرض مصر', coptic: [9, 24] },
  { title: 'عيد الصعود المجيد', easter: 39 },
  { title: 'عيد حلول الروح القدس (عيد العنصرة)', easter: 49 },
  { title: 'بدء صوم الرسل', easter: 50 },
  { title: 'عيد استشهاد القديسين بطرس وبولس (عيد الرسل)', coptic: [11, 5] },
  { title: 'بدء صوم السيدة العذراء مريم', coptic: [12, 1] },
  { title: 'عيد التجلي المجيد', coptic: [12, 13] },
  { title: 'عيد إظهار صعود جسد السيدة العذراء', coptic: [12, 16] },
  { title: 'رأس السنة القبطية (عيد النيروز)', coptic: [1, 1] },
  { title: 'تذكار ظهور الصليب المقدس', coptic: [1, 17] },
];

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** A Coptic date as a Gregorian Date (Calendrical Calculations: the Coptic epoch is R.D. 103605, 29 August 284 CE Julian). */
export function copticToGregorian(year, month, day) {
  const rd = 103605 - 1 + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + day;
  const utc = new Date((rd - 719163) * 86_400_000); // R.D. 719163 = 1 January 1970
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** Coptic (= Orthodox) Easter as a Gregorian Date, for 1900-2099: the Julian computus plus the 13 days between the calendars. */
export function orthodoxEaster(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return addDays(new Date(year, month - 1, day), 13);
}

/** The occasions that fall in the Gregorian `year`: [{ title, date: 'YYYY-MM-DD', note }], by date. */
export function occasionsForYear(year, rules = RULES) {
  const easter = orthodoxEaster(year);
  const out = [];
  for (const rule of rules) {
    if (rule.easter !== undefined) {
      const how = rule.easter === 0 ? 'يوم القيامة' : rule.easter < 0 ? `قبل القيامة بـ ${-rule.easter} يوم` : `بعد القيامة بـ ${rule.easter} يوم`;
      out.push({ title: rule.title, date: iso(addDays(easter, rule.easter)), note: `${how} (القيامة ${iso(easter)}) - محسوب` });
      continue;
    }
    if (rule.gregorian) {
      const [m, d] = rule.gregorian;
      out.push({ title: rule.title, date: iso(new Date(year, m - 1, d)), note: `${d}/${m} كل سنة (25 ديسمبر بالتقويم الغريغوري القديم) - محسوب` });
      continue;
    }
    const [month, day] = rule.coptic;
    // the Coptic years that overlap this Gregorian year are year - 285 .. year - 282 (a date may fall in either of two of them)
    for (let c = year - 285; c <= year - 282; c++) {
      const date = copticToGregorian(c, month, day);
      if (date.getFullYear() === year) {
        out.push({ title: rule.title, date: iso(date), note: `${day} ${MONTHS_AR[month - 1]} ${c} - محسوب من التقويم القبطي` });
      }
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || x.title.localeCompare(y.title, 'ar'));
}

/** Several years in one list, optionally only from a day on (YYYY-MM-DD). */
export function occasionsForYears(years, { from = '' } = {}) {
  return years.flatMap((y) => occasionsForYear(y)).filter((o) => o.date >= from);
}

// command line
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const years = args.filter((a, i) => /^\d{4}$/.test(a) && !['--from', '--out'].includes(args[i - 1] ?? '')).map(Number);
  if (years.length === 0) {
    console.error('usage: node tools/firestore/coptic-occasions.mjs <year> [<year> ...] [--from YYYY-MM-DD] [--out file.json]');
    process.exit(1);
  }
  const json = `${JSON.stringify(occasionsForYears(years, { from: flag('--from') ?? '' }), null, 2)}\n`;
  const out = flag('--out');
  if (out) {
    writeFileSync(out, json);
    console.log(`${JSON.parse(json).length} occasions written to ${out}`);
  } else {
    process.stdout.write(json);
  }
}
