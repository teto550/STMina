// Validation of the login, the "forgot my password" and the "new servant" (registration) forms.
import { z } from 'zod';
import { emailSchema, hasPhone, phoneListSchema, studyStatusSchema } from './common';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'اكتب الإيميل'),
  password: z.string().min(1, 'اكتب كلمة المرور'),
});
export type LoginValues = z.infer<typeof loginSchema>;

/** "نسيت كلمة المرور": only the email the reset link is sent to. */
export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const MIN_PASSWORD_LENGTH = 6;

/** The value of the "no class" choice of the sign-up form: for an admin, or someone who manages servants, who does not serve in a class. */
export const NO_CLASS = 'none';

export const registerSchema = z.object({
  grade: z.string().min(1, 'اختار السنة الدراسية اللي هتخدم فيها'),
  name: z.string().min(1, 'اختار اسمك من القايمة'),
  email: emailSchema,
  phones: phoneListSchema.refine(hasPhone, 'اكتب رقم التليفون'),
  address: z.string(),
  dob: z.string(),
  status: studyStatusSchema,
  college: z.string(),
  university: z.string(),
  password: z.string().min(MIN_PASSWORD_LENGTH, `كلمة المرور ${MIN_PASSWORD_LENGTH} أحرف على الأقل`),
});
export type RegisterValues = z.infer<typeof registerSchema>;

export const emptyLogin: LoginValues = { email: '', password: '' };
export const emptyRegister: RegisterValues = {
  grade: '', name: '', email: '', phones: [{ value: '' }], address: '', dob: '', status: 'student', college: '', university: '', password: '',
};
