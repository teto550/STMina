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
 * One group per day, the OLDEST day first (parts without a day, old data, before all of them); inside a day the order of the given list
 * (newest first) is kept. Days from today on are the ones shown by default, the rest are older pages (see `olderPages`).
 */
export function groupByDate(parts: Part[]): DateGroup[] {
  const byDate = new Map<string, Part[]>();
  for (const p of parts) {
    const key = p.date || '';
    byDate.set(key, [...(byDate.get(key) ?? []), p]);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date, parts: list }));
}

/** The next day with parts (today or later, so a Friday stays the next day for the whole Friday): the one shown in green. Null when every day has passed. */
export function upcomingDate(groups: DateGroup[], today: string): string | null {
  const days = groups.map((g) => g.date).filter((d) => d !== '' && d >= today).sort();
  return days[0] ?? null;
}

/** The page an older day belongs to: its year ('' for a part without a day). */
export const pageKeyOf = (date: string): string => date.slice(0, 4);

export interface OlderPage {
  /** the year, or '' for the parts without a day */
  key: string;
  /** how many days with parts it holds */
  days: number;
}

/** The days before today, one page per year, the most recent year first (the parts without a day last). Nothing is shown from them until a page is loaded. */
export function olderPages(groups: DateGroup[], today: string): OlderPage[] {
  const days = new Map<string, number>();
  for (const g of groups) {
    if (g.date < today) {
      const key = pageKeyOf(g.date);
      days.set(key, (days.get(key) ?? 0) + 1);
    }
  }
  return [...days.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([key, n]) => ({ key, days: n }));
}

/** The page the "show older" button loads next: the most recent one not shown yet. `shownFrom` = the oldest year loaded so far (null = none). */
export function nextOlderPage(pages: OlderPage[], shownFrom: string | null): OlderPage | undefined {
  return pages.find((p) => shownFrom === null || p.key < shownFrom);
}

/** What the list shows: every day from today on, plus the older years loaded so far (`shownFrom` and every year after it). Oldest first. */
export function visibleGroups(groups: DateGroup[], today: string, shownFrom: string | null): DateGroup[] {
  return groups.filter((g) => g.date >= today || (shownFrom !== null && pageKeyOf(g.date) >= shownFrom));
}

/** "يوم", "يومين", "3 أيام" ... for the button that loads a year. */
export function daysLabel(n: number): string {
  if (n === 1) {
    return 'يوم';
  }
  if (n === 2) {
    return 'يومين';
  }
  return n <= 10 ? `${n} أيام` : `${n} يوم`;
}
