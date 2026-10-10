// Pure helpers for servants' attendance (no Firebase, no DOM): used by the servants directory filter and the dashboard.
// A "day map" is { 'YYYY-MM-DD': { servantName: docId } }, the same shape as DEACON_ATTENDANCE / DEACON_EXCUSES for one type.

export type DayMap = Record<string, Record<string, string>>;
export type AttStatus = 'present' | 'excuse' | 'absent';
export interface Tally { present: number; excuse: number; absent: number }

/**
 * The days that count as a session: any day with a present OR excused record for one of `names`, newest first.
 * (An excuse-only day is still a day the meeting happened.) `limit` keeps only the newest N.
 */
export function sessionDates(att: DayMap, exc: DayMap, names: ReadonlySet<string>, limit?: number): string[] {
  const touches = (m: DayMap, d: string) => Object.keys(m[d] ?? {}).some((n) => names.has(n));
  const dates = [...new Set([...Object.keys(att), ...Object.keys(exc)])]
    .filter((d) => touches(att, d) || touches(exc, d))
    .sort((a, b) => b.localeCompare(a));
  return limit === undefined ? dates : dates.slice(0, limit);
}

/** present, or excused, or absent (= neither present nor excused: same meaning as the "غياب" tab of a day's detail). */
export function statusOn(att: DayMap, exc: DayMap, name: string, date: string): AttStatus {
  if (att[date]?.[name]) return 'present';
  if (exc[date]?.[name]) return 'excuse';
  return 'absent';
}

/** Per servant: how many of `dates` he was present / excused / absent. */
export function tally(att: DayMap, exc: DayMap, names: readonly string[], dates: readonly string[]): Record<string, Tally> {
  const out: Record<string, Tally> = {};
  for (const name of names) {
    const t: Tally = { present: 0, excuse: 0, absent: 0 };
    for (const d of dates) t[statusOn(att, exc, name, d)]++;
    out[name] = t;
  }
  return out;
}
