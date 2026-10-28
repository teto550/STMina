// "بيانات خاطئة": a servant marks which fields of a student's file are wrong (🚩 in the student file); the student then shows
// in dark red in the attendance tab, and tapping the name opens only those fields to correct. The marks live in the
// student's document as `badFields: string[]` (the keys below).

export type BadFieldKey = 'name' | 'dob' | 'address' | 'father' | 'mother' | 'student' | 'confessor';

export interface BadField {
  key: BadFieldKey;
  label: string;
  icon: string;
  /** the property of the student document that holds the value */
  prop: 'name' | 'dob' | 'address' | 'phoneDad' | 'phoneMom' | 'phoneStudent' | 'confessor';
}

export const BAD_FIELDS: BadField[] = [
  { key: 'name', label: 'الاسم', icon: '👤', prop: 'name' },
  { key: 'dob', label: 'تاريخ الميلاد', icon: '🎂', prop: 'dob' },
  { key: 'address', label: 'العنوان', icon: '📍', prop: 'address' },
  { key: 'father', label: 'تليفون الأب', icon: '📞', prop: 'phoneDad' },
  { key: 'mother', label: 'تليفون الأم', icon: '📞', prop: 'phoneMom' },
  { key: 'student', label: 'تليفون المخدوم', icon: '📱', prop: 'phoneStudent' },
  { key: 'confessor', label: 'أب الاعتراف', icon: '✝️', prop: 'confessor' },
];

type StudentLike = { badFields?: unknown } & Partial<Record<BadField['prop'], unknown>>;

const fieldOf = (key: string): BadField | undefined => BAD_FIELDS.find((f) => f.key === key);

/** The valid wrong-field keys of a student, in the order of BAD_FIELDS. */
export function badKeysOf(s: StudentLike | null | undefined): BadFieldKey[] {
  const raw = s && Array.isArray(s.badFields) ? (s.badFields as unknown[]) : [];
  return BAD_FIELDS.filter((f) => raw.includes(f.key)).map((f) => f.key);
}

export function badLabelsOf(s: StudentLike | null | undefined): string[] {
  return badKeysOf(s).map((k) => fieldOf(k)?.label ?? k);
}

export function badValueOf(s: StudentLike, key: BadFieldKey): string {
  const f = fieldOf(key);
  const v = f ? s[f.prop] : '';
  return typeof v === 'string' ? v : '';
}

export const hasBadData = (s: StudentLike | null | undefined): boolean => badKeysOf(s).length > 0;
