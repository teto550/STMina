import { emptyLogin, emptyRegister, loginSchema, registerSchema } from '@/schemas/auth';

const messages = (r: { error?: { issues: { message: string }[] } }) => (r.error?.issues ?? []).map((i) => i.message);

describe('loginSchema', () => {
  it('needs both fields, each with its own message', () => {
    expect(messages(loginSchema.safeParse(emptyLogin))).toEqual(['اكتب الإيميل', 'اكتب كلمة المرور']);
  });
  it('trims the email but never touches the password', () => {
    expect(loginSchema.parse({ email: ' a@x.com ', password: ' p ' })).toEqual({ email: 'a@x.com', password: ' p ' });
  });
});

describe('registerSchema', () => {
  const valid = { ...emptyRegister, grade: 'سنة رابعة ابتدائي', name: 'يوسف', email: 'y@x.com', phones: [{ value: '010' }], password: 'secret1' };

  it('an empty form fails on every required field', () => {
    expect(messages(registerSchema.safeParse(emptyRegister))).toEqual([
      'اختار السنة الدراسية اللي هتخدم فيها', 'اختار اسمك من القايمة', 'اكتب الإيميل', 'اكتب رقم التليفون', 'كلمة المرور 6 أحرف على الأقل',
    ]);
  });
  it('accepts a complete form', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });
  it('a password of 5 characters is too short, 6 is enough', () => {
    expect(messages(registerSchema.safeParse({ ...valid, password: '12345' }))).toEqual(['كلمة المرور 6 أحرف على الأقل']);
    expect(registerSchema.safeParse({ ...valid, password: '123456' }).success).toBe(true);
  });
  it('blank phone rows are not a phone number', () => {
    expect(messages(registerSchema.safeParse({ ...valid, phones: [{ value: '  ' }] }))).toEqual(['اكتب رقم التليفون']);
  });
  it('rejects a bad email', () => {
    expect(messages(registerSchema.safeParse({ ...valid, email: 'nope' }))).toEqual(['الإيميل مش صحيح']);
  });
  it('study status must be student or graduated', () => {
    expect(registerSchema.safeParse({ ...valid, status: 'other' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, status: 'graduated' }).success).toBe(true);
  });
});
