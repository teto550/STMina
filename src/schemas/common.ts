// Building blocks shared by the schema files in this folder. Messages are the ones the user sees (Arabic).
import { z } from 'zod';

/** One phone number as a form field (react-hook-form's field arrays need objects, not bare strings). */
export const phoneItemSchema = z.object({ value: z.string() });
export const phoneListSchema = z.array(phoneItemSchema);
export type PhoneItem = z.infer<typeof phoneItemSchema>;

/** At least one number was typed (blank rows do not count). */
export const hasPhone = (list: PhoneItem[]): boolean => list.some((p) => p.value.trim() !== '');
/** The typed numbers, trimmed, without blank rows. */
export const cleanPhones = (list: PhoneItem[]): string[] => list.map((p) => p.value.trim()).filter(Boolean);

/** A required, well-formed email; the value that comes out is trimmed. */
// (a blank email reports only "write the email", not also "not valid")
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'اكتب الإيميل')
  .superRefine((value, ctx) => {
    if (value !== '' && !z.email().safeParse(value).success) {
      ctx.addIssue({ code: 'custom', message: 'الإيميل مش صحيح' });
    }
  });

export const genderSchema = z.enum(['male', 'female']);
export const studyStatusSchema = z.enum(['student', 'graduated']);
