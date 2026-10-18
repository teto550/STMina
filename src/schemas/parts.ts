// Validation of the form of a "فقرة" (a part of the Friday programme). Only the title and the day are required: the type and the servant
// can be left empty and given later.
import { z } from 'zod';

export const PART_TYPES = ['المقدمة', 'الدرس', 'الصلاة', 'الترانيم', 'أخرى'] as const;

export const partSchema = z.object({
  title: z.string().trim().min(1, 'اكتب تفاصيل الفقرة'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'اختر ميعاد الفقرة'),
  /** '' = no type yet */
  type: z.string().refine((v) => v === '' || (PART_TYPES as readonly string[]).includes(v), 'نوع الفقرة مش معروف'),
  /** '' = no servant yet */
  deaconName: z.string(),
  /** optional notes or links for the part: several lines, any web link in it is tappable */
  reference: z.string().trim().max(2000, 'المرجع طويل أوي (٢٠٠٠ حرف بالكتير)'),
});
export type PartValues = z.infer<typeof partSchema>;
