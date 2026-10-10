import { editServantSchema } from '@/schemas/servant';

const base = { name: 'مينا', phones: [{ value: '' }], address: '', dob: '', status: 'student' as const, college: '', university: '' };

describe('editServantSchema', () => {
  it('a single first name is fine', () => {
    expect(editServantSchema.safeParse(base).success).toBe(true);
  });
  it('the name is required and is trimmed', () => {
    const empty = editServantSchema.safeParse({ ...base, name: '   ' });
    expect(empty.error?.issues[0]?.message).toBe('اكتب الاسم');
    expect(editServantSchema.parse({ ...base, name: ' مينا ' }).name).toBe('مينا');
  });
  it('does not require a phone itself (the screen decides, because it depends on the servant having an account)', () => {
    expect(editServantSchema.safeParse({ ...base, phones: [] }).success).toBe(true);
  });
});
