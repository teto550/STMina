// The rules of the occasions list as pure functions (no Firestore, no React).
import type { Occasion } from '@/api/occasions';

export interface Split {
  /** today or later, nearest first */
  upcoming: Occasion[];
  /** before today, the most recent first */
  past: Occasion[];
}

const byDate = (a: Occasion, b: Occasion) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'ar');

export function splitOccasions(items: Occasion[], today: string): Split {
  const sorted = [...items].sort(byDate);
  return { upcoming: sorted.filter((o) => o.date >= today), past: sorted.filter((o) => o.date < today).reverse() };
}

const dayNumber = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000);
};

/** Whole days from `today` to `date` (negative when it has passed). */
export const daysUntil = (date: string, today: string): number => dayNumber(date) - dayNumber(today);

const daysWord = (n: number): string => {
  if (n === 1) {
    return 'يوم';
  }
  if (n === 2) {
    return 'يومين';
  }
  return n <= 10 ? `${n} أيام` : `${n} يوم`;
};

/** "النهاردة", "بكرة", "بعد 12 يوم", "من 3 أيام"... */
export function countdownLabel(days: number): string {
  if (days === 0) {
    return 'النهاردة';
  }
  if (days === 1) {
    return 'بكرة';
  }
  if (days === -1) {
    return 'امبارح';
  }
  return days > 0 ? `بعد ${daysWord(days)}` : `من ${daysWord(-days)}`;
}

export interface NextOccasion {
  occasion: Occasion;
  /** how many OTHER occasions fall on the same day */
  alsoThatDay: number;
}

/** The next occasion (today or later); with several on that day, the first by name. Null when none is left in the list. */
export function nextOccasion(items: Occasion[], today: string): NextOccasion | null {
  const [first] = splitOccasions(items, today).upcoming;
  if (!first) {
    return null;
  }
  return { occasion: first, alsoThatDay: items.filter((o) => o.date === first.date).length - 1 };
}
