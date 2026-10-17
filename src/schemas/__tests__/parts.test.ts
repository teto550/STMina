import { partSchema } from '@/schemas/parts';

const ok = { title: 'ترنيمة', date: '2026-10-16', type: '', deaconName: '' };

describe('partSchema', () => {
  it('only the title and the day are required: the type and the servant may be empty', () => {
    expect(partSchema.safeParse(ok).success).toBe(true);
    expect(partSchema.safeParse({ ...ok, type: 'الدرس', deaconName: 'مينا' }).success).toBe(true);
  });

  it('the title and the day are required', () => {
    expect(partSchema.safeParse({ ...ok, title: '  ' }).error?.issues[0]?.message).toBe('اكتب تفاصيل الفقرة');
    expect(partSchema.safeParse({ ...ok, date: '' }).error?.issues[0]?.message).toBe('اختر ميعاد الفقرة');
  });

  it('a type outside the list is refused', () => {
    expect(partSchema.safeParse({ ...ok, type: 'حاجة تانية' }).success).toBe(false);
  });
});
