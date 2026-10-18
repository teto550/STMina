import { cleanPhones, emailSchema, hasPhone } from '@/schemas/common';

describe('phone helpers', () => {
  it('blank rows do not count as a phone number', () => {
    expect(hasPhone([{ value: '' }, { value: '   ' }])).toBe(false);
    expect(hasPhone([{ value: '' }, { value: '010' }])).toBe(true);
  });
  it('cleanPhones trims and drops blank rows', () => {
    expect(cleanPhones([{ value: ' 010 ' }, { value: '' }, { value: '011' }])).toEqual(['010', '011']);
  });
});

describe('emailSchema', () => {
  it('requires a value, with its own message', () => {
    const r = emailSchema.safeParse('   ');
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual(['اكتب الإيميل']);
  });
  it('rejects something that is not an email', () => {
    const r = emailSchema.safeParse('not-an-email');
    expect(r.error?.issues[0]?.message).toBe('الإيميل مش صحيح');
  });
  it('accepts an email and returns it trimmed', () => {
    expect(emailSchema.parse('  a@x.com ')).toBe('a@x.com');
  });
});
