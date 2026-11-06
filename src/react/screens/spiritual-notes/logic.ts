import type { NoteDay } from '@/api/spiritual-notes';

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];

/** YYYY-MM-DD of a date, in the device's own time (Egypt for the servants). */
export function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parse(day: string): Date {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The last `count` days ending at `from` (today included), newest first. */
export function lastDays(count: number, from: Date): string[] {
  const out: string[] = [];
  for (let back = 0; back < count; back += 1) {
    out.push(dateToStr(new Date(from.getFullYear(), from.getMonth(), from.getDate() - back)));
  }
  return out;
}

/** `day` moved by `n` days (negative = earlier). */
export function addDays(day: string, n: number): string {
  const d = parse(day);
  return dateToStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** The week of the programme runs from Friday to Thursday: this is the Friday on or before `day`. */
export function weekStart(day: string): string {
  return addDays(day, -((parse(day).getDay() - 5 + 7) % 7));
}

/** The 7 days of the week of `day`, Friday first and Thursday last. */
export function weekDays(day: string): string[] {
  const start = weekStart(day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** "الجمعة 30-10" */
export function dayLabel(day: string): string {
  const [, m, d] = day.split('-');
  return `${WEEKDAYS[parse(day).getDay()]} ${d}-${m}`;
}

/** The kids fast on Wednesday and Friday. */
export function isFastDay(day: string): boolean {
  const weekday = parse(day).getDay();
  return weekday === 3 || weekday === 5;
}

/** A name written so that the spelling variants of the same name match (أ إ آ → ا، ى → ي، ة → ه), without diacritics or extra spaces. */
export function normalizeName(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function filterKids<T extends { name: string }>(kids: T[], search: string): T[] {
  const q = normalizeName(search);
  return q ? kids.filter((k) => normalizeName(k.name).includes(q)) : kids;
}

/** Did he read the gospel? (older notes hold the text he wrote: any non-empty text counts) */
export function readGospel(note: NoteDay): boolean {
  return typeof note.gospel === 'string' ? note.gospel.trim() !== '' : note.gospel === true;
}

/** Did the kid do anything that day? */
export function didAnything(note: NoteDay): boolean {
  return !!(note.prayerMorning || note.prayerNight || note.mass || note.fast || readGospel(note));
}

/** The points of each thing (set by the user): prayer 5 + 5, gospel 15, confession 25 (once a month), fasting 10 (Wednesday and Friday), mass 20. */
export const POINTS = { prayerMorning: 5, prayerNight: 5, gospel: 15, confession: 25, fast: 10, mass: 20 } as const;

/** The points of one day: prayers, gospel, mass and fasting (the fasting counts on Wednesday and Friday only). The confession is a month thing, see monthPoints. */
export function dayPoints(note: NoteDay | null | undefined): number {
  if (!note) {
    return 0;
  }
  return (
    (note.prayerMorning ? POINTS.prayerMorning : 0) +
    (note.prayerNight ? POINTS.prayerNight : 0) +
    (readGospel(note) ? POINTS.gospel : 0) +
    (note.mass ? POINTS.mass : 0) +
    (note.fast && isFastDay(note.day) ? POINTS.fast : 0)
  );
}

/** The points of the days of `notes` that fall from `from` to `to` (YYYY-MM-DD, included). */
export function pointsBetween(notes: NoteDay[], from: string, to: string): number {
  return notes.filter((n) => n.day >= from && n.day <= to).reduce((sum, n) => sum + dayPoints(n), 0);
}

/** The points of the week of `day` (Friday to Thursday), from the days written. The confession is not in it (it belongs to the month). */
export function weekPoints(notes: NoteDay[], day: string): number {
  const days = weekDays(day);
  return pointsBetween(notes, days[0] ?? day, days[6] ?? day);
}

/** The points of the month of `day`: every day of the month, plus the confession of that month when he confessed. */
export function monthPoints(notes: NoteDay[], day: string, confessed: boolean): number {
  const month = monthOf(day);
  return pointsBetween(notes, `${month}-01`, `${month}-31`) + (confessed ? POINTS.confession : 0);
}

/** The first and the last day to read so that both the week and the month of `day` are covered (a week can cross two months). */
export function rangeFor(day: string): { from: string; to: string } {
  const week = weekDays(day);
  const month = monthOf(day);
  const from = [week[0] ?? day, `${month}-01`].sort()[0] ?? day;
  const to = [week[6] ?? day, `${month}-31`].sort().at(-1) ?? day;
  return { from, to };
}

/** "الصبح · بليل · القداس · صام" (what was done that day) */
export function summaryOf(note: NoteDay): string {
  const parts: string[] = [];
  if (note.prayerMorning) {
    parts.push('الصبح');
  }
  if (note.prayerNight) {
    parts.push('بليل');
  }
  if (note.mass) {
    parts.push('القداس');
  }
  if (note.fast) {
    parts.push('صام');
  }
  if (readGospel(note)) {
    parts.push('الإنجيل');
  }
  return parts.join(' · ');
}
