// Everything the sign-in screens ask Firebase to do. Plain async functions (no React): the hooks in src/react/hooks/useAuth.ts
// wrap them in React Query.
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { genderOfSection } from '@/core/access-config';
import { auth, db } from '@/core/firebase';
import { notifyManagersPush } from '@/features/shell/push';
import type { Section } from '@/types/access';
import { sendAdminEmail } from './email';
import { errorCode } from './errors';

export interface RegisterInput {
  grade: string; name: string; email: string; phones: string[]; address: string; dob: string;
  graduated: boolean; college: string; university: string; password: string;
}

/** Calls `listener` with the signed-in person (or null) now and whenever it changes. Returns the function that stops listening. */
export function subscribeAuth(listener: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, listener);
}

/** The person signed in right now, or null. */
export function currentUser(): User | null {
  return auth.currentUser;
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Sends the "choose a new password" email: the same email as the "Reset password" action of the Firebase console (Authentication ->
 * Templates -> Password reset), in Arabic. It never says whether the email is registered (that would let anyone find out who has an
 * account): an unknown email looks like success. Rejects for a malformed email, no connection, or too many attempts.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  auth.languageCode = 'ar';
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (e) {
    if (errorCode(e) !== 'auth/user-not-found') {
      throw e;
    }
  }
}

/**
 * Makes the login of a new servant, signed in. An email that is ALREADY a login but has no account document (a sign-up that stopped half way, or a
 * login made in the Firebase console) is finished instead of refused: when the typed password is the login's own, the person is signed in and
 * goes on to get their pending account. An email that is a login WITH an account document, or a wrong password, is still "already registered".
 */
async function loginForRegistration(input: RegisterInput): Promise<User> {
  try {
    return (await createUserWithEmailAndPassword(auth, input.email, input.password)).user;
  } catch (e) {
    if (errorCode(e) !== 'auth/email-already-in-use') {
      throw e;
    }
    let user: User;
    try {
      user = (await signInWithEmailAndPassword(auth, input.email, input.password)).user;
    } catch {
      throw e; // not their login: just "already registered"
    }
    if ((await getDoc(doc(db, 'users', user.uid))).exists()) {
      await signOut(auth);
      throw e; // really registered already
    }
    return user;
  }
}

/**
 * "New servant": creates the login, writes the pending account the admin will approve, tells the admin (email + push; a failure
 * there must not fail the registration) and signs out again, because nobody may use the app before being approved.
 */
export async function registerServant(input: RegisterInput, section: Section): Promise<void> {
  const user = await loginForRegistration(input);
  await setDoc(doc(db, 'users', user.uid), {
    name: input.name, email: input.email, grade: input.grade, role: 'deacon', status: 'pending', createdAt: serverTimestamp(),
    phones: input.phones, phone: input.phones[0] ?? '', address: input.address, dob: input.dob, section, gender: genderOfSection(section),
    graduated: input.graduated,
    college: input.graduated ? '' : input.college,
    university: input.graduated ? '' : input.university,
  });
  await Promise.allSettled([
    sendAdminEmail({ name: input.name, email: input.email, grade: input.grade || 'إدارة (من غير فصل)', uid: user.uid }),
    notifyManagersPush(user),
  ]);
  await signOut(auth);
}
