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
