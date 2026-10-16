// The person's own preferences (Settings > الإعدادات): saved on their account (`users/{uid}.preferences`), and copied in this browser so
// they also apply offline. They come with the account document that sign-in reads anyway, so they cost no extra read.
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/core/firebase';

export interface Preferences {
  /** show the crop screen after a photo is picked from the camera or the gallery */
  cropPhotos: boolean;
  /** after marking someone present, go back to the (emptied) search box, focused: for taking attendance by searching a name */
  focusSearchAfterMark: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { cropPhotos: false, focusSearchAfterMark: true };

const localKey = (uid: string) => `preferences_${uid}`;

const normalize = (value: unknown): Preferences => {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Preferences>;
  return { cropPhotos: v.cropPhotos === true, focusSearchAfterMark: v.focusSearchAfterMark !== false };
};

let current: Preferences = DEFAULT_PREFERENCES;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((fn) => fn());

const readLocal = (uid: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(localKey(uid)) || 'null');
  } catch {
    return null;
  }
};

const writeLocal = (uid: string, value: Preferences) => {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(value));
  } catch {
    // blocked storage: the preferences simply are not copied
  }
};

/** Called once when a person signs in: the account's own preferences, or (offline / older account) the copy kept in this browser. */
export function loadPreferences(uid: string, fromAccount?: unknown): void {
  current = normalize(fromAccount ?? readLocal(uid));
  writeLocal(uid, current);
  emit();
}

export const getPreferences = (): Preferences => current;

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Saves a change to the person's account (one write) and applies it at once. Rejects when it cannot be saved. */
export async function savePreferences(patch: Partial<Preferences>): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('not-signed-in');
  }
  const next = normalize({ ...current, ...patch });
  await updateDoc(doc(db, 'users', uid), { preferences: next });
  current = next;
  writeLocal(uid, next);
  emit();
}
