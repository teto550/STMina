import type { Section } from '@/types/access';

/** The classes that have the "نوتة روحية" tab. The trial starts with one class of the boys' section; add a class here to open the tab for it. */
export const SPIRITUAL_NOTES_GRADES: readonly string[] = ['سنة رابعة ابتدائي'];

/** The tab exists for those classes in the boys' section only. */
export function hasSpiritualNotes(grade: string | null | undefined, section: Section): boolean {
  return section === 'boys' && !!grade && SPIRITUAL_NOTES_GRADES.includes(grade);
}
