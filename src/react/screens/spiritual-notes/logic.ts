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

/** Did the kid do or write anything that day? */
export function didAnything(note: NoteDay): boolean {
  return !!(note.prayerMorning || note.prayerNight || note.mass || note.fast || (note.gospel && note.gospel.trim()));
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
  if (note.gospel && note.gospel.trim()) {
    parts.push('الإنجيل');
  }
  return parts.join(' · ');
}
