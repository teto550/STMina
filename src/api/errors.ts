// Turns an error thrown by Firebase / axios into the sentence the user sees (Arabic). One place, so every screen says the same thing.

/** Firebase errors carry a `code` such as 'auth/email-already-in-use'. */
export function errorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
}

const isNetwork = (code: string | undefined): boolean => code === 'auth/network-request-failed' || code === 'ERR_NETWORK' || code === 'unavailable';

export const MESSAGES = {
  network: 'مفيش اتصال بالنت، جرّب تاني',
  tooMany: 'محاولات كتير، استنى شوية وجرّب تاني',
  badLogin: 'بيانات خاطئة، حاول تاني',
  emailInUse: 'الإيميل ده مسجل بالفعل',
  weakPassword: 'كلمة المرور ضعيفة، اختار كلمة أقوى',
  general: 'حدث خطأ، حاول تاني',
  loadFailed: 'مقدرناش نحمّل البيانات',
  invalidEmail: 'الإيميل مش صحيح',
  accountMissing: 'حسابك مش مسجل عندنا. اخرج وسجّل من "خادم جديد"، أو كلّم المسؤول.',
  profileDenied: 'مش مسموح تحفظ بيانات الحساب ده. كلّم المسؤول.',
} as const;

export function loginErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (isNetwork(code)) {
    return MESSAGES.network;
  }
  if (code === 'auth/too-many-requests') {
    return MESSAGES.tooMany;
  }
  return MESSAGES.badLogin;
}

export function registerErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code === 'auth/email-already-in-use') {
    return MESSAGES.emailInUse;
  }
  if (code === 'auth/weak-password') {
    return MESSAGES.weakPassword;
  }
  if (isNetwork(code)) {
    return MESSAGES.network;
  }
  return MESSAGES.general;
}

/** True when Firestore refused the write because of the security rules. */
export function isPermissionDenied(error: unknown): boolean {
  return errorCode(error) === 'permission-denied';
}

/** What "كمّل بياناتك" says when the save failed. A login with no account document (`not-found`) is told to register or ask the admin. */
export function profileSaveErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code === 'not-found') {
    return MESSAGES.accountMissing;
  }
  if (code === 'permission-denied') {
    return MESSAGES.profileDenied;
  }
  if (isNetwork(code)) {
    return MESSAGES.network;
  }
  return MESSAGES.general;
}

/** What "نسيت كلمة المرور" says when the email could not be sent (an unknown email is NOT an error: it looks like success). */
export function passwordResetErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code === 'auth/invalid-email') {
    return MESSAGES.invalidEmail;
  }
  if (code === 'auth/too-many-requests') {
    return MESSAGES.tooMany;
  }
  if (isNetwork(code)) {
    return MESSAGES.network;
  }
  return MESSAGES.general;
}
