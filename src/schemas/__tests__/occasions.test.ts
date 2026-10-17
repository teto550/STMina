import { occasionSchema } from '@/schemas/occasions';

describe('occasionSchema', () => {
  it('a name and a day are both required', () => {
    expect(occasionSchema.safeParse({ title: ' عيد الميلاد ', date: '2027-01-07' }).data).toEqual({ title: 'عيد الميلاد', date: '2027-01-07' });
    expect(occasionSchema.safeParse({ title: ' ', date: '2027-01-07' }).error?.issues[0]?.message).toBe('اكتب اسم المناسبة');
    expect(occasionSchema.safeParse({ title: 'x', date: '' }).error?.issues[0]?.message).toBe('اختر التاريخ');
  });
});
