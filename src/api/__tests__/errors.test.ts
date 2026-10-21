import { errorCode, loginErrorMessage, MESSAGES, passwordResetErrorMessage, profileSaveErrorMessage, registerErrorMessage } from '@/api/errors';

const fb = (code: string) => Object.assign(new Error(code), { code });

describe('errorCode', () => {
  it('reads a Firebase code, and nothing else', () => {
    expect(errorCode(fb('auth/x'))).toBe('auth/x');
    expect(errorCode(new Error('plain'))).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
  });
});

describe('loginErrorMessage', () => {
  it('a wrong password, an unknown email or anything unexpected says the data is wrong', () => {
    for (const c of ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-email']) expect(loginErrorMessage(fb(c))).toBe(MESSAGES.badLogin);
    expect(loginErrorMessage(new Error('x'))).toBe(MESSAGES.badLogin);
  });
  it('a missing connection is said as such, and too many attempts too', () => {
    expect(loginErrorMessage(fb('auth/network-request-failed'))).toBe(MESSAGES.network);
    expect(loginErrorMessage(fb('auth/too-many-requests'))).toBe(MESSAGES.tooMany);
  });
});

describe('registerErrorMessage', () => {
  it('knows the common cases and falls back to a general message', () => {
    expect(registerErrorMessage(fb('auth/email-already-in-use'))).toBe(MESSAGES.emailInUse);
    expect(registerErrorMessage(fb('auth/weak-password'))).toBe(MESSAGES.weakPassword);
    expect(registerErrorMessage(fb('auth/network-request-failed'))).toBe(MESSAGES.network);
    expect(registerErrorMessage(new Error('x'))).toBe(MESSAGES.general);
  });
});

describe('profileSaveErrorMessage ("complete your data")', () => {
  it('a login with no account document is told to register or ask the admin', () => {
    expect(profileSaveErrorMessage(fb('not-found'))).toBe(MESSAGES.accountMissing);
    expect(MESSAGES.accountMissing).toContain('كلّم المسؤول');
  });
  it('refused by the rules, no connection, anything else', () => {
    expect(profileSaveErrorMessage(fb('permission-denied'))).toBe(MESSAGES.profileDenied);
    expect(profileSaveErrorMessage(fb('unavailable'))).toBe(MESSAGES.network);
    expect(profileSaveErrorMessage(new Error('x'))).toBe(MESSAGES.general);
  });
});

describe('passwordResetErrorMessage ("نسيت كلمة المرور")', () => {
  it('says what is wrong with the email, the connection, or the number of attempts', () => {
    expect(passwordResetErrorMessage(fb('auth/invalid-email'))).toBe(MESSAGES.invalidEmail);
    expect(passwordResetErrorMessage(fb('auth/network-request-failed'))).toBe(MESSAGES.network);
    expect(passwordResetErrorMessage(fb('auth/too-many-requests'))).toBe(MESSAGES.tooMany);
    expect(passwordResetErrorMessage(new Error('x'))).toBe(MESSAGES.general);
  });
});
