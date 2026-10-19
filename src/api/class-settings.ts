// Per-class settings the admin can change on the fixed classes: an emoji and the weekday attendance is taken on.
// ONE small document per section, `config/classes-<section>` = { settings: { [grade]: { emoji?, serviceDay? } } } (the `config` rules already
// let every signed-in person read and only admins write). Migration note: the same shape as a `class_settings` table keyed by (section, grade).
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/core/firebase';
import { countReads } from '@/core/firestore-helpers';
import { cleanClassSettings, type ClassSettings } from '@/core/class-settings';

export type { ClassSetting, ClassSettings, ServiceDay } from '@/core/class-settings';

const refOf = (section: string) => doc(db, 'config', `classes-${section}`);

export async function loadClassSettings(section: string): Promise<ClassSettings> {
  const snap = await getDoc(refOf(section));
  countReads('config/classes', 1);
  return snap.exists() ? cleanClassSettings((snap.data() as { settings?: unknown }).settings) : {};
}

export async function saveClassSettings(section: string, settings: ClassSettings): Promise<void> {
  await setDoc(refOf(section), { settings: cleanClassSettings(settings) });
}
