import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithQuery } from '@/test/render';

const { registerServant, fetchRoster, device, changeRegGender } = vi.hoisted(() => ({
  registerServant: vi.fn(), fetchRoster: vi.fn(), device: { section: 'boys' }, changeRegGender: vi.fn(),
}));
vi.mock('@/core/section', () => ({
  get SECTION() { return device.section; },
  GRADES: ['سنة تالتة ابتدائي', 'سنة رابعة ابتدائي'],
  changeRegGender,
}));
vi.mock('@/api/auth', () => ({ registerServant, signIn: vi.fn(), signOutUser: vi.fn(), subscribeAuth: vi.fn() }));
vi.mock('@/api/account', () => ({ loadAccountDecision: vi.fn(), ensureAdminAccount: vi.fn() }));
vi.mock('@/api/roster', () => ({ fetchRoster }));

import { RegisterForm } from '@/react/screens/auth/register';

const roster = [
  { name: 'يوسف', grade: 'سنة رابعة ابتدائي' },
  { name: 'أبانوب', grade: 'سنة رابعة ابتدائي' },
  { name: 'مينا', grade: 'سنة تالتة ابتدائي' },
];
const fb = (code: string) => Object.assign(new Error(code), { code });

function setup(section: 'boys' | 'girls' = 'boys') {
  device.section = section;
  renderWithQuery(<RegisterForm />);
  return { user: userEvent.setup() };
}
type User = ReturnType<typeof userEvent.setup>;
const grade = () => screen.findByLabelText(/السنة الدراسية اللي هتخدم فيها/);
const nameSelect = () => screen.findByLabelText(/الاسم الكامل/);
const send = (user: User) => user.click(screen.getByRole('button', { name: /طلب تسجيل/ }));

async function fillValid(user: User) {
  await user.selectOptions(await grade(), 'سنة رابعة ابتدائي');
  const name = await nameSelect();
  await waitFor(() => expect(name).toBeEnabled());
  await user.selectOptions(name, 'يوسف');
  await user.type(screen.getByLabelText('البريد الإلكتروني *'), ' y@x.com ');
  await user.type(screen.getByLabelText('رقم التليفون 1'), '01000000000');
  await user.type(screen.getByLabelText('كلمة المرور *'), 'secret1');
}

beforeEach(() => {
  changeRegGender.mockReset();
  registerServant.mockReset();
  fetchRoster.mockReset();
  fetchRoster.mockResolvedValue(roster);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('RegisterForm: the servants list (loader, error, empty, data)', () => {
  it('shows a visible loader while the names load, then the name list', async () => {
    let finish: (v: typeof roster) => void = () => undefined;
    fetchRoster.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    setup();
    expect(await screen.findByRole('status', { name: 'جاري تحميل الأسماء…' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/الاسم الكامل/)).not.toBeInTheDocument();
    finish(roster);
    expect(await nameSelect()).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'جاري تحميل الأسماء…' })).not.toBeInTheDocument();
  });

  it('asks for this section\'s servants', async () => {
    setup('girls');
    await nameSelect();
    expect(fetchRoster).toHaveBeenCalledWith('girls');
  });

  it('the name list needs a class first, then lists only that class\'s servants, sorted in Arabic', async () => {
    const { user } = setup();
    const name = await nameSelect();
    expect(name).toBeDisabled();
    expect(within(name).getByText('اختر السنة الدراسية الأول')).toBeInTheDocument();
    await user.selectOptions(await grade(), 'سنة رابعة ابتدائي');
    await waitFor(() => expect(name).toBeEnabled());
    expect(within(name).getAllByRole('option').map((o) => o.textContent)).toEqual(['اختر اسمك من القائمة', 'أبانوب', 'يوسف']);
  });

  it('changing the class forgets the name that was picked', async () => {
    const { user } = setup();
    await user.selectOptions(await grade(), 'سنة رابعة ابتدائي');
    await user.selectOptions(await nameSelect(), 'يوسف');
    await user.selectOptions(await grade(), 'سنة تالتة ابتدائي');
    expect(await nameSelect()).toHaveValue('');
  });

  it('a failed load shows a visible error with a retry button that loads the names', async () => {
    fetchRoster.mockRejectedValueOnce(fb('unavailable'));
    const { user } = setup();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('مقدرناش نحمّل أسماء الخدام');
    await user.click(within(alert).getByRole('button', { name: 'حاول تاني' }));
    expect(await nameSelect()).toBeInTheDocument();
    expect(fetchRoster).toHaveBeenCalledTimes(2);
  });

  it('says so when a class has no servants listed', async () => {
    fetchRoster.mockResolvedValue([]);
    const { user } = setup();
    await user.selectOptions(await grade(), 'سنة تالتة ابتدائي');
    expect(await screen.findByText('لا يوجد خدام مسجلين في السنة دي — كلم الأدمن')).toBeInTheDocument();
  });
});

