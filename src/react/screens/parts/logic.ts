// The rules of the parts screen as pure functions (no Firestore, no React): grouping by day, which day is the next one, how a day reads.
import type { Part } from '@/api/parts';

export const PART_TYPE_ICONS: Record<string, string> = { المقدمة: '🎤', الدرس: '📖', الصلاة: '🙏', الترانيم: '🎵', أخرى: '📌' };
export const iconOf = (type: string): string => PART_TYPE_ICONS[type] ?? '📌';

const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const pad = (n: number): string => String(n).padStart(2, '0');

/** A Date as YYYY-MM-DD in the person's own time. */
export const dateToStr = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The default day of a new part: the coming Friday (today when it is Friday). Any other day can be picked. */
export function nextFridayStr(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  return dateToStr(d);
}

/** "الجمعة 25-9" */
export function formatDateHeader(date: string): string {
  const [y, m, day] = date.split('-').map(Number);
  if (!y || !m || !day) {
    return '';
  }
  return `${WEEKDAYS_AR[new Date(y, m - 1, day).getDay()]} ${day}-${m}`;
}

/** The weekday of a day, for the hint under the date field. */
export function weekdayOf(date: string): string {
  const [y, m, day] = date.split('-').map(Number);
  return y && m && day ? (WEEKDAYS_AR[new Date(y, m - 1, day).getDay()] ?? '') : '';
}

export interface DateGroup {
  /** YYYY-MM-DD, or '' for parts without a day (old data) */
  date: string;
  parts: Part[];
}

/**
 * One group per day, the LATEST day first (parts without a day last); inside a day the order of the given list (newest first) is kept.
 * The next day (see `upcomingDate`) is still the green one wherever it falls in the list.
 */
export function groupByDate(parts: Part[]): DateGroup[] {
  const byDate = new Map<string, Part[]>();
  for (const p of parts) {
    const key = p.date || '';
    byDate.set(key, [...(byDate.get(key) ?? []), p]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : b.localeCompare(a)))
    .map(([date, list]) => ({ date, parts: list }));
}

/** The next day with parts (today or later): the one shown in green, whatever the order of the list. Null when every day has passed. */
export function upcomingDate(groups: DateGroup[], today: string): string | null {
  const days = groups.map((g) => g.date).filter((d) => d !== '' && d >= today).sort();
  return days[0] ?? null;
}
