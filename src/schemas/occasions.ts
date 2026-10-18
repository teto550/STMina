// Validation of the form of an occasion (a feast, a fast, ...): a description and a day, both required.
import { z } from 'zod';

export const occasionSchema = z.object({
  title: z.string().trim().min(1, 'اكتب اسم المناسبة'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'اختر التاريخ'),
});
export type OccasionValues = z.infer<typeof occasionSchema>;