describe('RegisterForm: validation (zod schema)', () => {
  it('shows every missing field at once and sends nothing', async () => {
    const { user } = setup();
    await nameSelect();
    await send(user);
    for (const text of ['اختار السنة الدراسية اللي هتخدم فيها', 'اختار اسمك من القايمة', 'اكتب الإيميل', 'اكتب رقم التليفون', 'كلمة المرور 6 أحرف على الأقل']) {
      expect(await screen.findByText(text)).toBeInTheDocument();
    }
    expect(registerServant).not.toHaveBeenCalled();
  });

  it('rejects an email that is not an email', async () => {
    const { user } = setup();
    await user.type(await screen.findByLabelText('البريد الإلكتروني *'), 'not-an-email');
    await send(user);
    expect(await screen.findByText('الإيميل مش صحيح')).toBeInTheDocument();
  });
});

describe('RegisterForm: sending (React Query mutation)', () => {
  it('sends the cleaned-up data for this section, then shows the confirmation and empties the form', async () => {
    registerServant.mockResolvedValue(undefined);
    const { user } = setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /إضافة رقم تليفون تاني/ }));
    await user.type(screen.getByLabelText('رقم التليفون 2'), '  ');
    await user.selectOptions(screen.getByLabelText('الجامعة'), 'جامعة القاهرة');
    await user.type(screen.getByLabelText('الكلية'), ' هندسة ');
    await send(user);
    await waitFor(() => expect(registerServant).toHaveBeenCalledTimes(1));
    expect(registerServant.mock.calls[0]).toEqual([{
      grade: 'سنة رابعة ابتدائي', name: 'يوسف', email: 'y@x.com', phones: ['01000000000'], address: '', dob: '',
      graduated: false, college: 'هندسة', university: 'جامعة القاهرة', password: 'secret1',
    }, 'boys']);
    expect(await screen.findByText(/تم إرسال طلبك للأدمن/)).toBeInTheDocument();
    expect(screen.getByLabelText(/السنة الدراسية اللي هتخدم فيها/)).toHaveValue('');
    expect(screen.getByLabelText('كلمة المرور *')).toHaveValue('');
  });

  it('shows a loader on the button while it is sent', async () => {
    let finish: () => void = () => undefined;
    registerServant.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { user } = setup();
    await fillValid(user);
    await send(user);
    const busy = await screen.findByRole('button', { name: 'جاري الإرسال…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    finish();
    expect(await screen.findByText(/تم إرسال طلبك للأدمن/)).toBeInTheDocument();
  });

  it('a graduate sends no college or university, and the fields are hidden', async () => {
    registerServant.mockResolvedValue(undefined);
    const { user } = setup();
    await fillValid(user);
    await user.type(screen.getByLabelText('الكلية'), 'هندسة');
    await user.selectOptions(screen.getByLabelText('الحالة الدراسية *'), 'graduated');
    expect(screen.queryByLabelText('الكلية')).not.toBeInTheDocument();
    await send(user);
    await waitFor(() => expect(registerServant).toHaveBeenCalled());
    expect(registerServant.mock.calls[0]![0]).toMatchObject({ graduated: true, college: '', university: '' });
  });

  it('says so when the email is already registered, keeps what was typed, and the message can be dismissed', async () => {
    registerServant.mockRejectedValue(fb('auth/email-already-in-use'));
    const { user } = setup();
    await fillValid(user);
    await send(user);
    const alert = await screen.findByRole('alert', { name: '' });
    expect(alert).toHaveTextContent('الإيميل ده مسجل بالفعل');
    expect(screen.getByLabelText('البريد الإلكتروني *')).toHaveValue('y@x.com');
    await user.click(within(alert).getByRole('button', { name: 'إغلاق' }));
    expect(screen.queryByText('الإيميل ده مسجل بالفعل')).not.toBeInTheDocument();
  });

  it('any other failure gets the general message', async () => {
    registerServant.mockRejectedValue(new Error('boom'));
    const { user } = setup();
    await fillValid(user);
    await send(user);
    expect(await screen.findByText('حدث خطأ، حاول تاني')).toBeInTheDocument();
  });
});

describe('RegisterForm: the other fields', () => {
  it('changing the gender hands over to the old code (it switches the section and reloads)', async () => {
    const { user } = setup();
    const gender = await screen.findByLabelText('النوع *');
    expect(gender).toHaveValue('male');
    await user.selectOptions(gender, 'female');
    expect(changeRegGender).toHaveBeenCalledWith('female');
  });

  it('starts on the girls option in the girls section', async () => {
    setup('girls');
    expect(await screen.findByLabelText('النوع *')).toHaveValue('female');
  });

  it('a second phone number can be added and removed again', async () => {
    const { user } = setup();
    await screen.findByLabelText('النوع *');
    expect(screen.queryByRole('button', { name: /شيل رقم/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /إضافة رقم تليفون تاني/ }));
    await user.click(screen.getByRole('button', { name: 'شيل رقم 2' }));
    expect(screen.queryByLabelText('رقم التليفون 2')).not.toBeInTheDocument();
  });

  it('the password has an eye', async () => {
    const { user } = setup();
    const pass = await screen.findByLabelText('كلمة المرور *');
    await user.click(screen.getByRole('button', { name: 'إظهار كلمة المرور' }));
    expect(pass).toHaveAttribute('type', 'text');
  });
});
