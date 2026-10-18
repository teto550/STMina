import { partSchema } from '@/schemas/parts';

const ok = { title: 'ترنيمة', date: '2026-10-16', type: '', deaconName: '', reference: '' };

describe('partSchema', () => {
  it('only the title and the day are required: the type and the servant may be empty', () => {
    expect(partSchema.safeParse(ok).success).toBe(true);
    expect(partSchema.safeParse({ ...ok, type: 'الدرس', deaconName: 'مينا' }).success).toBe(true);
  });

  it('the title and the day are required', () => {
    expect(partSchema.safeParse({ ...ok, title: '  ' }).error?.issues[0]?.message).toBe('اكتب تفاصيل الفقرة');
    expect(partSchema.safeParse({ ...ok, date: '' }).error?.issues[0]?.message).toBe('اختر ميعاد الفقرة');
  });

  it('the reference is optional, may have several lines, and is trimmed', () => {
    expect(partSchema.safeParse(ok).success).toBe(true);
    expect(partSchema.parse({ ...ok, reference: '  سطر أول\nhttps://example.com  ' }).reference).toBe('سطر أول\nhttps://example.com');
  });

  it('a reference over 2000 characters is refused', () => {
    expect(partSchema.safeParse({ ...ok, reference: 'x'.repeat(2000) }).success).toBe(true);
    expect(partSchema.safeParse({ ...ok, reference: 'x'.repeat(2001) }).error?.issues[0]?.message).toContain('طويل');
  });

  it('a type outside the list is refused', () => {
    expect(partSchema.safeParse({ ...ok, type: 'حاجة تانية' }).success).toBe(false);
  });
});
