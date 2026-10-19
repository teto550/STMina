// The kept copy of the class settings (emoji + attendance weekday) and the rules built on it. No backend here: `features/classes` fills it.

/** 4 = Thursday, 5 = Friday (same numbers as Date.getDay()). */
export type ServiceDay = 4 | 5;

export interface ClassSetting {
  emoji?: string;
  serviceDay?: ServiceDay;
}

export type ClassSettings = Record<string, ClassSetting>;

/** Keeps only what is valid, so a hand-edited document can never break the screens. */
export function cleanClassSettings(raw: unknown): ClassSettings {
  const out: ClassSettings = {};
  if (!raw || typeof raw !== 'object') {
    return out;
  }
  for (const [grade, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = (value || {}) as { emoji?: unknown; serviceDay?: unknown };
    const setting: ClassSetting = {};
    if (typeof v.emoji === 'string' && v.emoji.trim()) {
      setting.emoji = v.emoji.trim().slice(0, 8);
    }
    if (v.serviceDay === 4 || v.serviceDay === 5) {
      setting.serviceDay = v.serviceDay;
    }
    if (setting.emoji || setting.serviceDay) {
      out[grade] = setting;
    }
  }
  return out;
}

export const DEFAULT_CLASS_EMOJI = '📚';

let kept: ClassSettings = {};

export const setKeptClassSettings = (settings: ClassSettings): void => {
  kept = settings;
};

export const getKeptClassSettings = (): ClassSettings => kept;

export const getClassSetting = (grade: string): ClassSetting => kept[grade] || {};

export const classEmoji = (grade: string): string => getClassSetting(grade).emoji || DEFAULT_CLASS_EMOJI;

export const DAY_NAMES: Record<ServiceDay, string> = { 4: 'الخميس', 5: 'الجمعة' };

/** The weekday (0 = Sunday ... 6 = Saturday) of a YYYY-MM-DD key. */
export const weekdayOf = (dateKey: string): number => new Date(`${dateKey}T12:00:00Z`).getUTCDay();

/**
 * May attendance be taken for this class on this day? Yes when the class has no day set (nothing was ever restricted),
 * otherwise only on its day.
 */
export function canTakeAttendanceOn(grade: string, dateKey: string): boolean {
  const day = getClassSetting(grade).serviceDay;
  return !day || weekdayOf(dateKey) === day;
}
