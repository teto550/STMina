// "نسيت كلمة المرور" on the sign-in tab: the link, the form that sends Firebase's reset email, and the way back.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithQuery } from '@/test/render';

const h = vi.hoisted(() => ({ signIn: vi.fn(), sendPasswordReset: vi.fn() }));
vi.mock('@/api/auth', () => ({ signIn: h.signIn, sendPasswordReset: h.sendPasswordReset, registerServant: vi.fn(), signOutUser: vi.fn(), subscribeAuth: vi.fn() }));

import { LoginForm } from '@/react/screens/auth/login';

function setup() {
  renderWithQuery(<LoginForm />);
  return userEvent.setup();
}

beforeEach(() => {
  h.signIn.mockReset();
  h.sendPasswordReset.mockReset().mockResolvedValue(undefined);
});

describe('forgot password', () => {
  it('the sign-in form has a "نسيت كلمة المرور؟" link, and opens the reset form with the email typed so far', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'm@x.com');
    await user.click(screen.getByRole('button', { name: 'نسيت كلمة المرور؟' }));
    expect(screen.getByLabelText('البريد الإلكتروني')).toHaveValue('m@x.com');
    expect(screen.getByRole('button', { name: 'ابعتلي اللينك' })).toBeInTheDocument();
    expect(screen.queryByLabelText('كلمة المرور')).not.toBeInTheDocument(); // the sign-in form is gone
  });

  it('sends the reset email to the typed address and says so (without saying whether the account exists)', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'نسيت كلمة المرور؟' }));
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'm@x.com');
    await user.click(screen.getByRole('button', { name: 'ابعتلي اللينك' }));
    await waitFor(() => expect(h.sendPasswordReset).toHaveBeenCalledWith('m@x.com'));
    const done = await screen.findByText(/لو الإيميل ده مسجل عندنا/);
    expect(done).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'رجوع لتسجيل الدخول' })).toBeInTheDocument();
  });

  it('asks for a valid email first', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'نسيت كلمة المرور؟' }));
    await user.click(screen.getByRole('button', { name: 'ابعتلي اللينك' }));
    expect(await screen.findByText('اكتب الإيميل')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/البريد الإلكتروني/), 'not-an-email'); // the label now also carries the message
    await user.click(screen.getByRole('button', { name: 'ابعتلي اللينك' }));
    expect(await screen.findByText('الإيميل مش صحيح')).toBeInTheDocument();
    expect(h.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('shows why it failed and stays on the form (no connection, too many attempts)', async () => {
    h.sendPasswordReset.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/network-request-failed' }));
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'نسيت كلمة المرور؟' }));
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'm@x.com');
    await user.click(screen.getByRole('button', { name: 'ابعتلي اللينك' }));
    expect(await screen.findByText('مفيش اتصال بالنت، جرّب تاني')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ابعتلي اللينك' })).toBeEnabled();
  });

  it('"رجوع لتسجيل الدخول" goes back to the sign-in form (from the form and from the "sent" notice)', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'نسيت كلمة المرور؟' }));
    await user.click(screen.getByRole('button', { name: 'رجوع لتسجيل الدخول' }));
    expect(screen.getByRole('button', { name: 'دخول' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'نسيت كلمة المرور؟' }));
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'm@x.com');
    await user.click(screen.getByRole('button', { name: 'ابعتلي اللينك' }));
    await user.click(await screen.findByRole('button', { name: 'رجوع لتسجيل الدخول' }));
    expect(within(document.body).getByRole('button', { name: 'دخول' })).toBeInTheDocument();
  });

  it('the normal sign-in still works', async () => {
    h.signIn.mockResolvedValue(undefined);
    const user = setup();
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'm@x.com');
    await user.type(screen.getByLabelText('كلمة المرور'), 'secret1');
    await user.click(screen.getByRole('button', { name: 'دخول' }));
    await waitFor(() => expect(h.signIn).toHaveBeenCalledWith('m@x.com', 'secret1'));
  });
});
