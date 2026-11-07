// The points of the النوتة الروحية: how many points each thing a kid does is worth. The admin sets them (config/notes-points, see api/spiritual-notes.ts);
// until he does, the defaults below count. No backend here, so it can be tested and shared by every screen.

/** The things that earn points, in the order they are shown. */
export type NotePoints = {
  prayerMorning: number;
  prayerNight: number;
  gospel: number;
  mass: number;
  /** Wednesday and Friday only */
  fast: number;
  /** once a month */
  confession: number;
};

export type NotePointKey = keyof NotePoints;

/** What each thing is called, and a short hint for the admin, in the order of the settings sheet. */
export const NOTE_POINT_ITEMS: readonly { key: NotePointKey; label: string; hint?: string }[] = [
  { key: 'prayerMorning', label: 'صلاة الصبح' },
  { key: 'prayerNight', label: 'صلاة بليل' },
  { key: 'gospel', label: 'الإنجيل (قرأ)' },
  { key: 'mass', label: 'القداس' },
  { key: 'fast', label: 'الصوم', hint: 'الأربع والجمعة بس' },
  { key: 'confession', label: 'الاعتراف', hint: 'مرة في الشهر' },
];

/** The points the programme started with: prayer 5 + 5, gospel 15, mass 20, fasting 10 (Wednesday and Friday), confession 25 (once a month). */
export const DEFAULT_POINTS: NotePoints = { prayerMorning: 5, prayerNight: 5, gospel: 15, mass: 20, fast: 10, confession: 25 };

/** The most one thing can be worth (a typo like 5000 is refused). */
export const MAX_NOTE_POINT = 1000;

export function isValidPoint(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_NOTE_POINT;
}

/** Keeps only what is valid, so a hand-edited document can never break the screens: a missing or wrong value falls back to its default. */
export function cleanPoints(raw: unknown): NotePoints {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_POINTS };
  for (const item of NOTE_POINT_ITEMS) {
    const value = source[item.key];
    if (isValidPoint(value)) {
      out[item.key] = value;
    }
  }
  return out;
}
