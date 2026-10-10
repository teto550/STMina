// Validation of the servant's own data (the "edit servant" screen).
import { z } from 'zod';
import { phoneListSchema, studyStatusSchema } from './common';

export const editServantSchema = z.object({
  // a single first name is fine
  name: z.string().trim().min(1, 'اكتب الاسم'),
  // whether at least one number is REQUIRED depends on the servant having an account, so the screen checks that itself
  phones: phoneListSchema,
  address: z.string(),
  dob: z.string(),
  status: studyStatusSchema,
  college: z.string(),
  university: z.string(),
});
export type EditServantValues = z.infer<typeof editServantSchema>;
