import type { NoteDay } from '@/api/spiritual-notes';
import { DEFAULT_POINTS, type NotePoints } from '@/core/notes-points';

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

/** Did the kid do anything that day (or get a star)? */
export function didAnything(note: NoteDay): boolean {
  return !!(note.prayerMorning || note.prayerNight || note.mass || note.fast || readGospel(note) || (note.stars ?? 0) > 0);
}

/** The stars of the kid's card: six, and the servant gives them in halves. */
export const MAX_STARS = 6;
export const STAR_STEP = 0.5;

/** A number of stars made a whole or a half number between 0 and the six of the card (anything else, a missing value too, becomes the nearest of those). */
export function clampStars(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.min(MAX_STARS, Math.max(0, Math.round(n / STAR_STEP) * STAR_STEP));
}

/** The stars given on the days of `notes` that fall from `from` to `to` (YYYY-MM-DD, included), added up (not capped: see monthStars). */
export function starsBetween(notes: NoteDay[], from: string, to: string): number {
  return notes.filter((n) => n.day >= from && n.day <= to).reduce((sum, n) => sum + clampStars(n.stars), 0);
}

/** The stars of the kid in the last 4 weeks (the same "month" as the points), at most the six of the card. The cheer show lights this many. */
export function monthStars(notes: NoteDay[], day: string): number {
  const { from, to } = monthRange(day);
  return clampStars(starsBetween(notes, from, to));
}

/** "1" / "1.5" written in Arabic digits (١ / ١٫٥). */
export const starsText = (stars: number): string => stars.toLocaleString('ar-EG');

/** The points each thing started with (the admin can change them: see `useNotePoints`; every function below takes the ones to use and falls back to these). */
export const POINTS = DEFAULT_POINTS;

/** The points of one day: prayers, gospel, mass and fasting (the fasting counts on Wednesday and Friday only). The confession is a month thing, see monthPoints. */
export function dayPoints(note: NoteDay | null | undefined, points: NotePoints = DEFAULT_POINTS): number {
  if (!note) {
    return 0;
  }
  return (
    (note.prayerMorning ? points.prayerMorning : 0) +
    (note.prayerNight ? points.prayerNight : 0) +
    (readGospel(note) ? points.gospel : 0) +
    (note.mass ? points.mass : 0) +
    (note.fast && isFastDay(note.day) ? points.fast : 0)
  );
}

/** The points of the days of `notes` that fall from `from` to `to` (YYYY-MM-DD, included). */
export function pointsBetween(notes: NoteDay[], from: string, to: string, points: NotePoints = DEFAULT_POINTS): number {
  return notes.filter((n) => n.day >= from && n.day <= to).reduce((sum, n) => sum + dayPoints(n, points), 0);
}

/** The points of the week of `day` (Friday to Thursday), from the days written. The confession is not in it (it belongs to the month). */
export function weekPoints(notes: NoteDay[], day: string, points: NotePoints = DEFAULT_POINTS): number {
  const days = weekDays(day);
  return pointsBetween(notes, days[0] ?? day, days[6] ?? day, points);
}

/** The "month" of the programme is the last 4 weeks (Friday to Thursday), ending with the week of `day`. */
export const MONTH_WEEKS = 4;

/** The first (a Friday) and the last (a Thursday) day of the last {@link MONTH_WEEKS} weeks, the week of `day` included. */
export function monthRange(day: string): { from: string; to: string } {
  const start = weekStart(day);
  return { from: addDays(start, -7 * (MONTH_WEEKS - 1)), to: addDays(start, 6) };
}

/** The points of the month of `day`: the days of the last 4 weeks (Friday to Thursday), plus the confession of the calendar month of `day` when he confessed. */
export function monthPoints(notes: NoteDay[], day: string, confessed: boolean, points: NotePoints = DEFAULT_POINTS): number {
  const { from, to } = monthRange(day);
  return pointsBetween(notes, from, to, points) + (confessed ? points.confession : 0);
}

/** The first and the last day to read so that both the week and the month of `day` are covered (the month contains the week, at most 28 days). */
export function rangeFor(day: string): { from: string; to: string } {
  return monthRange(day);
}

export type RankedKid = { id: string; name: string; rank: number; month: number; week: number };

/**
 * The kids that have points in the last 4 weeks, from the first place to the last. Kids with the same score share the same place
 * (1, 1, 3: the next place skips as many as shared), and are listed by name inside a place. Kids with no points are left out.
 */
export function rankKids(kids: { id: string; name: string }[], data: Record<string, { days: NoteDay[]; confessed: boolean }>, today: string, points: NotePoints = DEFAULT_POINTS): RankedKid[] {
  const scored = kids
    .map((k) => {
      const d = data[k.id];
      return { id: k.id, name: k.name, month: d ? monthPoints(d.days, today, d.confessed, points) : 0, week: d ? weekPoints(d.days, today, points) : 0 };
    })
    .filter((k) => k.month > 0)
    .sort((a, b) => b.month - a.month || a.name.localeCompare(b.name, 'ar'));
  let place = 0;
  let previous: number | null = null;
  return scored.map((k, i) => {
    if (k.month !== previous) {
      place = i + 1;
      previous = k.month;
    }
    return { ...k, rank: place };
  });
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
  if ((note.stars ?? 0) > 0) {
    parts.push(`⭐ ${starsText(clampStars(note.stars))}`);
  }
  return parts.join(' · ');
}
