// Validation of the forms of the admin screens.
import { z } from 'zod';
import { emailSchema, genderSchema } from './common';

/** "+ أدمن": a person (name, gender, email) who gets the admin role. */
export const addAdminSchema = z.object({
  name: z.string().trim().min(2, 'اكتب الاسم'),
  gender: genderSchema,
  email: emailSchema,
});
export type AddAdminValues = z.infer<typeof addAdminSchema>;

/** "+ شخص جديد": a servant of the list (name, gender, optional email). The roles are picked in the same sheet. */
export const addPersonSchema = z.object({
  name: z.string().trim().min(2, 'اكتب الاسم'),
  gender: genderSchema,
  email: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value !== '' && !z.email().safeParse(value).success) {
        ctx.addIssue({ code: 'custom', message: 'الإيميل مش صحيح' });
      }
    }),
});
export type AddPersonValues = z.infer<typeof addPersonSchema>;
