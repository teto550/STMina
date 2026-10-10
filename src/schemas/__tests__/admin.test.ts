import { addAdminSchema } from '@/schemas/admin';

describe('addAdminSchema', () => {
  const ok = { name: 'سارة', gender: 'female' as const, email: 'new@x.com' };
  it('accepts a name, a gender and an email', () => {
    expect(addAdminSchema.safeParse(ok).success).toBe(true);
  });
  it('the name needs at least two characters', () => {
    expect(addAdminSchema.safeParse({ ...ok, name: 'س' }).error?.issues[0]?.message).toBe('اكتب الاسم');
  });
  it('the gender is male or female only', () => {
    expect(addAdminSchema.safeParse({ ...ok, gender: 'x' }).success).toBe(false);
  });
  it('the email must be an email', () => {
    expect(addAdminSchema.safeParse({ ...ok, email: 'bad' }).error?.issues[0]?.message).toBe('الإيميل مش صحيح');
  });
});
