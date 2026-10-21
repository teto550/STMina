// registerServant() (including finishing a half-made sign-up) and sendPasswordReset().
import { vi } from 'vitest';

const h = vi.hoisted(() => ({
  authObject: { languageCode: null as string | null },
  createUser: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(async () => undefined),
  sendPasswordResetEmail: vi.fn(async (..._a: unknown[]) => undefined),
  getDoc: vi.fn(),
  setDoc: vi.fn(async (..._a: unknown[]) => undefined),
  sendAdminEmail: vi.fn(async () => undefined),
  notifyManagersPush: vi.fn(async () => undefined),
}));
vi.mock('@/core/firebase', () => ({ auth: h.authObject, db: {} }));
vi.mock('@/core/access-config', () => ({ genderOfSection: (s: string) => (s === 'girls' ? 'female' : 'male') }));
vi.mock('@/features/shell/push', () => ({ notifyManagersPush: h.notifyManagersPush }));
vi.mock('@/api/email', () => ({ sendAdminEmail: h.sendAdminEmail }));
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...a: unknown[]) => h.createUser(...a),
  signInWithEmailAndPassword: (...a: unknown[]) => h.signInWithEmailAndPassword(...a),
  signOut: (...a: unknown[]) => h.signOut(...(a as [])),
  sendPasswordResetEmail: (...a: unknown[]) => h.sendPasswordResetEmail(...a),
  onAuthStateChanged: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => `${col}/${id}`,
  getDoc: (...a: unknown[]) => h.getDoc(...a),
  setDoc: (...a: unknown[]) => h.setDoc(...a),
  serverTimestamp: () => 'TS',
}));

import { registerServant, sendPasswordReset, type RegisterInput } from '@/api/auth';

const fb = (code: string) => Object.assign(new Error(code), { code });
const input: RegisterInput = { grade: 'سنة رابعة ابتدائي', name: 'يوسف كامل', email: 'y@x.com', phones: ['0100'], address: 'الفيوم', dob: '2003-01-10', graduated: true, college: '', university: '', password: 'secret1' };

beforeEach(() => {
  for (const fn of [h.createUser, h.signInWithEmailAndPassword, h.signOut, h.sendPasswordResetEmail, h.getDoc, h.setDoc, h.sendAdminEmail, h.notifyManagersPush]) {
    fn.mockReset();
  }
  h.signOut.mockResolvedValue(undefined);
  h.sendPasswordResetEmail.mockResolvedValue(undefined);
  h.setDoc.mockResolvedValue(undefined);
  h.sendAdminEmail.mockResolvedValue(undefined);
  h.notifyManagersPush.mockResolvedValue(undefined);
  h.authObject.languageCode = null;
});

describe('registerServant', () => {
  it('a new email: makes the login, writes the pending account, tells the admin and signs out', async () => {
    h.createUser.mockResolvedValue({ user: { uid: 'new1' } });
    await registerServant(input, 'boys');
    expect(h.setDoc).toHaveBeenCalledWith('users/new1', expect.objectContaining({ name: 'يوسف كامل', email: 'y@x.com', role: 'deacon', status: 'pending', section: 'boys', gender: 'male' }));
    expect(h.sendAdminEmail).toHaveBeenCalled();
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(h.signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('an email that is already a login but has NO account document (a half-made sign-up) is finished with the typed password', async () => {
    h.createUser.mockRejectedValue(fb('auth/email-already-in-use'));
    h.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'old1' } });
    h.getDoc.mockResolvedValue({ exists: () => false });
    await registerServant(input, 'boys');
    expect(h.signInWithEmailAndPassword).toHaveBeenCalledWith(h.authObject, 'y@x.com', 'secret1');
    expect(h.setDoc).toHaveBeenCalledWith('users/old1', expect.objectContaining({ status: 'pending', role: 'deacon' }));
    expect(h.signOut).toHaveBeenCalledTimes(1); // signed out at the end, nobody gets in before being approved
  });

  it('a login that already HAS an account document is still "already registered" (and nothing is written)', async () => {
    h.createUser.mockRejectedValue(fb('auth/email-already-in-use'));
    h.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'old1' } });
    h.getDoc.mockResolvedValue({ exists: () => true });
    await expect(registerServant(input, 'boys')).rejects.toMatchObject({ code: 'auth/email-already-in-use' });
    expect(h.setDoc).not.toHaveBeenCalled();
    expect(h.signOut).toHaveBeenCalledTimes(1); // the sign-in made to check is undone
  });

  it('somebody else\'s email (wrong password) is just "already registered": no account is written for them', async () => {
    h.createUser.mockRejectedValue(fb('auth/email-already-in-use'));
    h.signInWithEmailAndPassword.mockRejectedValue(fb('auth/invalid-credential'));
    await expect(registerServant(input, 'boys')).rejects.toMatchObject({ code: 'auth/email-already-in-use' });
    expect(h.getDoc).not.toHaveBeenCalled();
    expect(h.setDoc).not.toHaveBeenCalled();
  });

  it('any other error is passed on as it is', async () => {
    h.createUser.mockRejectedValue(fb('auth/weak-password'));
    await expect(registerServant(input, 'boys')).rejects.toMatchObject({ code: 'auth/weak-password' });
    expect(h.signInWithEmailAndPassword).not.toHaveBeenCalled();
  });
});

describe('sendPasswordReset', () => {
  it('sends the reset email in Arabic to the trimmed address', async () => {
    await sendPasswordReset('  y@x.com ');
    expect(h.authObject.languageCode).toBe('ar');
    expect(h.sendPasswordResetEmail).toHaveBeenCalledWith(h.authObject, 'y@x.com');
  });

  it('an unknown email looks like success (nobody can find out who has an account)', async () => {
    h.sendPasswordResetEmail.mockRejectedValue(fb('auth/user-not-found'));
    await expect(sendPasswordReset('nobody@x.com')).resolves.toBeUndefined();
  });

  it('a malformed email, no connection or too many attempts are errors', async () => {
    for (const code of ['auth/invalid-email', 'auth/network-request-failed', 'auth/too-many-requests']) {
      h.sendPasswordResetEmail.mockRejectedValueOnce(fb(code));
      await expect(sendPasswordReset('y@x.com')).rejects.toMatchObject({ code });
    }
  });
});
