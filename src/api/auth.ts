// Everything the sign-in screens ask Firebase to do. Plain async functions (no React): the hooks in src/react/hooks/useAuth.ts
// wrap them in React Query.
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { genderOfSection } from '@/core/access-config';
import { auth, db } from '@/core/firebase';
import { notifyManagersPush } from '@/features/shell/push';
import type { Section } from '@/types/access';
import { sendAdminEmail } from './email';

export interface RegisterInput {
  grade: string; name: string; email: string; phones: string[]; address: string; dob: string;
  graduated: boolean; college: string; university: string; password: string;
}

/** Calls `listener` with the signed-in person (or null) now and whenever it changes. Returns the function that stops listening. */
export function subscribeAuth(listener: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, listener);
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * "New servant": creates the login, writes the pending account the admin will approve, tells the admin (email + push; a failure
 * there must not fail the registration) and signs out again, because nobody may use the app before being approved.
 */
export async function registerServant(input: RegisterInput, section: Section): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
  await setDoc(doc(db, 'users', cred.user.uid), {
    name: input.name, email: input.email, grade: input.grade, role: 'deacon', status: 'pending', createdAt: serverTimestamp(),
    phones: input.phones, phone: input.phones[0] ?? '', address: input.address, dob: input.dob, section, gender: genderOfSection(section),
    graduated: input.graduated,
    college: input.graduated ? '' : input.college,
    university: input.graduated ? '' : input.university,
  });
  await Promise.allSettled([
    sendAdminEmail({ name: input.name, email: input.email, grade: input.grade, uid: cred.user.uid }),
    notifyManagersPush(cred.user),
  ]);
  await signOut(auth);
}
